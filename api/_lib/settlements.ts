import mongoose from 'mongoose';
import { simplifyDebts } from '../../shared/settle.js';
import { GameSession, Settlement, User } from './models.js';

/** A settle room stays open this long; clicks are saved, so players can come back any time inside it. */
export const SETTLE_WINDOW_HOURS = 48;

export type R<T> = { ok: true; value: T } | { ok: false; status: number; error: string };
const ok = <T>(value: T): R<T> => ({ ok: true, value });
const fail = (status: number, error: string): R<never> => ({ ok: false, status, error });

interface GamePlayer { userId: unknown; name: string; net: number }
interface GameDoc { _id: unknown; hostId?: unknown; status?: string; settledAt?: Date; endedAt: Date; rounds: number; baseBet: number; players: GamePlayer[] }
interface RoomPlayer { userId: unknown; name: string; net: number; readyAt?: Date | null; walletDelta?: number }
interface RoomDoc {
  _id: unknown; gameId: unknown; status: 'OPEN' | 'SETTLED' | 'CANCELLED' | 'EXPIRED'; startedBy: unknown;
  startedAt: Date; expiresAt: Date; settledAt?: Date; closedAt?: Date;
  players: RoomPlayer[]; payments: { from: unknown; to: unknown; amount: number }[];
}

const same = (a: unknown, b: unknown) => String(a) === String(b);
const oid = (id: string) => new mongoose.Types.ObjectId(id);

/** Only the game's host may open or cancel a settle room. Games saved before the host was recorded have none: any of their players may. */
export const mayStart = (game: GameDoc, userId: string) => (game.hostId ? same(game.hostId, userId) : true);

/** Players with money to pay or receive, one entry per user (a merged account can appear twice). Someone at ₹0 has nothing to confirm. */
export function owingPlayers(players: GamePlayer[]): { userId: string; name: string; net: number }[] {
  const by = new Map<string, { userId: string; name: string; net: number }>();
  for (const p of players) {
    const id = String(p.userId);
    const seen = by.get(id);
    by.set(id, seen ? { ...seen, net: seen.net + p.net } : { userId: id, name: p.name, net: p.net });
  }
  return [...by.values()].filter((p) => p.net !== 0);
}

/** An open room past its time becomes EXPIRED. Done when it is looked at, so no scheduler is needed. */
async function expireStale(gameId?: string) {
  await Settlement.updateMany(
    { status: 'OPEN', expiresAt: { $lte: new Date() }, ...(gameId && { gameId: oid(gameId) }) },
    { $set: { status: 'EXPIRED', closedAt: new Date() } },
  );
}

async function memberGame(userId: string, gameId: string): Promise<R<GameDoc>> {
  if (!mongoose.isValidObjectId(gameId)) return fail(400, 'BAD_REQUEST');
  const game = (await GameSession.findById(gameId).lean()) as unknown as GameDoc | null;
  // Not in the game looks the same as no such game.
  if (!game || !game.players.some((p) => same(p.userId, userId))) return fail(404, 'NOT_FOUND');
  return ok(game);
}

/** Host opens the settle room (or gets the one already open). */
export async function startSettlement(userId: string, gameId: string): Promise<R<true>> {
  const g = await memberGame(userId, gameId);
  if (!g.ok) return g;
  const game = g.value;
  if (game.status === 'SETTLED') return fail(409, 'ALREADY_SETTLED');
  if (!mayStart(game, userId)) return fail(403, 'NOT_HOST');
  await expireStale(gameId);
  if (await Settlement.exists({ gameId: oid(gameId), status: 'OPEN' })) return ok(true);

  const players = owingPlayers(game.players);
  if (players.length < 2) return fail(409, 'NOTHING_TO_SETTLE');
  const payments = simplifyDebts(Object.fromEntries(players.map((p) => [p.userId, p.net])));
  const now = Date.now();
  try {
    await Settlement.create({
      gameId: oid(gameId), startedBy: oid(userId), startedAt: new Date(now), expiresAt: new Date(now + SETTLE_WINDOW_HOURS * 3600_000),
      players: players.map((p) => ({ userId: oid(p.userId), name: p.name, net: p.net })),
      payments: payments.map((p) => ({ from: oid(p.from), to: oid(p.to), amount: p.amount })),
    });
  } catch (e) {
    if ((e as { code?: number }).code !== 11000) throw e; // two hosts tapped together: the other room is the one
  }
  return ok(true);
}

