import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { signInWithGoogle } from './accounts';
import { connectDb } from './db';
import { GameSession, User } from './models';

try { process.loadEnvFile('.env'); } catch { /* no .env: integration tests are skipped */ }
const live = !!process.env.MONGODB_URI;

// Runs against a throwaway database (potkeeper_test) on your Atlas cluster, and cleans up after itself.
describe.skipIf(!live)('guest → Google merge (live Mongo)', () => {
  beforeAll(async () => { await connectDb('potkeeper_test'); await User.deleteMany({}); await GameSession.deleteMany({}); });
  afterAll(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });

  const profile = (n: string) => ({ googleId: `g-${n}`, email: `${n}@x.com`, name: n });

  it('upgrades a guest in place when the Google account is new', async () => {
    const guest = await User.create({ name: 'Sid', walletBalance: 30 });
    const u = await signInWithGoogle(profile('new'), String(guest._id));
    expect(String(u!._id)).toBe(String(guest._id));
    expect(u).toMatchObject({ isGuest: false, googleId: 'g-new', walletBalance: 30 });
  });

  it('moves wallet + history into an existing Google account, once', async () => {
    const google = await User.create({ ...profile('old'), isGuest: false, walletBalance: 20 });
    const guest = await User.create({ name: 'G', walletBalance: 30 });
    const other = await User.create({ name: 'Other' });
    await GameSession.create({ sessionId: 's1', baseBet: 5, rounds: 2, endedAt: new Date(), players: [{ userId: guest._id, name: 'G', net: 30 }, { userId: other._id, name: 'Other', net: -30 }] });

    const u = await signInWithGoogle(profile('old'), String(guest._id));
    expect(u!.walletBalance).toBe(50);
    expect((await GameSession.findOne({ sessionId: 's1' }))!.players[0].userId.equals(google._id)).toBe(true);
    const tomb = await User.findById(guest._id);
    expect(tomb).toMatchObject({ walletBalance: 0 });
    expect(String(tomb!.mergedInto)).toBe(String(google._id));

    // retry with the same (now tombstoned) guest must not add the wallet again
    expect((await signInWithGoogle(profile('old'), String(guest._id)))!.walletBalance).toBe(50);
  });

  it('plain Google sign-in creates an account', async () => {
    expect(await signInWithGoogle(profile('fresh'))).toMatchObject({ isGuest: false, walletBalance: 0 });
  });
});
