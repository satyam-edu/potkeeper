export const FEEDBACK_TYPES = ['FEATURE', 'BUG', 'MESSAGE'] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];
export const FEEDBACK_MIN = 3;
export const FEEDBACK_MAX = 500;
export const FEEDBACK_PER_DAY = 5;

/** Trust boundary: a clean { type, message } or null. The app sends no type any more (one free text box), so a missing type means MESSAGE. Messages are only ever shown as plain text. */
export function parseFeedback(raw: unknown): { type: FeedbackType; message: string } | null {
  const b = raw as { type?: unknown; message?: unknown } | null;
  if (!b || typeof b.message !== 'string') return null;
  const type = b.type === undefined ? 'MESSAGE' : b.type;
  if (!FEEDBACK_TYPES.includes(type as FeedbackType)) return null;
  const message = b.message.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim(); // no control characters; new lines stay
  if (message.length < FEEDBACK_MIN || message.length > FEEDBACK_MAX) return null;
  return { type: type as FeedbackType, message };
}
