import type { Payment } from './types';

/** Greedy debt simplification on integer nets (Σ net must be 0). At most n−1 payments. */
export function simplifyDebts(nets: Record<string, number>): Payment[] {
  const total = Object.values(nets).reduce((a, b) => a + b, 0);
  if (total !== 0 || !Object.values(nets).every(Number.isInteger)) throw new Error('nets must be integers summing to 0');
  const credit = Object.entries(nets).filter(([, v]) => v > 0).map(([id, v]) => ({ id, v }));
  const debt = Object.entries(nets).filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v }));
  const out: Payment[] = [];
  while (credit.length && debt.length) {
    credit.sort((a, b) => b.v - a.v);
    debt.sort((a, b) => b.v - a.v);
    const c = credit[0]!, d = debt[0]!;
    const amount = Math.min(c.v, d.v);
    out.push({ from: d.id, to: c.id, amount });
    c.v -= amount;
    d.v -= amount;
    if (c.v === 0) credit.shift();
    if (d.v === 0) debt.shift();
  }
  return out;
}
