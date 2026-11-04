import { currentUser, json } from './_lib/auth.js';
import { isAdmin, listOpen, loadView, startSettlement } from './_lib/settlements.js';

/** GET /api/settlements?gameId=… → the settle screen for that game (open room, receipt or latest closed room).
 *  GET /api/settlements → the open rooms waiting on me. */
export async function GET(request: Request): Promise<Response> {
  try {
    const me = await currentUser(request);
    if (!me) return json({ error: 'UNAUTHORIZED' }, 401);
    const gameId = new URL(request.url).searchParams.get('gameId');
    if (!gameId) return json({ open: await listOpen(String(me._id)) });
    const r = await loadView(String(me._id), gameId, isAdmin(me));
    return r.ok ? json(r.value) : json({ error: r.error }, r.status);
  } catch (e) {
    console.error('settlements get failed', e);
    return json({ error: 'SERVER_ERROR' }, 500);
  }
}

/** POST /api/settlements  { gameId } → host opens the settle room (idempotent), answers with the screen. */
export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { gameId?: unknown } | null;
  if (typeof body?.gameId !== 'string') return json({ error: 'BAD_REQUEST' }, 400);
  try {
    const me = await currentUser(request);
    if (!me) return json({ error: 'UNAUTHORIZED' }, 401);
    const started = await startSettlement(String(me._id), body.gameId);
    if (!started.ok) return json({ error: started.error }, started.status);
    const r = await loadView(String(me._id), body.gameId, isAdmin(me));
    return r.ok ? json(r.value, 201) : json({ error: r.error }, r.status);
  } catch (e) {
    console.error('settlements start failed', e);
    return json({ error: 'SERVER_ERROR' }, 500);
  }
}
