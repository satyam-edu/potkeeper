import { describe, expect, it } from 'vitest';
import { createRoom, reduce, checkInvariant, type Action } from './engine';
import type { RoomState } from './types';

const ids = ['p1', 'p2', 'p3', 'p4'];

function run(s: RoomState, a: Action, who: string): RoomState {
  const r = reduce(s, a, who);
  if (!r.ok) throw new Error(`${a.type} by ${who} failed: ${r.error}`);
  return r.state;
}
const code = (s: RoomState, a: Action, who: string) => {
  const r = reduce(s, a, who);
  return r.ok ? 'OK' : r.error;
};
const bal = (s: RoomState) => Object.fromEntries(s.players.map((p) => [p.userId, p.sessionBalance]));
const turn = (s: RoomState) => s.players[s.currentTurnIndex]!.userId;

function table(n: number, baseBet = 5): RoomState {
  let s = createRoom('4829', 'p1', 'P1', baseBet);
  for (const id of ids.slice(1, n)) s = run(s, { type: 'JOIN', name: id.toUpperCase() }, id);
  return s;
}
const started = (n: number, baseBet = 5) => run(table(n, baseBet), { type: 'START_ROUND', sessionId: 'sess' }, 'p1');

describe('start round', () => {
  it('deducts baseBet from everyone into the pot', () => {
    const s = started(3);
    expect(bal(s)).toEqual({ p1: -5, p2: -5, p3: -5 });
    expect(s.pot).toBe(15);
    expect(s.phase).toBe('BETTING');
    expect(turn(s)).toBe('p1');
  });
  it('needs the host and 2+ players', () => {
    expect(code(table(1), { type: 'START_ROUND', sessionId: 's' }, 'p1')).toBe('NOT_ENOUGH_PLAYERS');
    expect(code(table(2), { type: 'START_ROUND', sessionId: 's' }, 'p2')).toBe('NOT_HOST');
  });
});

describe('bet & turn order', () => {
  it('bet costs exactly baseBet and passes the turn', () => {
    const s = run(started(3), { type: 'BET' }, 'p1');
    expect(bal(s).p1).toBe(-10);
    expect(s.players[0]!.roundBet).toBe(10);
    expect(s.pot).toBe(20);
    expect(turn(s)).toBe('p2');
  });
  it('rejects out-of-turn BET and PACK', () => {
    const s = started(3);
    expect(code(s, { type: 'BET' }, 'p2')).toBe('NOT_YOUR_TURN');
    expect(code(s, { type: 'PACK' }, 'p3')).toBe('NOT_YOUR_TURN');
  });
  it('skips PACKED players', () => {
    let s = started(4);
    s = run(s, { type: 'PACK' }, 'p1');
    s = run(s, { type: 'PACK' }, 'p2');
    s = run(s, { type: 'BET' }, 'p3');
    s = run(s, { type: 'BET' }, 'p4');
    expect(turn(s)).toBe('p3');
  });
});

describe('pack & auto-win', () => {
  it('last ACTIVE wins the whole pot automatically', () => {
    let s = started(3);
    s = run(s, { type: 'PACK' }, 'p1');
    s = run(s, { type: 'PACK' }, 'p2');
    expect(s.phase).toBe('BETWEEN_ROUNDS');
    expect(bal(s)).toEqual({ p1: -5, p2: -5, p3: 10 });
    expect(s.pot).toBe(0);
  });
});

describe('award pot', () => {
  it('winner net = pot - own contribution (PRD ledger shape)', () => {
    let s = started(3, 1);
    s = run(s, { type: 'PACK' }, 'p1'); // out after entry: -1
    s = run(s, { type: 'BET' }, 'p2');
    s = run(s, { type: 'BET' }, 'p3');
    s = run(s, { type: 'BET' }, 'p2');
    s = run(s, { type: 'AWARD_POT', winnerIds: ['p3'] }, 'p3');
    expect(bal(s)).toEqual({ p1: -1, p2: -3, p3: 4 }); // pot 6, p3 put in 2
  });
  it('single winner takes all', () => {
    let s = started(3);
    s = run(s, { type: 'BET' }, 'p1');
    s = run(s, { type: 'AWARD_POT', winnerIds: ['p2'] }, 'p3');
    expect(bal(s)).toEqual({ p1: -10, p2: 15, p3: -5 });
  });
  it('splits with integer division; remainder carries', () => {
    let s = started(3, 5); // pot 15
    s = run(s, { type: 'PACK' }, 'p1');
    s = run(s, { type: 'AWARD_POT', winnerIds: ['p2', 'p3'] }, 'p1');
    expect(bal(s)).toEqual({ p1: -5, p2: 2, p3: 2 }); // 7 each, -5 entry
    expect(s.carryOverPot).toBe(1);
    expect(s.pot).toBe(0);
    s = run(s, { type: 'START_ROUND', sessionId: 'x' }, 'p1');
    expect(s.pot).toBe(16); // carry rolls in
    expect(s.carryOverPot).toBe(0);
  });
  it('rejects non-ACTIVE winners, empty/dup lists, and outsiders', () => {
    let s = started(4);
    s = run(s, { type: 'PACK' }, 'p1');
    expect(code(s, { type: 'AWARD_POT', winnerIds: ['p1'] }, 'p2')).toBe('NOT_ACTIVE');
    expect(code(s, { type: 'AWARD_POT', winnerIds: [] }, 'p2')).toBe('BAD_INPUT');
    expect(code(s, { type: 'AWARD_POT', winnerIds: ['p2', 'p2'] }, 'p2')).toBe('BAD_INPUT');
    s = run(s, { type: 'PACK' }, 'p2'); // packed non-host can't award
    expect(code(s, { type: 'AWARD_POT', winnerIds: ['p3'] }, 'p2')).toBe('NOT_ALLOWED');
    expect(code(s, { type: 'AWARD_POT', winnerIds: ['p3'] }, 'p1')).toBe('OK'); // host may
  });
});

