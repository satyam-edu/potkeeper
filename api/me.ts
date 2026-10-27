import mongoose from 'mongoose';
import { bearerClaims, json } from './_lib/auth';
import { connectDb } from './_lib/db';
import { User } from './_lib/models';

/** GET /api/me → the signed-in user's profile and wallet. 401 if the token is bad or the account was merged away. */
export async function GET(request: Request): Promise<Response> {
  const claims = await bearerClaims(request);
  if (!claims || !mongoose.isValidObjectId(claims.sub)) return json({ error: 'UNAUTHORIZED' }, 401);
  try {
    await connectDb();
    const u = await User.findById(claims.sub);
    if (!u || u.mergedInto) return json({ error: 'UNAUTHORIZED' }, 401); // merged guests must sign in with Google
    return json({ id: String(u._id), name: u.name, isGuest: u.isGuest, walletBalance: u.walletBalance, avatarUrl: u.avatarUrl });
  } catch (e) {
    console.error('me failed', e);
    return json({ error: 'SERVER_ERROR' }, 500);
  }
}
