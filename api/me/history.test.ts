import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { issueToken } from '../_lib/auth';
import { connectDb } from '../_lib/db';
import { GameSession, User } from '../_lib/models';
import { applySettle } from '../_lib/settle';
import { GET } from './history';

try { process.loadEnvFile('.env'); } catch { /* no .env: live tests are skipped */ }
const live = !!process.env.MONGODB_URI;
process.env.JWT_SECRET = 'test-secret';

const get = async (user: { _id: unknown; name: string } | null, qs = '') => {
  const headers: Record<string, string> = user ? { authorization: `Bearer ${await issueToken(String(user._id), user.name)}` } : {};
  return GET(new Request(`http://x/api/me/history${qs}`, { headers }));
};

describe.skipIf(!live)('GET /api/me/history (live Mongo)', () => {
  beforeAll(async () => { await connectDb('potkeeper_test_history'); await User.deleteMany({}); await GameSession.deleteMany({}); });
  afterAll(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });

  it('needs a login', async () => {
    expect((await get(null)).status).toBe(401);
  });

  it('returns my games newest first with my net + co-players, and pages', async () => {
    const [me, a, b] = await User.create([{ name: 'Me' }, { name: 'Ann' }, { name: 'Bob' }]);
    const game = (n: number, day: number, mine: number) => ({
      sessionId: `g${n}`, baseBet: 5, rounds: n, endedAt: new Date(2026, 9, day),
      players: [{ userId: me!._id, name: 'Me', net: mine }, { userId: a!._id, name: 'Ann', net: -mine }],
    });
    await GameSession.create([game(1, 1, 10), game(2, 2, -5), game(3, 3, 20)]);
    await GameSession.create({ sessionId: 'not-mine', baseBet: 5, rounds: 1, endedAt: new Date(), players: [{ userId: a!._id, name: 'Ann', net: 5 }, { userId: b!._id, name: 'Bob', net: -5 }] });

    const p1 = await (await get(me!, '?limit=2')).json();
    expect(p1.games.map((g: { rounds: number }) => g.rounds)).toEqual([3, 2]);
    expect(p1.games[0]).toMatchObject({ net: 20, baseBet: 5, players: [{ name: 'Me', net: 20, isMe: true }, { name: 'Ann', net: -20, isMe: false }] });
    expect(p1.next).toBeTruthy();

    const p2 = await (await get(me!, `?limit=2&before=${p1.next}`)).json();
    expect(p2.games.map((g: { net: number }) => g.net)).toEqual([10]);
    expect(p2.next).toBeNull();
    expect((await get(me!, '?before=junk')).status).toBe(400);
  });

  it('wallet equals the sum of history nets after settled games', async () => {
    const [me, a] = await User.create([{ name: 'Sum' }, { name: 'Other' }]);
    const settle = (sessionId: string, net: number) => applySettle({
      sessionId, roomCode: '1', baseBet: 5, rounds: 1, endedAt: new Date().toISOString(),
      players: [{ userId: String(me!._id), name: 'Sum', net, cashedOut: false }, { userId: String(a!._id), name: 'Other', net: -net, cashedOut: false }],
    });
    await settle('w1', 14); await settle('w2', -6); await settle('w3', 3);
    const { games } = await (await get(me!)).json();
    expect(games.reduce((n: number, g: { net: number }) => n + g.net, 0)).toBe(11);
    expect((await User.findById(me!._id))!.walletBalance).toBe(11);
  });

  it('merged guests are refused', async () => {
    const g = await User.create({ name: 'Old', mergedInto: new mongoose.Types.ObjectId() });
    expect((await get(g)).status).toBe(401);
  });
});
