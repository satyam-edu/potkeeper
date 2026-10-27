import mongoose from 'mongoose';
import { GameSession, User } from './models';

export interface SettlePlayer {
  userId: string;
  name: string;
  net: number;
  cashedOut: boolean;
}
export interface SettlePayload {
  sessionId: string;
  roomCode: string;
  baseBet: number;
  rounds: number;
  startedAt?: string;
  endedAt: string;
  players: SettlePlayer[];
}

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);
const isDate = (s: unknown): s is string => typeof s === 'string' && !Number.isNaN(Date.parse(s));

/** Trust boundary: returns a clean payload, or null if anything is off (shape, integers, Σ net ≠ 0, duplicate players). */
export function parseSettle(raw: unknown): SettlePayload | null {
  const b = raw as Partial<SettlePayload> | null;
  if (!b || typeof b !== 'object') return null;
  const { sessionId, roomCode, baseBet, rounds, startedAt, endedAt, players } = b;
  if (typeof sessionId !== 'string' || !sessionId || sessionId.length > 64) return null;
  if (!isInt(baseBet) || baseBet < 1 || !isInt(rounds) || rounds < 0) return null;
  if (!isDate(endedAt) || (startedAt !== undefined && !isDate(startedAt))) return null;
  if (!Array.isArray(players) || players.length < 2 || players.length > 10) return null;
  const ids = new Set<string>();
  let sum = 0;
  for (const p of players as SettlePlayer[]) {
    if (!p || !mongoose.isValidObjectId(p.userId) || !isInt(p.net) || typeof p.name !== 'string') return null;
    if (ids.has(p.userId)) return null;
    ids.add(p.userId);
    sum += p.net;
  }
  if (sum !== 0) return null;
  return {
    sessionId,
    roomCode: String(roomCode ?? ''),
    baseBet,
    rounds,
    startedAt,
    endedAt,
    players: (players as SettlePlayer[]).map((p) => ({ userId: p.userId, name: p.name.slice(0, 24), net: p.net, cashedOut: !!p.cashedOut })),
  };
}

/**
 * Save the game and credit every wallet in ONE transaction.
 * Idempotent on sessionId: a repeat returns { duplicate: true } and touches no wallet.
 */
export async function applySettle(p: SettlePayload): Promise<{ duplicate: boolean }> {
  if (await GameSession.exists({ sessionId: p.sessionId })) return { duplicate: true };
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await GameSession.create(
        [{ ...p, startedAt: p.startedAt && new Date(p.startedAt), endedAt: new Date(p.endedAt) }],
        { session },
      );
      const res = await User.bulkWrite(
        p.players.map((x) => ({ updateOne: { filter: { _id: x.userId }, update: { $inc: { walletBalance: x.net } } } })),
        { session },
      );
      if (res.matchedCount !== p.players.length) console.warn('settle: some players have no user doc', p.sessionId);
    });
    return { duplicate: false };
  } catch (e) {
    if ((e as { code?: number }).code === 11000) return { duplicate: true }; // lost a race with a concurrent retry
    throw e;
  } finally {
    await session.endSession();
  }
}
