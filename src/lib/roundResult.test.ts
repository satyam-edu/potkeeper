import { describe, expect, it } from 'vitest';
import { createRoom, reduce } from '../../shared/engine';
import { roundWinners } from './roundResult';

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
});
