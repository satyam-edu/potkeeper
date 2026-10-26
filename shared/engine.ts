import type { EngineError, Player, RoomState, Snapshot } from './types';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 10;
export const UNDO_DEPTH = 3;

export type Action =
  | { type: 'JOIN'; name: string }
  | { type: 'SET_CONNECTED'; connected: boolean }
  | { type: 'START_ROUND'; sessionId: string }
  | { type: 'BET' }
  | { type: 'PACK' }
  | { type: 'AWARD_POT'; winnerIds: string[] }
  | { type: 'TRANSFER_HOST'; toUserId: string }
  | { type: 'UNDO' }
  | { type: 'END_GAME' }
  | { type: 'REORDER'; order: string[] }
  | { type: 'SET_BASE_BET'; baseBet: number }
  | { type: 'REMOVE_PLAYER'; userId: string };

export type Result = { ok: true; state: RoomState } | { ok: false; error: EngineError };

/** Integer split of a pot between k winners; the remainder carries to the next round. */
export function splitPot(pot: number, k: number): { share: number; remainder: number } {
  const share = Math.floor(pot / k);
  return { share, remainder: pot - share * k };
}

const ok = (state: RoomState): Result => ({ ok: true, state });
const err = (error: EngineError): Result => ({ ok: false, error });

export function createRoom(code: string, hostId: string, hostName: string, baseBet: number): RoomState {
  return {
    code,
    sessionId: '',
    hostId,
    baseBet,
    phase: 'LOBBY',
    players: [newPlayer(hostId, hostName, 0, 'ACTIVE')],
    pot: 0,
    carryOverPot: 0,
    currentTurnIndex: -1,
    startIndex: -1,
    roundNumber: 0,
    historyStack: [],
  };
}

const newPlayer = (userId: string, name: string, seat: number, status: Player['status']): Player => ({
  userId, name, seat, status, connected: true, sessionBalance: 0, roundBet: 0, cashedOut: false,
});

/** Zero-sum + integer invariant. Checked after every action. */
export function checkInvariant(s: RoomState): boolean {
  const vals = [s.pot, s.carryOverPot, s.baseBet, ...s.players.flatMap((p) => [p.sessionBalance, p.roundBet])];
  if (!vals.every(Number.isInteger)) return false;
  return s.players.reduce((n, p) => n + p.sessionBalance, 0) + s.pot + s.carryOverPot === 0;
}

export function reduce(state: RoomState, action: Action, actorId: string): Result {
  const r = apply(state, action, actorId);
  if (!r.ok) return r;
  return checkInvariant(r.state) ? r : err('INVARIANT');
}

function apply(s: RoomState, a: Action, actorId: string): Result {
  const isHost = actorId === s.hostId;
  switch (a.type) {
    case 'JOIN': return join(s, actorId, a.name);
    case 'SET_CONNECTED':
      return mapPlayer(s, actorId, (p) => ({ ...p, connected: a.connected }));
    case 'START_ROUND':
      return isHost ? startRound(s, a.sessionId) : err('NOT_HOST');
    case 'BET': return bet(s, actorId);
    case 'PACK': return pack(s, actorId);
    case 'AWARD_POT': {
      if (s.phase !== 'BETTING') return err('WRONG_PHASE');
      const actor = s.players.find((p) => p.userId === actorId);
      if (!isHost && actor?.status !== 'ACTIVE') return err('NOT_ALLOWED');
      const r = award(s, a.winnerIds);
      return r.ok ? ok(withHistory(s, r.state)) : r;
    }
    case 'TRANSFER_HOST': {
      if (!isHost) return err('NOT_HOST');
      const to = s.players.find((p) => p.userId === a.toUserId);
      if (!to || to.cashedOut) return err('NOT_FOUND');
      if (to.userId === s.hostId) return err('BAD_INPUT');
      return ok({ ...s, hostId: to.userId });
    }
    case 'UNDO': return isHost ? undo(s) : err('NOT_HOST');
    case 'END_GAME': return isHost ? endGame(s) : err('NOT_HOST');
    case 'REORDER': return isHost ? reorder(s, a.order) : err('NOT_HOST');
    case 'SET_BASE_BET': {
      if (!isHost) return err('NOT_HOST');
      if (s.phase !== 'LOBBY' && s.phase !== 'BETWEEN_ROUNDS') return err('WRONG_PHASE');
      if (!Number.isInteger(a.baseBet) || a.baseBet < 1) return err('BAD_INPUT');
      return ok({ ...s, baseBet: a.baseBet, historyStack: [] });
    }
    case 'REMOVE_PLAYER': return isHost ? remove(s, a.userId) : err('NOT_HOST');
  }
}

