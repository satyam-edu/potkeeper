import { cleanName, issueToken, json } from '../_lib/auth';
import { connectDb } from '../_lib/db';
import { User } from '../_lib/models';

/** POST /api/auth/guest  { name } → { token, user } */
export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
  const name = cleanName(body?.name);
  if (!name) return json({ error: 'NAME_REQUIRED' }, 400);
  try {
    await connectDb();
    const user = await User.create({ name, isGuest: true });
    const id = String(user._id);
    return json({ token: await issueToken(id, name), user: { id, name, isGuest: true, walletBalance: 0 } }, 201);
  } catch (e) {
    console.error('guest login failed', e);
    return json({ error: 'SERVER_ERROR' }, 500);
  }
}
