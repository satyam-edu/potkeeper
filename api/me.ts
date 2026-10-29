import { currentUser, json } from './_lib/auth.js';

/** GET /api/me → the signed-in user's own profile (incl. their Google email) and wallet. 401 if the token is bad or the account was merged away. */
export async function GET(request: Request): Promise<Response> {
  try {
    const u = await currentUser(request);
    if (!u) return json({ error: 'UNAUTHORIZED' }, 401);
    return json({ id: String(u._id), name: u.name, isGuest: u.isGuest, email: u.email, walletBalance: u.walletBalance, avatarUrl: u.avatarUrl });
  } catch (e) {
    console.error('me failed', e);
    return json({ error: 'SERVER_ERROR' }, 500);
  }
}