// ---------- helpers ----------

const snap = (s: RoomState): Snapshot => {
  const { historyStack, ...rest } = s;
  void historyStack;
  return rest;
};

/** Commit `next` and remember `prev` for Undo (depth UNDO_DEPTH). */
const withHistory = (prev: RoomState, next: RoomState): RoomState => ({
  ...next,
  historyStack: [...prev.historyStack, snap(prev)].slice(-UNDO_DEPTH),
});

function mapPlayer(s: RoomState, userId: string, f: (p: Player) => Player): Result {
  if (!s.players.some((p) => p.userId === userId)) return err('NOT_FOUND');
  return ok({ ...s, players: s.players.map((p) => (p.userId === userId ? f(p) : p)) });
}

/** Next ACTIVE seat strictly after index `from` (wraps). -1 if none. */
function nextActive(players: Player[], from: number): number {
  const n = players.length;
  for (let k = 1; k <= n; k++) {
    const i = (((from + k) % n) + n) % n;
    if (players[i]?.status === 'ACTIVE') return i;
  }
  return -1;
}

const liveCount = (s: RoomState) => s.players.filter((p) => !p.cashedOut).length;

// ---------- actions ----------

function join(s: RoomState, userId: string, name: string): Result {
  const existing = s.players.find((p) => p.userId === userId);
  if (existing) {
    if (existing.cashedOut) return err('REMOVED');
    return mapPlayer(s, userId, (p) => ({ ...p, name, connected: true }));
  }
  if (s.phase === 'ENDED') return err('WRONG_PHASE');
  if (liveCount(s) >= MAX_PLAYERS) return err('ROOM_FULL');
  const status = s.phase === 'LOBBY' ? 'ACTIVE' : 'WAITING';
  return ok({ ...s, players: [...s.players, newPlayer(userId, name, s.players.length, status)] });
}

function startRound(s: RoomState, sessionId: string): Result {
  if (s.phase !== 'LOBBY' && s.phase !== 'BETWEEN_ROUNDS') return err('WRONG_PHASE');
  if (liveCount(s) < MIN_PLAYERS) return err('NOT_ENOUGH_PLAYERS');
  const players = s.players.map((p) =>
    p.cashedOut ? p : { ...p, status: 'ACTIVE' as const, sessionBalance: p.sessionBalance - s.baseBet, roundBet: s.baseBet },
  );
  const next: RoomState = {
    ...s,
    players,
    phase: 'BETTING',
    sessionId: s.sessionId || sessionId,
    pot: s.carryOverPot + liveCount(s) * s.baseBet,
    carryOverPot: 0,
    roundNumber: s.roundNumber + 1,
  };
  const start = nextActive(players, s.startIndex);
  return ok(withHistory(s, { ...next, startIndex: start, currentTurnIndex: start }));
}

function bet(s: RoomState, actorId: string): Result {
  const i = turnCheck(s, actorId);
  if (typeof i !== 'number') return i;
  const players = s.players.map((p, idx) =>
    idx === i ? { ...p, sessionBalance: p.sessionBalance - s.baseBet, roundBet: p.roundBet + s.baseBet } : p,
  );
  return ok(withHistory(s, { ...s, players, pot: s.pot + s.baseBet, currentTurnIndex: nextActive(players, i) }));
}

function pack(s: RoomState, actorId: string): Result {
  const i = turnCheck(s, actorId);
  if (typeof i !== 'number') return i;
  return ok(withHistory(s, foldAt(s, i)));
}

/** Mark player i PACKED; advance the turn; auto-award if one ACTIVE is left. Caller adds history. */
function foldAt(s: RoomState, i: number): RoomState {
  const players = s.players.map((p, idx) => (idx === i ? { ...p, status: 'PACKED' as const } : p));
  const active = players.filter((p) => p.status === 'ACTIVE');
  const next = { ...s, players };
  if (active.length === 1 && active[0]) {
    const r = award(next, [active[0].userId]);
    // award only fails on bad input; a lone ACTIVE winner is always valid
    return r.ok ? r.state : next;
  }
  return { ...next, currentTurnIndex: s.currentTurnIndex === i ? nextActive(players, i) : s.currentTurnIndex };
}

