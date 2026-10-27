import { describe, expect, it } from 'vitest';
import { GET } from './me';

describe('GET /api/me auth', () => {
  const get = (h: Record<string, string> = {}) => GET(new Request('http://x/api/me', { headers: h }));
  it('rejects missing and garbage tokens before touching the database', async () => {
    process.env.JWT_SECRET = 'test-secret';
    expect((await get()).status).toBe(401);
    expect((await get({ authorization: 'Bearer nope' })).status).toBe(401);
  });
});
