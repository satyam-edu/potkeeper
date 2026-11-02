import { cleanName, currentUser, issueToken, json, nameCooldownCutoff, nextNameChange } from './_lib/auth.js';
import { User } from './_lib/models.js';

/** GET /api/me → the signed-in user's own profile (incl. their Google email) and wallet. 401 if the token is bad or the account was merged away. */
export async function GET(request: Request): Promise<Response> {
  try {
    const u = await currentUser(request);
    if (!u) return json({ error: 'UNAUTHORIZED' }, 401);
    return json({ id: String(u._id), name: u.name, isGuest: u.isGuest, email: u.email, walletBalance: u.walletBalance, avatarUrl: u.avatarUrl, nextNameChange: nextNameChange(u.nameChangedAt) });
  } catch (e) {
    console.error('me failed', e);
    return json({ error: 'SERVER_ERROR' }, 500);
  }
}

/** PATCH /api/me  { name } → { token, name, nextNameChange }. Google accounts only, one change per week (429 COOLDOWN with the date). */
export async function PATCH(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
  const name = cleanName(body?.name);
  if (!name) return json({ error: 'NAME_REQUIRED' }, 400);
  try {
    const u = await currentUser(request);
    if (!u) return json({ error: 'UNAUTHORIZED' }, 401);
    if (u.isGuest) return json({ error: 'GOOGLE_ONLY' }, 403);
    const id = String(u._id);
    if (name === u.name) return json({ token: await issueToken(id, name), name, nextNameChange: nextNameChange(u.nameChangedAt) }); // nothing to change, no cooldown used
    // The cooldown check is part of the update, so two quick requests can't both pass.
    const now = new Date();
    const updated = await User.findOneAndUpdate(
      { _id: u._id, isGuest: false, $or: [{ nameChangedAt: null }, { nameChangedAt: { $lte: nameCooldownCutoff(now.getTime()) } }] },
      { $set: { name, nameChangedAt: now } },
      { new: true },
    );
    if (!updated) return json({ error: 'COOLDOWN', nextNameChange: nextNameChange(u.nameChangedAt) }, 429);
    return json({ token: await issueToken(id, name), name, nextNameChange: nextNameChange(now) });
  } catch (e) {
    console.error('rename failed', e);
    return json({ error: 'SERVER_ERROR' }, 500);
  }
}
