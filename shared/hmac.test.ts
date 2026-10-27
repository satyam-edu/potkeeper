import { describe, expect, it } from 'vitest';
import { signBody, verifyBody } from './hmac';

describe('hmac', () => {
  it('accepts its own signature, rejects tampering, wrong secret and junk', async () => {
    const sig = await signBody('{"a":1}', 's3cret');
    expect(await verifyBody('{"a":1}', sig, 's3cret')).toBe(true);
    expect(await verifyBody('{"a":2}', sig, 's3cret')).toBe(false);
    expect(await verifyBody('{"a":1}', sig, 'other')).toBe(false);
    expect(await verifyBody('{"a":1}', 'zz', 's3cret')).toBe(false);
    expect(await verifyBody('{"a":1}', null, 's3cret')).toBe(false);
  });
});
