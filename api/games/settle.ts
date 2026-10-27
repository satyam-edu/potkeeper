import { verifyBody } from '../../shared/hmac.js';
import { json } from '../_lib/auth.js';
import { connectDb } from '../_lib/db.js';
import { applySettle, parseSettle } from '../_lib/settle.js';

/** POST /api/games/settle (room server only). `X-Signature` = HMAC-SHA256(SETTLE_SECRET, raw body). */
export async function POST(request: Request): Promise<Response> {
  const secret = process.env.SETTLE_SECRET;
  if (!secret) return json({ error: 'SERVER_ERROR' }, 500);
  const raw = await request.text();
  if (!(await verifyBody(raw, request.headers.get('x-signature'), secret))) return json({ error: 'BAD_SIGNATURE' }, 401);

  let body: unknown;
  try { body = JSON.parse(raw); } catch { return json({ error: 'BAD_REQUEST' }, 400); }
  const payload = parseSettle(body);
  if (!payload) return json({ error: 'BAD_REQUEST' }, 400);

  try {
    await connectDb();
    return json({ ok: true, ...(await applySettle(payload)) });
  } catch (e) {
    console.error('settle failed', e);
    return json({ error: 'SERVER_ERROR' }, 500); // the room server retries
  }
}