/** Host closes the open room. Refused once anyone has confirmed, so a tap can never wipe their clicks (they take theirs back first). */
export async function cancelSettlement(userId: string, gameId: string): Promise<R<true>> {
  const g = await memberGame(userId, gameId);
  if (!g.ok) return g;
  if (!mayStart(g.value, userId)) return fail(403, 'NOT_HOST');
  const open = { gameId: oid(gameId), status: 'OPEN' };
  const done = await Settlement.findOneAndUpdate({ ...open, players: { $not: { $elemMatch: { readyAt: { $ne: null } } } } }, { $set: { status: 'CANCELLED', closedAt: new Date() } });
  if (done) return ok(true);
  return fail(409, (await Settlement.exists(open)) ? 'HAS_CONFIRMATIONS' : 'NOT_OPEN');
}

/**
 * My click (or taking it back). When the last player has clicked, ONE transaction marks the room and the game
 * SETTLED and moves every wallet by −net. Clicking twice, or two last clicks at once, changes the wallets once.
 */
export async function setReady(userId: string, gameId: string, ready: boolean): Promise<R<true>> {
  const g = await memberGame(userId, gameId);
  if (!g.ok) return g;
  await expireStale(gameId);
  const me = oid(userId);
  const session = await mongoose.startSession();
  let changed = false;
  try {
    await session.withTransaction(async () => {
      changed = false;
      const now = new Date();
      const room = (await Settlement.findOneAndUpdate(
        { gameId: oid(gameId), status: 'OPEN', expiresAt: { $gt: now }, players: { $elemMatch: { userId: me } } },
        ready ? { $set: { 'players.$[p].readyAt': now } } : { $unset: { 'players.$[p].readyAt': '' } },
        // the first click keeps its time: a second click on a ready player matches nothing
        { arrayFilters: [ready ? { 'p.userId': me, 'p.readyAt': null } : { 'p.userId': me }], returnDocument: 'after', session },
      ).lean()) as unknown as RoomDoc | null;
      if (!room) return;
      changed = true;
      if (!ready || !room.players.every((p) => p.readyAt)) return;

      if (room.players.reduce((n, p) => n + p.net, 0) !== 0) throw new Error('settlement nets do not sum to 0');
      const game = await GameSession.updateOne({ _id: room.gameId, status: { $ne: 'SETTLED' } }, { $set: { status: 'SETTLED', settledAt: now, settlementId: room._id } }, { session });
      if (game.modifiedCount !== 1) throw new Error('game is already settled');
      await Settlement.updateOne(
        { _id: room._id },
        { $set: { status: 'SETTLED', settledAt: now, players: room.players.map((p) => ({ ...p, walletDelta: -p.net })) } },
        { session },
      );
      const res = await User.bulkWrite(
        room.players.map((p) => ({ updateOne: { filter: { _id: p.userId }, update: { $inc: { walletBalance: -p.net } } } })),
        { session },
      );
      if (res.matchedCount !== room.players.length) throw new Error('a settling player has no user doc'); // abort: never settle half the wallets
    });
  } finally {
    await session.endSession();
  }
  if (changed) return ok(true);
  // Nothing changed: fine if it is already settled (a retry) or I had clicked already, otherwise there is no open room for me.
  const latest = (await Settlement.findOne({ gameId: oid(gameId) }).sort({ startedAt: -1 }).lean()) as unknown as RoomDoc | null;
  if (latest?.status === 'SETTLED') return ok(true);
  if (latest?.status === 'OPEN' && latest.players.some((p) => same(p.userId, userId))) return ok(true);
  return fail(latest ? 409 : 404, latest ? 'NOT_OPEN' : 'NOT_FOUND');
}

