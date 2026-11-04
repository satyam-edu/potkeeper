import { currentUser, json } from '../_lib/auth.js';
import { cancelSettlement, isAdmin, loadView } from '../_lib/settlements.js';

/** POST /api/settlements/cancel  { gameId } → host closes the open room (all clicks are cleared). */
export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { gameId?: unknown } | null;
  if (typeof body?.gameId !== 'string') return json({ error: 'BAD_REQUEST' }, 400);
  try {
    const me = await currentUser(request);
    if (!me) return json({ error: 'UNAUTHORIZED' }, 401);
    const done = await cancelSettlement(String(me._id), body.gameId);
    if (!done.ok) return json({ error: done.error }, done.status);
    const r = await loadView(String(me._id), body.gameId, isAdmin(me));
    return r.ok ? json(r.value) : json({ error: r.error }, r.status);
  } catch (e) {
    console.error('settlements cancel failed', e);
    return json({ error: 'SERVER_ERROR' }, 500);
  }
}
