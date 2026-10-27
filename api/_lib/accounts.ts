import mongoose from 'mongoose';
import { GameSession, User } from './models';

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

/**
 * Find or create the Google user, folding in the caller's guest account if they had one.
 *  - new Google user + guest      → the guest doc is upgraded in place (same _id, nothing to move)
 *  - existing Google user + guest → wallet + history move over in ONE transaction; guest becomes a tombstone
 * Safe to repeat: a merged guest is skipped, so a retry can't double-count the wallet.
 */
export async function signInWithGoogle(profile: GoogleProfile, guestId?: string) {
  const existing = await User.findOne({ googleId: profile.googleId });
  const guest =
    guestId && mongoose.isValidObjectId(guestId)
      ? await User.findOne({ _id: guestId, isGuest: true, googleId: { $exists: false }, mergedInto: { $exists: false } })
      : null;

  if (!existing) {
    if (guest) {
      Object.assign(guest, { googleId: profile.googleId, email: profile.email, avatarUrl: profile.avatarUrl, isGuest: false });
      return guest.save();
    }
    return User.create({ ...profile, isGuest: false });
  }

  if (guest && !guest._id.equals(existing._id)) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await User.updateOne({ _id: existing._id }, { $inc: { walletBalance: guest.walletBalance } }, { session });
        await GameSession.updateMany(
          { 'players.userId': guest._id },
          { $set: { 'players.$[p].userId': existing._id } },
          { arrayFilters: [{ 'p.userId': guest._id }], session },
        );
        await User.updateOne({ _id: guest._id }, { $set: { walletBalance: 0, mergedInto: existing._id } }, { session });
      });
    } finally {
      await session.endSession();
    }
  }
  return User.findById(existing._id);
}
