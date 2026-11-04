import { describe, expect, it } from 'vitest';
import type { Player } from '../../shared/types';
import { buildRestore } from './restore';

const player = (userId: string, name: string): Player => ({ userId, name, seat: 0, status: 'ACTIVE', connected: true, sessionBalance: 0, roundBet: 0, cashedOut: false, wantsRejoin: false });
const room = [player('u1', 'Satyam'), player('u2', 'Raand Ka Aashiq'), player('u3', 'Goji')];
const backup = (over: object = {}) => JSON.stringify({
  round: 3, opener: 'goji', turn: 'satyam', currentBet: 4,
  seats: [{ name: 'Goji', total: -3, roundBet: 4 }, { name: 'Raand', total: 1, roundBet: 4, packed: true }, { name: 'Satyam', total: 2, roundBet: 0 }],
  log: [{ Satyam: 1, Raand: -1 }], ...over,
});

describe('buildRestore', () => {
  it('maps names (full or first name, any case) to the players in the room', () => {
    const r = buildRestore(backup(), room);
    if ('error' in r) throw new Error(r.error);
    expect(r.msg.seats.map((x) => x.userId)).toEqual(['u3', 'u2', 'u1']);
    expect(r.msg.opener).toBe('u3');
    expect(r.msg.turn).toBe('u1');
    expect(r.msg.log).toEqual([{ u1: 1, u2: -1 }]);
  });
  it('says who is missing from the room, or from the backup', () => {
    expect(buildRestore(backup({ opener: 'Bhaskar' }), room)).toEqual({ error: 'Not in this room yet: Bhaskar.' });
    expect(buildRestore(backup({ seats: [{ name: 'Goji', total: 0 }, { name: 'Satyam', total: 0 }] }), room)).toEqual({ error: 'In the room but not in the backup: Raand Ka Aashiq.' });
  });
  it('explains text that is not a backup', () => {
    expect(buildRestore('hello', room)).toEqual({ error: 'Could not read that text. Paste the whole backup.' });
    expect(buildRestore('{}', room)).toEqual({ error: 'The backup is missing the seats or the log.' });
  });
});
