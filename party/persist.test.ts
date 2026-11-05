import { describe, expect, it } from 'vitest';
import { createRoom, reduce, type Action } from '../shared/engine';
import type { RoomState } from '../shared/types';
import { IDLE_MS, SAVE_VERSION, loadSaved, makeSaved, shouldSave } from './persist';

const run = (s: RoomState, a: Action, who: string): RoomState => {
  const r = reduce(s, a, who);
  if (!r.ok) throw new Error(`${a.type}: ${r.error}`);
  return r.state;
};
const lobby = () => ['p2', 'p3'].reduce((s, id) => run(s, { type: 'JOIN', name: id }, id), createRoom('4829', 'p1', 'P1', 5));
const betting = () => run(lobby(), { type: 'START_ROUND', sessionId: 'sess' }, 'p1');
const between = () => run(betting(), { type: 'AWARD_POT', winnerIds: ['p1'] }, 'p1'); // p1 is on turn and still in

describe('shouldSave: about one write a finished round', () => {
  it('saves at the end of a round, at setup and on host actions', () => {
    const b = betting();
    expect(shouldSave(b, between(), 'AWARD_POT')).toBe(true);
    expect(shouldSave(null, lobby(), 'CREATE')).toBe(true);
    expect(shouldSave(lobby(), run(lobby(), { type: 'SET_BASE_BET', baseBet: 10 }, 'p1'), 'SET_BASE_BET')).toBe(true);
    expect(shouldSave(b, run(b, { type: 'TRANSFER_HOST', toUserId: 'p2' }, 'p1'), 'TRANSFER_HOST')).toBe(true); // also mid round: it is a valid state
  });
  it('does not save taps inside a round, starting a round or going offline', () => {
    const b = betting();
    expect(shouldSave(lobby(), b, 'START_ROUND')).toBe(false);
    expect(shouldSave(b, run(b, { type: 'BET' }, 'p1'), 'BET')).toBe(false);
    expect(shouldSave(b, run(b, { type: 'PACK' }, 'p1'), 'PACK')).toBe(false);
    expect(shouldSave(b, run(b, { type: 'SHOW' }, 'p1'), 'SHOW')).toBe(false);
    expect(shouldSave(between(), between(), 'SET_CONNECTED')).toBe(false);
  });
  it('saves when the last player packs and wins the round', () => {
    let s = betting();
    s = run(s, { type: 'PACK' }, 'p1');
    const next = run(s, { type: 'PACK' }, 'p2');
    expect(next.phase).toBe('BETWEEN_ROUNDS');
    expect(shouldSave(s, next, 'PACK')).toBe(true);
  });
  it('saves a new player joining but not a reconnect, and never an ended game', () => {
    const l = lobby();
    expect(shouldSave(l, run(l, { type: 'JOIN', name: 'P4' }, 'p4'), 'JOIN')).toBe(true);
    expect(shouldSave(l, run(l, { type: 'JOIN', name: 'P2' }, 'p2'), 'JOIN')).toBe(false);
    const ended = run(between(), { type: 'END_GAME' }, 'p1');
    expect(shouldSave(between(), ended, 'END_GAME')).toBe(false);
  });
});

describe('loadSaved: what comes back after a wipe', () => {
  const now = 1_000_000_000;
  it('brings the room back with everyone offline, Undo history dropped', () => {
    const s = between();
    expect(s.historyStack.length).toBeGreaterThan(0);
    const saved = makeSaved(s, '2026-11-05T00:00:00.000Z', now);
    const r = loadSaved(JSON.parse(JSON.stringify(saved)), now + 60_000); // through JSON, like storage
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.phase).toBe('BETWEEN_ROUNDS');
    expect(r.state.roundNumber).toBe(1);
    expect(r.state.sessionId).toBe('sess');
    expect(r.state.players.every((p) => !p.connected)).toBe(true);
    expect(r.state.historyStack).toEqual([]);
    expect(r.startedAt).toBe('2026-11-05T00:00:00.000Z');
    expect(r.state.players.map((p) => p.sessionBalance)).toEqual(s.players.map((p) => p.sessionBalance));
  });
  it('a restored room plays on: next round starts from the saved totals', () => {
    const r = loadSaved(makeSaved(between(), undefined, now), now);
    if (!r.ok) throw new Error(r.reason);
    const next = run(r.state, { type: 'START_ROUND', sessionId: 'x' }, 'p1');
    expect(next.roundNumber).toBe(2);
    expect(next.players.reduce((n, p) => n + p.sessionBalance, 0) + next.pot).toBe(0);
  });
  it('drops a save that is too old, from another version, malformed or not zero sum', () => {
    const good = makeSaved(between(), undefined, now);
    expect(loadSaved(good, now + IDLE_MS + 1)).toEqual({ ok: false, reason: 'expired' });
    expect(loadSaved({ ...good, v: SAVE_VERSION + 1 }, now)).toEqual({ ok: false, reason: 'version' });
    expect(loadSaved(undefined, now)).toEqual({ ok: false, reason: 'version' });
    expect(loadSaved({ ...good, state: { ...good.state, players: 'x' } }, now)).toEqual({ ok: false, reason: 'shape' });
    expect(loadSaved({ ...good, state: { ...good.state, phase: 'NOPE' } }, now)).toEqual({ ok: false, reason: 'shape' });
    const broken = { ...good.state, players: good.state.players.map((p, i) => (i ? p : { ...p, sessionBalance: p.sessionBalance + 1 })) };
    expect(loadSaved({ ...good, state: broken }, now)).toEqual({ ok: false, reason: 'invariant' });
  });
});