describe('undo', () => {
  it('reverts BET, PACK, award (incl. auto-award) and START_ROUND; depth 3', () => {
    const s0 = started(3);
    let s = run(s0, { type: 'BET' }, 'p1');
    s = run(s, { type: 'PACK' }, 'p2');
    s = run(s, { type: 'PACK' }, 'p3'); // auto-award
    expect(s.phase).toBe('BETWEEN_ROUNDS');
    s = run(s, { type: 'UNDO' }, 'p1');
    expect(s.phase).toBe('BETTING');
    expect(s.players[2]!.status).toBe('ACTIVE');
    s = run(s, { type: 'UNDO' }, 'p1');
    s = run(s, { type: 'UNDO' }, 'p1');
    expect(bal(s)).toEqual(bal(s0));
    expect(s.pot).toBe(s0.pot);
    expect(code(s, { type: 'UNDO' }, 'p1')).toBe('NOTHING_TO_UNDO'); // depth 3: START_ROUND snapshot already pushed out
  });
  it('is host-only', () => {
    expect(code(run(started(3), { type: 'BET' }, 'p1'), { type: 'UNDO' }, 'p2')).toBe('NOT_HOST');
  });
  it('keeps a late joiner', () => {
    let s = run(started(3), { type: 'BET' }, 'p1');
    s = run(s, { type: 'JOIN', name: 'P4' }, 'p4');
    s = run(s, { type: 'UNDO' }, 'p1');
    expect(s.players).toHaveLength(4);
    expect(s.players[3]!.status).toBe('WAITING');
  });
});

describe('host ops & roster', () => {
  it('late joiner waits, then plays next round', () => {
    let s = started(3);
    s = run(s, { type: 'JOIN', name: 'P4' }, 'p4');
    expect(s.players[3]!.status).toBe('WAITING');
    s = run(s, { type: 'PACK' }, 'p1');
    s = run(s, { type: 'PACK' }, 'p2');
    s = run(s, { type: 'START_ROUND', sessionId: 'x' }, 'p1');
    expect(s.players[3]!.status).toBe('ACTIVE');
    expect(s.pot).toBe(20);
  });
  it('caps the room at 10', () => {
    let s = createRoom('1', 'u0', 'U0', 5);
    for (let i = 1; i < 10; i++) s = run(s, { type: 'JOIN', name: 'x' }, `u${i}`);
    expect(code(s, { type: 'JOIN', name: 'x' }, 'u10')).toBe('ROOM_FULL');
    expect(code(s, { type: 'JOIN', name: 'x' }, 'u3')).toBe('OK'); // reconnect
  });
  it('transfers host', () => {
    const s = run(table(3), { type: 'TRANSFER_HOST', toUserId: 'p2' }, 'p1');
    expect(s.hostId).toBe('p2');
    expect(code(s, { type: 'START_ROUND', sessionId: 'x' }, 'p1')).toBe('NOT_HOST');
  });
  it('reorders seats and sets base bet in the lobby only', () => {
    let s = run(table(3), { type: 'REORDER', order: ['p3', 'p1', 'p2'] }, 'p1');
    expect(s.players.map((p) => p.userId)).toEqual(['p3', 'p1', 'p2']);
    s = run(s, { type: 'SET_BASE_BET', baseBet: 10 }, 'p1');
    expect(s.baseBet).toBe(10);
    expect(code(s, { type: 'SET_BASE_BET', baseBet: 2.5 }, 'p1')).toBe('BAD_INPUT');
    s = run(s, { type: 'START_ROUND', sessionId: 'x' }, 'p1');
    expect(code(s, { type: 'REORDER', order: ['p1', 'p2', 'p3'] }, 'p1')).toBe('WRONG_PHASE');
  });
  it('cash-out locks balance, excludes from turns, host cannot be removed', () => {
    let s = started(4);
    s = run(s, { type: 'REMOVE_PLAYER', userId: 'p2' }, 'p1');
    expect(s.players[1]).toMatchObject({ cashedOut: true, status: 'PACKED', sessionBalance: -5 });
    s = run(s, { type: 'BET' }, 'p1');
    expect(turn(s)).toBe('p3');
    expect(code(s, { type: 'REMOVE_PLAYER', userId: 'p1' }, 'p1')).toBe('NOT_ALLOWED');
    expect(code(s, { type: 'JOIN', name: 'P2' }, 'p2')).toBe('REMOVED');
  });
  it('removing the player on turn advances; removing down to one auto-wins', () => {
    let s = started(3);
    s = run(s, { type: 'TRANSFER_HOST', toUserId: 'p2' }, 'p1');
    s = run(s, { type: 'REMOVE_PLAYER', userId: 'p1' }, 'p2'); // p1 is on turn
    expect(turn(s)).toBe('p2');
    expect(s.pot).toBe(15); // stake stays in the pot
    s = run(s, { type: 'REMOVE_PLAYER', userId: 'p3' }, 'p2');
    expect(s.phase).toBe('BETWEEN_ROUNDS');
    expect(bal(s)).toEqual({ p1: -5, p2: 10, p3: -5 });
  });
});