function turnCheck(s: RoomState, actorId: string): number | Result {
  if (s.phase !== 'BETTING') return err('WRONG_PHASE');
  const p = s.players[s.currentTurnIndex];
  if (!p || p.userId !== actorId || p.status !== 'ACTIVE') return err('NOT_YOUR_TURN');
  return s.currentTurnIndex;
}

/** Splits the pot among winners (all must be ACTIVE). Callers add history. */
function award(s: RoomState, winnerIds: string[]): Result {
  const ids = new Set(winnerIds);
  if (ids.size === 0 || ids.size !== winnerIds.length) return err('BAD_INPUT');
  const winners = s.players.filter((p) => ids.has(p.userId));
  if (winners.length !== ids.size) return err('NOT_FOUND');
  if (winners.some((p) => p.status !== 'ACTIVE')) return err('NOT_ACTIVE');
  const { share, remainder } = splitPot(s.pot, ids.size);
  const players = s.players.map((p) => ({
    ...p,
    sessionBalance: p.sessionBalance + (ids.has(p.userId) ? share : 0),
    roundBet: 0,
  }));
  return ok({
    ...s,
    players,
    carryOverPot: remainder,
    pot: 0,
    phase: 'BETWEEN_ROUNDS',
    currentTurnIndex: -1,
  });
}

function undo(s: RoomState): Result {
  const prev = s.historyStack.at(-1);
  if (!prev || s.phase === 'ENDED') return err('NOTHING_TO_UNDO');
  const players = s.players.map((p) => {
    const o = prev.players.find((x) => x.userId === p.userId);
    return o ? { ...p, sessionBalance: o.sessionBalance, roundBet: o.roundBet, status: o.status } : p;
  });
  return ok({
    ...s,
    players,
    phase: prev.phase,
    pot: prev.pot,
    carryOverPot: prev.carryOverPot,
    currentTurnIndex: prev.currentTurnIndex,
    startIndex: prev.startIndex,
    roundNumber: prev.roundNumber,
    sessionId: prev.sessionId,
    historyStack: s.historyStack.slice(0, -1),
  });
}

/** Close the books: refund the unfinished round, leftover carry → Host. */
function endGame(s: RoomState): Result {
  if (s.phase !== 'BETTING' && s.phase !== 'BETWEEN_ROUNDS') return err('WRONG_PHASE');
  const staked = s.players.reduce((n, p) => n + p.roundBet, 0);
  // After refunding every roundBet, only the carry-over that rolled into this round's pot is left.
  const leftover = s.pot - staked + s.carryOverPot;
  const players = s.players.map((p) => ({
    ...p,
    sessionBalance: p.sessionBalance + p.roundBet + (p.userId === s.hostId ? leftover : 0),
    roundBet: 0,
  }));
  return ok({ ...s, players, pot: 0, carryOverPot: 0, phase: 'ENDED', currentTurnIndex: -1, historyStack: [] });
}

function reorder(s: RoomState, order: string[]): Result {
  if (s.phase !== 'LOBBY' && s.phase !== 'BETWEEN_ROUNDS') return err('WRONG_PHASE');
  const byId = new Map(s.players.map((p) => [p.userId, p]));
  if (order.length !== s.players.length || new Set(order).size !== order.length) return err('BAD_INPUT');
  const players: Player[] = [];
  for (const [seat, id] of order.entries()) {
    const p = byId.get(id);
    if (!p) return err('BAD_INPUT');
    players.push({ ...p, seat });
  }
  return ok({ ...s, players, historyStack: [] });
}

function remove(s: RoomState, userId: string): Result {
  if (userId === s.hostId) return err('NOT_ALLOWED'); // transfer host first
  if (s.phase === 'ENDED') return err('WRONG_PHASE');
  const i = s.players.findIndex((p) => p.userId === userId);
  const p = s.players[i];
  if (!p || p.cashedOut) return err('NOT_FOUND');
  // Mid-round, an ACTIVE leaver folds: stake stays in the pot, turn moves on, auto-win may trigger.
  const folded = s.phase === 'BETTING' && p.status === 'ACTIVE' ? foldAt(s, i) : s;
  const players = folded.players.map((q) => (q.userId === userId ? { ...q, cashedOut: true, status: 'PACKED' as const } : q));
  return ok({ ...folded, players, historyStack: [] }); // can't undo past a removal
}
