import { currentUser, json } from './_lib/auth.js';
import { FEEDBACK_PER_DAY, parseFeedback } from './_lib/feedback.js';
import { sendFeedbackEmail } from './_lib/mail.js';
import { Feedback } from './_lib/models.js';

/** POST /api/feedback  { message } (type optional, default MESSAGE) → 201. Google accounts only (guests get 403), 5 a day each (429). Stored, then emailed to the developer. */
export async function POST(request: Request): Promise<Response> {
  const fb = parseFeedback(await request.json().catch(() => null));
  if (!fb) return json({ error: 'BAD_REQUEST' }, 400);
  try {
    const me = await currentUser(request);
    if (!me) return json({ error: 'UNAUTHORIZED' }, 401);
    if (me.isGuest) return json({ error: 'GOOGLE_ONLY' }, 403);
    const today = await Feedback.countDocuments({ userId: me._id, createdAt: { $gte: new Date(Date.now() - 86400_000) } });
    if (today >= FEEDBACK_PER_DAY) return json({ error: 'TOO_MANY' }, 429);
    // Stored first, so a failing mail service never loses a message; then emailed to the developer.
    const saved = await Feedback.create({ userId: me._id, name: me.name, email: me.email, ...fb });
    const sent = await sendFeedbackEmail({ ...fb, name: me.name, email: me.email, userId: String(me._id), at: saved.createdAt ?? new Date() });
    if (sent === 'sent') await Feedback.updateOne({ _id: saved._id }, { $set: { emailedAt: new Date() } });
    return json({ ok: true }, 201);
  } catch (e) {
    console.error('feedback failed', e);
    return json({ error: 'SERVER_ERROR' }, 500);
  }
}