describe('end game', () => {
  it('mid-round: refunds every roundBet, Σ = 0', () => {
    let s = started(3);
    s = run(s, { type: 'BET' }, 'p1');
    s = run(s, { type: 'BET' }, 'p2');
    s = run(s, { type: 'END_GAME' }, 'p1');
    expect(s.phase).toBe('ENDED');
    expect(bal(s)).toEqual({ p1: 0, p2: 0, p3: 0 });
    expect(s.pot).toBe(0);
  });
  it('between rounds: leftover carry goes to the Host', () => {
    let s = started(3);
    s = run(s, { type: 'PACK' }, 'p1');
    s = run(s, { type: 'AWARD_POT', winnerIds: ['p2', 'p3'] }, 'p1');
    s = run(s, { type: 'END_GAME' }, 'p1');
    expect(bal(s)).toEqual({ p1: -4, p2: 2, p3: 2 });
    expect(s.carryOverPot).toBe(0);
  });
  it('mid-round with carry rolled in: refund bets, carry → Host', () => {
    let s = started(3);
    s = run(s, { type: 'PACK' }, 'p1');
    s = run(s, { type: 'AWARD_POT', winnerIds: ['p2', 'p3'] }, 'p1'); // carry 1
    s = run(s, { type: 'START_ROUND', sessionId: 'x' }, 'p1');
    s = run(s, { type: 'END_GAME' }, 'p1');
    expect(Object.values(bal(s)).reduce((a, b) => a + b, 0)).toBe(0);
    expect(bal(s)).toEqual({ p1: -4, p2: 2, p3: 2 });
  });
  it('locks the room', () => {
    const s = run(started(3), { type: 'END_GAME' }, 'p1');
    expect(code(s, { type: 'UNDO' }, 'p1')).toBe('NOTHING_TO_UNDO');
    expect(code(s, { type: 'BET' }, 'p1')).toBe('WRONG_PHASE');
  });
});

describe('zero-sum under random play', () => {
  it('never breaks the invariant', () => {
    let seed = 42;
    const rnd = (n: number) => ((seed = (seed * 1664525 + 1013904223) >>> 0) % n);
    for (let game = 0; game < 200; game++) {
      let s = table(2 + rnd(3), 1 + rnd(20));
      for (let step = 0; step < 60 && s.phase !== 'ENDED'; step++) {
        const actor = s.players[rnd(s.players.length)]!.userId;
        const actions: Action[] = [
          { type: 'START_ROUND', sessionId: 'x' }, { type: 'BET' }, { type: 'BET' }, { type: 'PACK' },
          { type: 'AWARD_POT', winnerIds: s.players.filter(() => rnd(2) === 0).map((p) => p.userId) },
          { type: 'UNDO' }, { type: 'REMOVE_PLAYER', userId: actor }, { type: 'JOIN', name: 'n' },
          { type: 'END_GAME' },
        ];
        const who = rnd(3) === 0 ? actor : turnOrHost(s);
        const r = reduce(s, actions[rnd(actions.length)]!, who);
        if (r.ok) s = r.state;
        expect(checkInvariant(s)).toBe(true);
      }
      if (s.phase === 'ENDED') expect(s.players.reduce((n, p) => n + p.sessionBalance, 0)).toBe(0);
    }
  });
});

const turnOrHost = (s: RoomState) => s.players[s.currentTurnIndex]?.userId ?? s.hostId;
