import { currentUser, json } from '../_lib/auth';
import { GameSession } from '../_lib/models';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/**
 * GET /api/me/history?limit=20&before=<ISO> → my finished games, newest first.
 * Each game: when, rounds, base bet, MY net and every player's name + net. `next` is the `before` value for the next page (null = end).
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const me = await currentUser(request);
    if (!me) return json({ error: 'UNAUTHORIZED' }, 401);

    const q = new URL(request.url).searchParams;
    const limit = Math.min(Math.max(Math.floor(Number(q.get('limit'))) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const before = q.get('before') ? new Date(q.get('before')!) : null;
    if (before && Number.isNaN(before.getTime())) return json({ error: 'BAD_REQUEST' }, 400);

    // ponytail: cursor is endedAt alone; two games ending in the same millisecond could straddle a page edge. Add _id to the cursor if that ever matters.
    const rows = await GameSession.find({ 'players.userId': me._id, ...(before && { endedAt: { $lt: before } }) })
      .sort({ endedAt: -1 })
      .limit(limit + 1)
      .lean();
    const page = rows.slice(0, limit);

    const games = page.map((g) => {
      const mine = g.players.find((p: { userId: unknown }) => String(p.userId) === String(me._id));
      return {
        id: String(g._id),
        endedAt: g.endedAt,
        rounds: g.rounds,
        baseBet: g.baseBet,
        net: mine?.net ?? 0,
        players: g.players.map((p: { userId: unknown; name: string; net: number }) => ({ name: p.name, net: p.net, isMe: String(p.userId) === String(me._id) })),
      };
    });
    return json({ games, next: rows.length > limit ? page[page.length - 1]!.endedAt : null });
  } catch (e) {
    console.error('history failed', e);
    return json({ error: 'SERVER_ERROR' }, 500);
  }
}
