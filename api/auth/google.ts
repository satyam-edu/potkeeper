import { OAuth2Client } from 'google-auth-library';
import { verifyJwt } from '../../shared/jwt.js';
import { signInWithGoogle } from '../_lib/accounts.js';
import { issueToken, json } from '../_lib/auth.js';
import { connectDb } from '../_lib/db.js';

/** POST /api/auth/google  { idToken, guestToken? } → { token, user } */
export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { idToken?: unknown; guestToken?: unknown } | null;
  if (typeof body?.idToken !== 'string') return json({ error: 'ID_TOKEN_REQUIRED' }, 400);
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return json({ error: 'SERVER_ERROR' }, 500);

  let payload;
  try {
    const ticket = await new OAuth2Client(clientId).verifyIdToken({ idToken: body.idToken, audience: clientId });
    payload = ticket.getPayload();
  } catch {
    return json({ error: 'BAD_GOOGLE_TOKEN' }, 401); // wrong audience, expired, or forged
  }
  if (!payload?.sub || !payload.email || payload.email_verified === false) return json({ error: 'BAD_GOOGLE_TOKEN' }, 401);

  try {
    // Optional: the guest account to fold into this Google account (must be a valid token of ours).
    const secret = process.env.JWT_SECRET ?? '';
    const guest = typeof body.guestToken === 'string' ? await verifyJwt(body.guestToken, secret) : null;

    await connectDb();
    const user = await signInWithGoogle(
      { googleId: payload.sub, email: payload.email, name: (payload.name ?? payload.email.split('@')[0]!).slice(0, 24), avatarUrl: payload.picture },
      guest?.sub,
    );
    if (!user) return json({ error: 'SERVER_ERROR' }, 500);
    const id = String(user._id);
    return json({ token: await issueToken(id, user.name), user: { id, name: user.name, isGuest: false, walletBalance: user.walletBalance, avatarUrl: user.avatarUrl } });
  } catch (e) {
    console.error('google login failed', e);
    return json({ error: 'SERVER_ERROR' }, 500);
  }
}
