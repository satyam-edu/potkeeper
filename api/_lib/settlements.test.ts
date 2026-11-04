import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { connectDb } from './db';
import { GameSession, Settlement, User } from './models';
import { parseSettle } from './settle';
import { cancelSettlement, forceSettle, isAdmin, listOpen, loadView, mayStart, owingPlayers, setReady, startSettlement } from './settlements';

try { process.loadEnvFile('.env'); } catch { /* no .env: live tests are skipped */ }
const live = !!process.env.MONGODB_URI;

describe('owingPlayers / mayStart (no database)', () => {
  const id = () => new mongoose.Types.ObjectId();
  it('skips players at ₹0 and folds one user listed twice', () => {
    const [a, b, c] = [id(), id(), id()];
    const out = owingPlayers([{ userId: a, name: 'A', net: 10 }, { userId: b, name: 'B', net: 0 }, { userId: c, name: 'C', net: -4 }, { userId: a, name: 'A', net: -6 }]);
    expect(out).toEqual([{ userId: String(a), name: 'A', net: 4 }, { userId: String(c), name: 'C', net: -4 }]);
    expect(owingPlayers([{ userId: a, name: 'A', net: 5 }, { userId: a, name: 'A', net: -5 }])).toEqual([]);
  });
  it('only the host may start; a game without a recorded host lets any player', () => {
    const host = id();
    const game = { _id: id(), hostId: host, endedAt: new Date(), rounds: 1, baseBet: 1, players: [] };
    expect(mayStart(game, String(host))).toBe(true);
    expect(mayStart(game, String(id()))).toBe(false);
    expect(mayStart({ ...game, hostId: undefined }, String(id()))).toBe(true);
  });
  it('admin is a Google login whose email is in ADMIN_EMAILS (any case); guests and others are not', () => {
    process.env.ADMIN_EMAILS = 'Dev@x.com, other@x.com';
    expect(isAdmin({ googleId: 'g', email: 'dev@X.com' })).toBe(true);
    expect(isAdmin({ googleId: 'g', email: 'nope@x.com' })).toBe(false);
    expect(isAdmin({ email: 'dev@x.com' })).toBe(false); // no googleId
    expect(isAdmin({})).toBe(false);
    delete process.env.ADMIN_EMAILS;
    expect(isAdmin({ googleId: 'g', email: 'dev@x.com' })).toBe(false);
  });
  it('the settle payload accepts a host id and rejects a bad one', () => {
    const [a, b] = [String(id()), String(id())];
    const body = (hostId?: string) => ({ sessionId: 's', roomCode: '1', hostId, baseBet: 1, rounds: 1, endedAt: new Date().toISOString(), players: [{ userId: a, name: 'A', net: 1, cashedOut: false }, { userId: b, name: 'B', net: -1, cashedOut: false }] });
    expect(parseSettle(body(a))?.hostId).toBe(a);
    expect(parseSettle(body())).not.toBeNull();
    expect(parseSettle(body('nope'))).toBeNull();
  });
});

