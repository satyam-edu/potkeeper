import { describe, expect, it } from 'vitest';
import { createRoom, reduce } from '../../shared/engine';
import { roundNets, roundWinners, seatNet } from './roundResult';

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
  it('roundNets: winner nets pot minus own stake, losers net their stake; seatNet tracks the live round', () => {
    let s = createRoom('1', 'a', 'A', 5);
    for (const id of ['b', 'c']) s = (reduce(s, { type: 'JOIN', name: id }, id) as { state: typeof s }).state;
    const play = (from: typeof s, a: Parameters<typeof reduce>[1], who: string) => {
      const r = reduce(from, a, who);
      if (!r.ok) throw new Error(r.error);
      return r.state;
    };
    const started = play(s, { type: 'START_ROUND', sessionId: 'x' }, 'a');
    expect(roundNets(s, started)).toBeNull();
    const bet = play(started, { type: 'BET' }, 'a');
    expect(seatNet(bet, bet.players[0]!, null)).toBe(-10);
    const packed = play(play(bet, { type: 'PACK' }, 'b'), { type: 'PACK' }, 'c');
    expect(roundNets(bet, packed)).toEqual({ a: 10, b: -5, c: -5 });
    expect(seatNet(packed, packed.players[0]!, { a: 10 })).toBe(10);
  });
});
