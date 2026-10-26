import { describe, expect, it } from 'vitest';
import { signJwt, verifyJwt } from './jwt';

const exp = Math.floor(Date.now() / 1000) + 60;
describe('jwt', () => {
  it('round-trips', async () => {
    const t = await signJwt({ sub: 'u1', name: 'Sid', exp }, 's3cret');
    expect(await verifyJwt(t, 's3cret')).toMatchObject({ sub: 'u1', name: 'Sid' });
  });
  it('rejects wrong secret, tampering, expiry and garbage', async () => {
    const t = await signJwt({ sub: 'u1', name: 'Sid', exp }, 's3cret');
    expect(await verifyJwt(t, 'other')).toBeNull();
    const [h, p, s] = t.split('.');
    const tampered = [h, p!.slice(0, -3) + (p!.at(-3) === 'A' ? 'B' : 'A') + p!.slice(-2), s].join('.');
    expect(await verifyJwt(tampered, 's3cret')).toBeNull();
    expect(await verifyJwt(await signJwt({ sub: 'u1', name: 'x', exp: 1 }, 's3cret'), 's3cret')).toBeNull();
    expect(await verifyJwt('nope', 's3cret')).toBeNull();
  });
});