export interface SettleView {
  game: { id: string; endedAt: Date; rounds: number; baseBet: number; status: 'PENDING' | 'SETTLED'; settledAt?: Date };
  canStart: boolean; // I may open or cancel a room for this game
  room: null | {
    status: RoomDoc['status'];
    startedBy: string;
    startedAt: Date;
    expiresAt: Date;
    settledAt?: Date;
    closedAt?: Date;
    players: { name: string; net: number; readyAt: Date | null; isMe: boolean; walletDelta?: number }[];
    payments: { from: string; to: string; amount: number; fromMe: boolean; toMe: boolean }[];
    mine: { needed: boolean; ready: boolean };
  };
}

/** What the settle screen shows: the open room if there is one, else the settled receipt, else the latest closed one. */
export async function loadView(userId: string, gameId: string): Promise<R<SettleView>> {
  const g = await memberGame(userId, gameId);
  if (!g.ok) return g;
  const game = g.value;
  await expireStale(gameId);
  const id = oid(gameId);
  const room = ((await Settlement.findOne({ gameId: id, status: 'OPEN' }).lean()) ??
    (await Settlement.findOne({ gameId: id, status: 'SETTLED' }).lean()) ??
    (await Settlement.findOne({ gameId: id }).sort({ startedAt: -1 }).lean())) as unknown as RoomDoc | null;

  const nameOf = (uid: unknown) => game.players.find((p) => same(p.userId, uid))?.name ?? room?.players.find((p) => same(p.userId, uid))?.name ?? 'Player';
  const status = game.status === 'SETTLED' ? 'SETTLED' : 'PENDING';
  return ok({
    game: { id: String(game._id), endedAt: game.endedAt, rounds: game.rounds, baseBet: game.baseBet, status, settledAt: game.settledAt },
    canStart: status === 'PENDING' && mayStart(game, userId),
    room: room && {
      status: room.status,
      startedBy: nameOf(room.startedBy),
      startedAt: room.startedAt,
      expiresAt: room.expiresAt,
      settledAt: room.settledAt,
      closedAt: room.closedAt,
      players: room.players.map((p) => ({ name: p.name, net: p.net, readyAt: p.readyAt ?? null, isMe: same(p.userId, userId), walletDelta: p.walletDelta })),
      payments: room.payments.map((p) => ({ from: nameOf(p.from), to: nameOf(p.to), amount: p.amount, fromMe: same(p.from, userId), toMe: same(p.to, userId) })),
      mine: { needed: room.players.some((p) => same(p.userId, userId)), ready: room.players.some((p) => same(p.userId, userId) && !!p.readyAt) },
    },
  });
}

export interface OpenRoom { gameId: string; endedAt: Date; ready: number; total: number; mineReady: boolean }

/** Open settle rooms that are waiting on me (for the banner on Home). */
export async function listOpen(userId: string): Promise<OpenRoom[]> {
  await expireStale();
  const rooms = (await Settlement.find({ status: 'OPEN', players: { $elemMatch: { userId: oid(userId) } } }).lean()) as unknown as RoomDoc[];
  const games = (await GameSession.find({ _id: { $in: rooms.map((r) => r.gameId) } }, { endedAt: 1 }).lean()) as unknown as { _id: unknown; endedAt: Date }[];
  return rooms.map((r) => ({
    gameId: String(r.gameId),
    endedAt: games.find((x) => same(x._id, r.gameId))?.endedAt ?? r.startedAt,
    ready: r.players.filter((p) => p.readyAt).length,
    total: r.players.length,
    mineReady: r.players.some((p) => same(p.userId, userId) && !!p.readyAt),
  }));
}
