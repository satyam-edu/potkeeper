import { describe, expect, it } from 'vitest';
import { cleanName } from '../_lib/auth';
import { POST } from './guest';

describe('cleanName', () => {
  it('trims, collapses spaces, caps length, rejects empties and non-strings', () => {
    expect(cleanName('  Sid   K ')).toBe('Sid K');
    expect(cleanName('x'.repeat(40))).toHaveLength(24);
    expect(cleanName('   ')).toBeNull();
    expect(cleanName(42)).toBeNull();
  });
});

describe('POST /api/auth/guest validation', () => {
  const req = (body: string) => new Request('http://x/api/auth/guest', { method: 'POST', body });
  it('rejects a missing name before touching the database', async () => {
    expect((await POST(req('{}'))).status).toBe(400);
    expect((await POST(req('not json'))).status).toBe(400);
  });
});