describe.skipIf(!live)('settle room (live Mongo)', () => {
  beforeAll(async () => { await connectDb('potkeeper_test_settlements'); });
  afterAll(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });

  /** A saved game of four: host p1 +22, p2 −10, p3 −12, p4 at ₹0. Wallets start at what saving left them. */
  it('the database refuses a second OPEN room for one game', async () => {
    await Settlement.init();
    const { users: [p1], gameId } = await game([3, -3]) as { users: [string]; gameId: string };
    const room = { gameId, startedBy: p1, startedAt: new Date(), expiresAt: new Date(Date.now() + 1e6), players: [] };
    await Settlement.create(room);
    await expect(Settlement.create(room)).rejects.toMatchObject({ code: 11000 });
    await Settlement.create({ ...room, status: 'CANCELLED' }); // closed ones can pile up
  });

  async function game(nets = [22, -10, -12, 0]) {
    const users = (await User.create(nets.map((n, i) => ({ name: `P${i + 1}`, walletBalance: n })))) as { _id: mongoose.Types.ObjectId; name: string }[];
    const g = await GameSession.create({
      sessionId: String(new mongoose.Types.ObjectId()), baseBet: 1, rounds: 5, endedAt: new Date(), hostId: users[0]!._id,
      players: users.map((u, i) => ({ userId: u._id, name: u.name, net: nets[i] })),
    });
    return { users: users.map((u) => String(u._id)), gameId: String(g._id) };
  }
  const wallet = async (id: string) => (await User.findById(id))!.walletBalance;

  it('whole flow: host opens, everyone clicks, the last click settles once and moves every wallet', async () => {
    const { users: [p1, p2, p3, p4], gameId } = await game() as { users: [string, string, string, string]; gameId: string };

    expect(await startSettlement(p2, gameId)).toMatchObject({ ok: false, error: 'NOT_HOST' });
    expect(await startSettlement(String(new mongoose.Types.ObjectId()), gameId)).toMatchObject({ ok: false, status: 404 });
    expect(await startSettlement(p1, gameId)).toMatchObject({ ok: true });
    expect(await startSettlement(p1, gameId)).toMatchObject({ ok: true }); // tapping again opens nothing new
    expect(await Settlement.countDocuments({ gameId })).toBe(1);

    const view = await loadView(p1, gameId);
    expect(view.ok && view.value.room?.players.map((p) => p.name)).toEqual(['P1', 'P2', 'P3']); // P4 at ₹0 is not asked
    expect(view.ok && view.value.room?.payments).toEqual([
      { from: 'P3', to: 'P1', amount: 12, fromMe: false, toMe: true },
      { from: 'P2', to: 'P1', amount: 10, fromMe: false, toMe: true },
    ]);
    expect(await setReady(p4, gameId, true)).toMatchObject({ ok: false }); // nothing to confirm

    await setReady(p2, gameId, true);
    await setReady(p2, gameId, false); // changed my mind
    await setReady(p2, gameId, true);
    await setReady(p1, gameId, true);
    expect(await wallet(p1)).toBe(22); // not settled yet, nothing moved
    expect((await loadView(p3, gameId) as { value: { game: { status: string } } }).value.game.status).toBe('PENDING');
    expect((await listOpen(p3))).toMatchObject([{ gameId, ready: 2, total: 3, mineReady: false }]);

    expect(await setReady(p3, gameId, true)).toMatchObject({ ok: true });
    expect(await setReady(p3, gameId, true)).toMatchObject({ ok: true }); // a retry changes nothing
    expect(await setReady(p3, gameId, false)).toMatchObject({ ok: true });

    expect([await wallet(p1), await wallet(p2), await wallet(p3), await wallet(p4)]).toEqual([0, 0, 0, 0]);
    const done = await loadView(p2, gameId);
    expect(done.ok && done.value.game.status).toBe('SETTLED');
    expect(done.ok && done.value.room).toMatchObject({ status: 'SETTLED', players: [{ walletDelta: -22 }, { walletDelta: 10 }, { walletDelta: 12 }] });
    expect(done.ok && done.value.room?.players.every((p) => p.readyAt)).toBe(true);
    expect(await startSettlement(p1, gameId)).toMatchObject({ ok: false, error: 'ALREADY_SETTLED' });
    expect(await listOpen(p1)).toEqual([]);
  });

  it('the wallet only drops the settled game: +22 and −10 leave +22', async () => {
    const u = (await User.create([{ name: 'W', walletBalance: 12 }, { name: 'L', walletBalance: -10 }, { name: 'X', walletBalance: -2 }])) as { _id: mongoose.Types.ObjectId }[];
    const [w, l, x] = u.map((z) => String(z._id)) as [string, string, string];
    const mk = async (nets: number[], ids: string[]) => String((await GameSession.create({
      sessionId: String(new mongoose.Types.ObjectId()), baseBet: 1, rounds: 1, endedAt: new Date(), hostId: w,
      players: ids.map((id, i) => ({ userId: id, name: 'n', net: nets[i] })),
    }))._id);
    const settledGame = await mk([-10, 10], [w, l]); // W lost 10 here
    await mk([22, -22], [w, x]);
    await setReady(w, settledGame, true) // no room yet
    await startSettlement(w, settledGame);
    await setReady(w, settledGame, true);
    await setReady(l, settledGame, true);
    expect(await wallet(w)).toBe(22);
    expect(await wallet(l)).toBe(-20);
  });

  it('two last clicks at the same moment settle once', async () => {
    const { users: [p1, p2, p3], gameId } = await game([10, -4, -6]) as { users: [string, string, string]; gameId: string };
    await startSettlement(p1, gameId);
    await setReady(p1, gameId, true);
    await Promise.all([setReady(p2, gameId, true), setReady(p3, gameId, true)]);
    expect([await wallet(p1), await wallet(p2), await wallet(p3)]).toEqual([0, 0, 0]);
    expect(await GameSession.countDocuments({ _id: gameId, status: 'SETTLED' })).toBe(1);
  });

  it('host cancels only while nobody has confirmed; a new room can open; an expired room cannot settle', async () => {
    const { users: [p1, p2], gameId } = await game([5, -5]) as { users: [string, string]; gameId: string };
    await startSettlement(p1, gameId);
    await setReady(p2, gameId, true);
    expect(await cancelSettlement(p2, gameId)).toMatchObject({ ok: false, error: 'NOT_HOST' });
    expect(await cancelSettlement(p1, gameId)).toMatchObject({ ok: false, error: 'HAS_CONFIRMATIONS' }); // a click is never wiped
    await setReady(p2, gameId, false);
    expect(await cancelSettlement(p1, gameId)).toMatchObject({ ok: true });
    expect(await setReady(p1, gameId, true)).toMatchObject({ ok: false, error: 'NOT_OPEN' });

    await startSettlement(p1, gameId); // a fresh room: nobody has clicked
    expect((await loadView(p1, gameId) as { value: { room: { players: { readyAt: unknown }[] } } }).value.room.players.every((p) => p.readyAt === null)).toBe(true);
    await Settlement.updateOne({ gameId, status: 'OPEN' }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await setReady(p1, gameId, true)).toMatchObject({ ok: false });
    expect((await loadView(p1, gameId) as { value: { room: { status: string } } }).value.room.status).toBe('EXPIRED');
    expect(await wallet(p1)).toBe(5);
    expect(await startSettlement(p1, gameId)).toMatchObject({ ok: true }); // and the host can try again
  });

  it('admin force settle: not a player, no room, one call settles every wallet once; others are refused', async () => {
    const { users: [p1, p2, p3], gameId } = await game([5, -3, -2]) as { users: [string, string, string]; gameId: string };
    const admin = String(new mongoose.Types.ObjectId()); // not in the game
    expect(await forceSettle(admin, gameId, false)).toMatchObject({ ok: false, error: 'NOT_ADMIN' });
    expect(await forceSettle(admin, gameId, true)).toMatchObject({ ok: true });
    expect(await forceSettle(admin, gameId, true)).toMatchObject({ ok: true }); // a retry changes nothing
    expect([await wallet(p1), await wallet(p2), await wallet(p3)]).toEqual([0, 0, 0]);
    expect(await GameSession.countDocuments({ _id: gameId, status: 'SETTLED' })).toBe(1);
    expect(await loadView(admin, gameId, false)).toMatchObject({ ok: false, status: 404 });
    expect(await loadView(admin, gameId, true)).toMatchObject({ ok: true });
  });
});
