import type { FeedbackType } from './feedback.js';

export interface FeedbackMail {
  type: FeedbackType;
  message: string;
  name: string;
  email?: string;
  userId: string;
  at: Date;
}

const LABEL: Record<FeedbackType, string> = { FEATURE: 'Feature idea', BUG: 'Bug report', MESSAGE: 'Message' };
const ACCENT: Record<FeedbackType, string> = { FEATURE: '#c6ff00', BUG: '#ff4d4d', MESSAGE: '#f2f2f2' };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ist = (d: Date) => new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 16).replace('T', ' ') + ' IST';

/** Subject, HTML and plain text for one feedback message. Everything the user typed is escaped; the subject has no line breaks. */
export function buildFeedbackEmail(m: FeedbackMail): { subject: string; html: string; text: string } {
  const label = LABEL[m.type];
  const snippet = m.message.replace(/\s+/g, ' ').slice(0, 60);
  const subject = `PotKeeper ${label} from ${m.name.replace(/\s+/g, ' ')}: ${snippet}`;
  const accent = ACCENT[m.type] === '#f2f2f2' ? '#0a0a0a' : ACCENT[m.type];
  const small = 'font-size:12px;line-height:1.7;color:#8a8a8a';
  const html = `<div style="background:#f2f2f2;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden">
    <div style="background:#0a0a0a;padding:18px 28px">
      <span style="font-size:20px;font-weight:800;color:#fff;letter-spacing:.5px">POT<span style="color:#c6ff00">KEEPER</span></span>
      <span style="float:right;background:${ACCENT[m.type]};color:#0a0a0a;font-size:12px;font-weight:700;padding:4px 10px;border-radius:99px">${esc(label.toUpperCase())}</span>
    </div>
    <div style="padding:32px 28px 20px">
      <div style="min-height:160px;font-size:19px;line-height:1.7;color:#111;white-space:pre-wrap;border-left:5px solid ${accent};padding:4px 0 4px 20px">${esc(m.message)}</div>
      <div style="margin-top:28px;border-top:1px solid #ececec;padding-top:12px;${small}">
        From ${esc(m.name)}${m.email ? ` &lt;<a href="mailto:${esc(m.email)}" style="color:#8a8a8a">${esc(m.email)}</a>&gt;` : ''}<br>
        ${ist(m.at)} &nbsp;&middot;&nbsp; id ${esc(m.userId)}${m.email ? '<br>Reply to this email to answer them directly.' : ''}
      </div>
    </div>
  </div>
</div>`;
  const text = `${label.toUpperCase()}\n\n${m.message}\n\nFrom: ${m.name}${m.email ? ` <${m.email}>` : ''}\nSent: ${ist(m.at)}\nUser id: ${m.userId}\n`;
  return { subject, html, text };
}

/**
 * Email the message to the developer through Resend's HTTP API (free plan, no package needed).
 * 'skipped' when no key is set, 'failed' on any error: the caller already stored the message, so nothing is lost.
 */
export async function sendFeedbackEmail(m: FeedbackMail, doFetch: typeof fetch = fetch): Promise<'sent' | 'failed' | 'skipped'> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return 'skipped';
  const { subject, html, text } = buildFeedbackEmail(m);
  try {
    const res = await doFetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: process.env.FEEDBACK_FROM || 'PotKeeper <feedback@potkeeper.tech>', // potkeeper.tech is verified in Resend
        to: [process.env.FEEDBACK_TO || 'live.feedback.users@gmail.com'],
        ...(m.email && { reply_to: m.email }),
        subject, html, text,
      }),
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) return 'sent';
    console.error('feedback email refused', res.status, await res.text().catch(() => ''));
    return 'failed';
  } catch (e) {
    console.error('feedback email failed', e);
    return 'failed';
  }
}
