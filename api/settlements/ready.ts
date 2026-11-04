import { currentUser, json } from '../_lib/auth.js';
import { forceSettle, isAdmin, loadView, setReady } from '../_lib/settlements.js';

/** POST /api/settlements/ready  { gameId, ready } → my click (or taking it back). The last click settles the game.
 *  { gameId, force: true } → admin accounts only: settle the game right now. */
export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { gameId?: unknown; ready?: unknown; force?: unknown } | null;
  if (typeof body?.gameId !== 'string' || (typeof body.ready !== 'boolean' && body.force !== true)) return json({ error: 'BAD_REQUEST' }, 400);
  try {
    const me = await currentUser(request);
    if (!me) return json({ error: 'UNAUTHORIZED' }, 401);
    const done = body.force === true ? await forceSettle(String(me._id), body.gameId, isAdmin(me)) : await setReady(String(me._id), body.gameId, body.ready as boolean);
    if (!done.ok) return json({ error: done.error }, done.status);
    const r = await loadView(String(me._id), body.gameId, isAdmin(me));
    return r.ok ? json(r.value) : json({ error: r.error }, r.status);
  } catch (e) {
    console.error('settlements ready failed', e);
    return json({ error: 'SERVER_ERROR' }, 500);
  }
}
