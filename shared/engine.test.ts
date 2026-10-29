import { describe, expect, it } from 'vitest';
import { createRoom, reduce, checkInvariant, splitPot, betCost, showdownPot, type Action } from './engine';
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

describe('rising stake (user scenario, base ₹1, 4 players)', () => {
  it('each BET raises the level by baseBet and the bettor pays up to it; show matches the level', () => {
    let s = started(4, 1); // everyone in at 1, pot 4
    const bets = ['p1', 'p2', 'p3', 'p4'];
    const expectIn = [2, 3, 4, 5];
    bets.forEach((id, i) => {
      s = run(s, { type: 'BET' }, id);
      expect(s.players[i]!.roundBet).toBe(expectIn[i]);
    });
    expect(s.pot).toBe(2 + 3 + 4 + 5);
    s = run(s, { type: 'PACK' }, 'p1'); // out at 2
    s = run(s, { type: 'PACK' }, 'p2'); // out at 3
    for (const [id, level] of [['p3', 6], ['p4', 7], ['p3', 8], ['p4', 9]] as const) {
      s = run(s, { type: 'BET' }, id);
      expect(s.currentBet).toBe(level);
    }
    expect(s.pot).toBe(2 + 3 + 8 + 9);
    // p3 "shows" at 9 without raising: the showdown matches p3 up to the level
    s = run(s, { type: 'AWARD_POT', winnerIds: ['p4'] }, 'p3');
    expect(bal(s)).toEqual({ p1: -2, p2: -3, p3: -9, p4: 14 }); // winner gets everyone else's money
    expect(s.pot).toBe(0);
    expect(s.currentBet).toBe(0);
  });
  it('bet label cost: first bet costs baseBet, later bets cost the gap to the new level', () => {
    const s = started(3, 5);
    expect(betCost(s, s.players[0]!)).toBe(5);
    const s2 = run(run(s, { type: 'BET' }, 'p1'), { type: 'BET' }, 'p2');
    expect(betCost(s2, s2.players[2]!)).toBe(15); // raising to 20 while p3 is in at 5
    expect(showdownPot(s2)).toBe(s2.pot + 5 + 10); // p1 (10→15) and p3 (5→15) top up; p2 already at 15
  });
  it('undo restores the stake level', () => {
    const s0 = started(3, 5);
    const s1 = run(s0, { type: 'BET' }, 'p1');
    expect(s1.currentBet).toBe(10);
    expect(run(s1, { type: 'UNDO' }, 'p1').currentBet).toBe(5);
  });
  it('mid-round End Game still refunds everything after raises', () => {
    let s = started(3, 5);
    s = run(s, { type: 'BET' }, 'p1');
    s = run(s, { type: 'BET' }, 'p2');
    s = run(s, { type: 'END_GAME' }, 'p1');
    expect(bal(s)).toEqual({ p1: 0, p2: 0, p3: 0 });
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
    expect(bal(s)).toEqual({ p1: -1, p2: -4, p3: 5 }); // stake rose to 4; p3 matched it at the show
  });
  it('single winner takes all', () => {
    let s = started(3);
    s = run(s, { type: 'BET' }, 'p1');
    s = run(s, { type: 'AWARD_POT', winnerIds: ['p2'] }, 'p3');
    expect(bal(s)).toEqual({ p1: -10, p2: 20, p3: -10 }); // p2/p3 match the ₹10 stake at the show
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

describe('splitPot', () => {
  it('floors the share and returns the remainder', () => {
    expect(splitPot(15, 2)).toEqual({ share: 7, remainder: 1 });
    expect(splitPot(35, 1)).toEqual({ share: 35, remainder: 0 });
    expect(splitPot(10, 3)).toEqual({ share: 3, remainder: 1 });
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
    expect(s.roundNumber).toBe(0); // the refunded round doesn't count
  });
  it('between rounds: leftover carry goes to the Host', () => {
    let s = started(3);
    s = run(s, { type: 'PACK' }, 'p1');
    s = run(s, { type: 'AWARD_POT', winnerIds: ['p2', 'p3'] }, 'p1');
    s = run(s, { type: 'END_GAME' }, 'p1');
    expect(bal(s)).toEqual({ p1: -4, p2: 2, p3: 2 });
    expect(s.carryOverPot).toBe(0);
    expect(s.roundNumber).toBe(1);
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

describe('resume after End Game', () => {
  const ended = () => {
    let s = started(3, 5);
    s = run(s, { type: 'BET' }, 'p1');
    s = run(s, { type: 'AWARD_POT', winnerIds: ['p1'] }, 'p1');
    return run(s, { type: 'END_GAME' }, 'p1');
  };
  it('only the host, only after End Game', () => {
    const e = ended();
    expect(code(e, { type: 'REOPEN_GAME' }, 'p2')).toBe('NOT_HOST');
    expect(code(e, { type: 'NEW_GAME' }, 'p2')).toBe('NOT_HOST');
    const live = started(3, 5);
    expect(code(live, { type: 'REOPEN_GAME' }, 'p1')).toBe('WRONG_PHASE');
    expect(code(live, { type: 'NEW_GAME' }, 'p1')).toBe('WRONG_PHASE');
  });
  it('reopen keeps totals, remembers what was saved, and the next round starts a fresh session', () => {
    const e = ended();
    const r = run(e, { type: 'REOPEN_GAME' }, 'p1');
    expect(r.phase).toBe('BETWEEN_ROUNDS');
    expect(bal(r)).toEqual(bal(e));
    expect(r.settledBalances).toEqual(bal(e));
    expect(r.settledRounds).toBe(e.roundNumber);
    expect(r.sessionId).toBe('');
    const next = run(r, { type: 'START_ROUND', sessionId: 'sess2' }, 'p1');
    expect(next.sessionId).toBe('sess2');
    expect(next.roundNumber).toBe(e.roundNumber + 1);
  });
  it('new game zeroes everything, keeps the room, drops cashed out players', () => {
    let s = started(3, 5);
    s = run(s, { type: 'REMOVE_PLAYER', userId: 'p3' }, 'p1');
    const e = run(s, { type: 'END_GAME' }, 'p1');
    const n = run(e, { type: 'NEW_GAME' }, 'p1');
    expect(n.phase).toBe('LOBBY');
    expect(n.players.map((p) => p.userId)).toEqual(['p1', 'p2']);
    expect(n.players.map((p) => p.seat)).toEqual([0, 1]);
    expect(Object.values(bal(n))).toEqual([0, 0]);
    expect(n.hostId).toBe('p1');
    expect(n.roundNumber).toBe(0);
    expect(n.sessionId).toBe('');
  });
});

describe('game total (balance + roundBet) only moves when a round finishes', () => {
  const totals = (s: RoomState) => Object.fromEntries(s.players.map((p) => [p.userId, p.sessionBalance + p.roundBet]));
  it('start, bet and pack leave it alone; the award changes it', () => {
    let s = started(3, 5);
    const before = totals(s);
    expect(before).toEqual({ p1: 0, p2: 0, p3: 0 });
    s = run(s, { type: 'BET' }, 'p1');
    s = run(s, { type: 'PACK' }, 'p2');
    expect(totals(s)).toEqual(before);
    s = run(s, { type: 'AWARD_POT', winnerIds: ['p1'] }, 'p1');
    expect(totals(s)).toEqual({ p1: 15, p2: -5, p3: -10 }); // pot 30 − own 15 / losers' stakes (p3 matched to 10)
    s = run(s, { type: 'START_ROUND', sessionId: 'x' }, 'p1');
    expect(totals(s)).toEqual({ p1: 15, p2: -5, p3: -10 }); // round 2 starting does not move it
  });
});
