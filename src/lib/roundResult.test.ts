import { describe, expect, it } from 'vitest';
import { createRoom, reduce } from '../../shared/engine';
import { roundWinners, seatNet } from './roundResult';

describe('roundWinners', () => {
  it('reports the winner and their payout; nothing for other transitions', () => {
    let s = createRoom('1', 'a', 'A', 5);
    for (const id of ['b', 'c']) s = (reduce(s, { type: 'JOIN', name: id }, id) as { state: typeof s }).state;
    const play = (from: typeof s, a: Parameters<typeof reduce>[1], who: string) => {
      const r = reduce(from, a, who);
      if (!r.ok) throw new Error(r.error);
      return r.state;
    };
    const started = play(s, { type: 'START_ROUND', sessionId: 'x' }, 'a');
    expect(roundWinners(s, started)).toEqual([]);
    const packed = play(started, { type: 'PACK' }, 'a');
    const done = play(packed, { type: 'PACK' }, 'b');
    expect(roundWinners(packed, done)).toEqual([{ userId: 'c', name: 'c', gain: 15 }]);
  });
  it('seatNet: minus the stake while betting, the last round result between rounds (p1 packs at 2, p2 and p3 show at 10, p3 wins: p1 -2, p2 -10, p3 +12)', () => {
    let s = createRoom('1', 'p1', 'p1', 2);
    for (const id of ['p2', 'p3']) s = (reduce(s, { type: 'JOIN', name: id }, id) as { state: typeof s }).state;
    const play = (from: typeof s, a: Parameters<typeof reduce>[1], who: string) => {
      const r = reduce(from, a, who);
      if (!r.ok) throw new Error(r.error);
      return r.state;
    };
    let t = play(s, { type: 'START_ROUND', sessionId: 'x' }, 'p1');
    expect(seatNet(t, t.players[0]!)).toBe(-2);
    t = play(t, { type: 'PACK' }, 'p1');
    for (const id of ['p2', 'p3', 'p2', 'p3']) t = play(t, { type: 'BET' }, id); // levels 4, 6, 8, 10
    expect(seatNet(t, t.players[2]!)).toBe(-10);
    const done = play(t, { type: 'AWARD_POT', winnerIds: ['p3'] }, 'p2'); // p2 shows and tops up to 10
    expect(done.players.map((p) => seatNet(done, p))).toEqual([-2, -10, 12]);
    expect(roundWinners(t, done)).toEqual([{ userId: 'p3', name: 'p3', gain: 22 }]); // gain is the whole pot, the banner uses the net
  });
});
