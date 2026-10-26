import { describe, expect, it } from 'vitest';
import { simplifyDebts } from './settle';

describe('simplifyDebts', () => {
  it('PRD example', () => {
    expect(simplifyDebts({ P1: 40, P2: -15, P3: -25 })).toEqual([
      { from: 'P3', to: 'P1', amount: 25 },
      { from: 'P2', to: 'P1', amount: 15 },
    ]);
  });
  it('≤ n−1 payments and every net clears, on random inputs', () => {
    let seed = 7;
    const rnd = (n: number) => ((seed = (seed * 1664525 + 1013904223) >>> 0) % n);
    for (let i = 0; i < 300; i++) {
      const n = 2 + rnd(9);
      const vals = Array.from({ length: n - 1 }, () => rnd(101) - 50);
      vals.push(-vals.reduce((a, b) => a + b, 0));
      const nets = Object.fromEntries(vals.map((v, k) => [`p${k}`, v]));
      const pay = simplifyDebts(nets);
      expect(pay.length).toBeLessThanOrEqual(n - 1);
      const left = { ...nets };
      for (const p of pay) { left[p.from]! += p.amount; left[p.to]! -= p.amount; }
      expect(Object.values(left).every((v) => v === 0)).toBe(true);
    }
  });
  it('rejects non-zero sums', () => {
    expect(() => simplifyDebts({ a: 1, b: 0 })).toThrow();
  });
});
