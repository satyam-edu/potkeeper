import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { connectDb } from './_lib/db';
import { FEEDBACK_MAX, FEEDBACK_PER_DAY, parseFeedback } from './_lib/feedback';
import { issueToken } from './_lib/auth';
import { Feedback, User } from './_lib/models';
import { buildFeedbackEmail, sendFeedbackEmail } from './_lib/mail';
import { POST } from './feedback';

try { process.loadEnvFile('.env'); } catch { /* no .env: live tests are skipped */ }
const live = !!process.env.MONGODB_URI;
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
process.env.RESEND_API_KEY = ''; // tests never send real email, even if .env has a key

describe('parseFeedback (no database)', () => {
  it('accepts a known type with a message of 3 to 500 characters, trimmed', () => {
    expect(parseFeedback({ type: 'BUG', message: '  Pot shows wrong  ' })).toEqual({ type: 'BUG', message: 'Pot shows wrong' });
    expect(parseFeedback({ type: 'FEATURE', message: 'x'.repeat(FEEDBACK_MAX) })).not.toBeNull();
  });
  it('a missing type means MESSAGE (the form has no category any more)', () => {
    expect(parseFeedback({ message: 'add a dark mode' })).toEqual({ type: 'MESSAGE', message: 'add a dark mode' });
  });
  it('rejects bad types, empty, too short, too long and non text', () => {
    expect(parseFeedback({ type: 'SPAM', message: 'hello there' })).toBeNull();
    expect(parseFeedback({ type: 'BUG', message: '   ' })).toBeNull();
    expect(parseFeedback({ type: 'BUG', message: 'hi' })).toBeNull();
    expect(parseFeedback({ type: 'BUG', message: 'x'.repeat(FEEDBACK_MAX + 1) })).toBeNull();
    expect(parseFeedback({ type: 'BUG', message: 42 })).toBeNull();
    expect(parseFeedback(null)).toBeNull();
  });
  it('drops control characters but keeps new lines', () => {
    expect(parseFeedback({ type: 'MESSAGE', message: 'a\u0000b\nc\u0007d' })?.message).toBe('ab\ncd');
  });
});

describe('feedback email (no network)', () => {
  const mail = { type: 'BUG' as const, message: 'Pot shows <b>wrong</b>\nsecond line', name: 'Sat\nyam', email: 'sat@x.com', userId: 'u1', at: new Date('2026-11-03T00:00:00Z') };
  it('escapes what the user typed and keeps the subject on one line', () => {
    const m = buildFeedbackEmail(mail);
    expect(m.html).toContain('Pot shows &lt;b&gt;wrong&lt;/b&gt;');
    expect(m.html).not.toContain('<b>wrong');
    expect(m.subject).toBe('PotKeeper Bug report from Sat yam: Pot shows <b>wrong</b> second line');
    expect(m.subject).not.toContain('\n');
    expect(m.text).toContain('From: Sat\nyam <sat@x.com>');
    expect(m.html).toContain('2026-11-03 05:30 IST');
  });
  it('skips without a key, sends to the developer with the user as reply to, and reports failures', async () => {
    expect(await sendFeedbackEmail(mail)).toBe('skipped');
    process.env.RESEND_API_KEY = 're_test';
    let body: Record<string, unknown> = {};
    const ok = (async (_u, init) => { body = JSON.parse(String(init?.body)); return new Response('{}', { status: 200 }); }) as typeof fetch;
    expect(await sendFeedbackEmail(mail, ok)).toBe('sent');
    expect(body).toMatchObject({ to: ['live.feedback.users@gmail.com'], reply_to: 'sat@x.com' });
    expect(await sendFeedbackEmail(mail, (async () => new Response('no', { status: 403 })) as typeof fetch)).toBe('failed');
    expect(await sendFeedbackEmail(mail, (async () => { throw new Error('down'); }) as typeof fetch)).toBe('failed');
    process.env.RESEND_API_KEY = '';
  });
});

describe('POST /api/feedback before the database', () => {
  const post = (body: unknown, token?: string) => POST(new Request('http://x/api/feedback', { method: 'POST', body: JSON.stringify(body), headers: token ? { authorization: `Bearer ${token}` } : {} }));
  it('400 for a bad body, 401 without a login', async () => {
    expect((await post({ type: 'BUG', message: '' })).status).toBe(400);
    expect((await post({ type: 'BUG', message: 'something broke' })).status).toBe(401);
  });
});

describe.skipIf(!live)('POST /api/feedback (live Mongo)', () => {
  beforeAll(async () => { await connectDb('potkeeper_test_feedback'); });
  afterAll(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  const send = async (userId: string, name: string, msg = 'Please add a dark mode toggle') =>
    POST(new Request('http://x/api/feedback', { method: 'POST', headers: { authorization: `Bearer ${await issueToken(userId, name)}` }, body: JSON.stringify({ type: 'FEATURE', message: msg }) }));

  it('guests are refused, Google users are saved, and the daily limit holds', async () => {
    const guest = await User.create({ name: 'G' });
    expect((await send(String(guest._id), 'G')).status).toBe(403);
    expect(await Feedback.countDocuments()).toBe(0);

    const google = await User.create({ name: 'Real', email: 'real@x.com', googleId: 'g-fb', isGuest: false });
    for (let i = 0; i < FEEDBACK_PER_DAY; i++) expect((await send(String(google._id), 'Real', `idea number ${i}`)).status).toBe(201);
    expect((await send(String(google._id), 'Real')).status).toBe(429);
    expect(await Feedback.countDocuments({ userId: google._id })).toBe(FEEDBACK_PER_DAY);
    expect(await Feedback.findOne({ userId: google._id })).toMatchObject({ name: 'Real', email: 'real@x.com', type: 'FEATURE' });
  });
});
