import { describe, expect, it } from 'vitest';
import { nextNameChange } from './_lib/auth';
import { GET, PATCH } from './me';

describe('GET /api/me auth', () => {
  const get = (h: Record<string, string> = {}) => GET(new Request('http://x/api/me', { headers: h }));
  it('rejects missing and garbage tokens before touching the database', async () => {
    process.env.JWT_SECRET = 'test-secret';
    expect((await get()).status).toBe(401);
    expect((await get({ authorization: 'Bearer nope' })).status).toBe(401);
  });
});

describe('PATCH /api/me validation', () => {
  const patch = (body: string, h: Record<string, string> = {}) => PATCH(new Request('http://x/api/me', { method: 'PATCH', body, headers: h }));
  it('rejects a blank name and a missing token before touching the database', async () => {
    process.env.JWT_SECRET = 'test-secret';
    expect((await patch('{}')).status).toBe(400);
    expect((await patch('{"name":"   "}')).status).toBe(400);
  });
});

describe('nextNameChange', () => {
  const day = 86400_000;
  const now = Date.parse('2026-11-02T00:00:00Z');
  it('is null when never changed or a week has passed, else the date the week ends', () => {
    expect(nextNameChange(undefined, now)).toBeNull();
    expect(nextNameChange(new Date(now - 7 * day), now)).toBeNull();
    expect(nextNameChange(new Date(now - 2 * day), now)).toBe(new Date(now + 5 * day).toISOString());
  });
});
