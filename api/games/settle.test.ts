import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { signBody } from '../../shared/hmac';
import { connectDb } from '../_lib/db';
import { GameSession, User } from '../_lib/models';
import { parseSettle } from '../_lib/settle';
import { POST } from './settle';

try { process.loadEnvFile('.env'); } catch { /* no .env: live tests are skipped */ }
const live = !!process.env.MONGODB_URI;
process.env.SETTLE_SECRET = 'test-settle-secret';

const id = () => String(new mongoose.Types.ObjectId());
const payload = (players: { userId: string; net: number }[], sessionId = 's1') => ({
  sessionId, roomCode: '4829', baseBet: 5, rounds: 3, endedAt: new Date().toISOString(),
  players: players.map((p) => ({ ...p, name: 'P', cashedOut: false })),
});
const post = async (body: unknown, sign = true) => {
  const raw = JSON.stringify(body);
  const headers: Record<string, string> = sign ? { 'x-signature': await signBody(raw, process.env.SETTLE_SECRET!) } : {};
  return POST(new Request('http://x/api/games/settle', { method: 'POST', headers, body: raw }));
};

describe('settle validation (no database)', () => {
  const [a, b] = [id(), id()];
  it('rejects unsigned and wrongly signed requests', async () => {
    expect((await post(payload([{ userId: a, net: 5 }, { userId: b, net: -5 }]), false)).status).toBe(401);
    const bad = await POST(new Request('http://x', { method: 'POST', headers: { 'x-signature': 'a'.repeat(64) }, body: '{}' }));
    expect(bad.status).toBe(401);
  });
  it('rejects bad bodies: Σnet ≠ 0, non-integer, duplicate player, one player', async () => {
    expect((await post(payload([{ userId: a, net: 5 }, { userId: b, net: -4 }]))).status).toBe(400);
    expect(parseSettle(payload([{ userId: a, net: 2.5 }, { userId: b, net: -2.5 }]))).toBeNull();
    expect(parseSettle(payload([{ userId: a, net: 5 }, { userId: a, net: -5 }]))).toBeNull();
    expect(parseSettle(payload([{ userId: a, net: 0 }]))).toBeNull();
    expect(parseSettle(payload([{ userId: a, net: 5 }, { userId: b, net: -5 }]))).not.toBeNull();
  });
});

describe.skipIf(!live)('POST /api/games/settle (live Mongo)', () => {
  beforeAll(async () => { await connectDb('potkeeper_test_settle'); await User.deleteMany({}); await GameSession.deleteMany({}); });
  afterAll(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });

  it('credits wallets and saves the game once, however many times it is posted', async () => {
    const [w, l] = await User.create([{ name: 'W', walletBalance: 10 }, { name: 'L' }]);
    const body = payload([{ userId: String(w!._id), net: 14 }, { userId: String(l!._id), net: -14 }], 'once');

    expect(await (await post(body)).json()).toMatchObject({ ok: true, duplicate: false });
    expect(await (await post(body)).json()).toMatchObject({ ok: true, duplicate: true });

    expect((await User.findById(w!._id))!.walletBalance).toBe(24);
    expect((await User.findById(l!._id))!.walletBalance).toBe(-14);
    expect(await GameSession.countDocuments({ sessionId: 'once' })).toBe(1);
  });
});
