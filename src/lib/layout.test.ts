import { describe, expect, it } from 'vitest';
import { fromViewer, seatPositions } from './layout';

describe('seatPositions', () => {
  it('puts the viewer at bottom centre and spreads the rest without overlap', () => {
    for (let n = 2; n <= 6; n++) {
      const pos = seatPositions(n);
      expect(pos[0]!.left).toBeCloseTo(50);
      expect(pos[0]!.top).toBeGreaterThan(80);
      for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++)
          expect(Math.hypot(pos[i]!.left - pos[j]!.left, pos[i]!.top - pos[j]!.top)).toBeGreaterThan(20);
    }
  });
  it('goes clockwise: second seat is on the left of the viewer', () => {
    expect(seatPositions(4)[1]!.left).toBeLessThan(50);
  });
});

describe('fromViewer', () => {
  it('rotates keeping order', () => {
    const ps = ['a', 'b', 'c', 'd'].map((userId) => ({ userId }));
    expect(fromViewer(ps, 'c').map((p) => p.userId)).toEqual(['c', 'd', 'a', 'b']);
    expect(fromViewer(ps, 'zzz')).toBe(ps);
  });
});
