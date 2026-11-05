import { checkInvariant, type Action } from '../shared/engine';
import type { RoomState } from '../shared/types';

/** Storage key and format of a room's saved game. Bump `SAVE_VERSION` when `RoomState` changes shape: an old save is then dropped instead of loaded. */
export const SAVE_KEY = 'room';
export const SAVE_VERSION = 1;
/** A save nobody has touched for this long is dropped on the next start, so an abandoned room frees its code. */
export const IDLE_MS = 6 * 3600e3;

export interface Saved {
  v: number;
  state: RoomState;
  startedAt?: string;
  savedAt: number;
}

export type SaveType = Action['type'] | 'CREATE';

// Taps inside a round are not saved (the free plan allows 100,000 writes a day): a wipe takes the room back to the last finished round.
const IN_ROUND = new Set<SaveType>(['BET', 'PACK', 'SHOW', 'CANCEL_SHOW', 'START_ROUND', 'UNDO', 'SET_CONNECTED']);

/** Is this change worth a write? About one per finished round, plus room setup and host actions. */
export function shouldSave(prev: RoomState | null, next: RoomState, type: SaveType): boolean {
  if (next.phase === 'ENDED') return false; // End Game deletes the save: a finished game must not come back
  if (type === 'SET_CONNECTED') return false;
  if (type === 'JOIN') return !prev || next.players.length > prev.players.length; // a reconnect changes nothing worth keeping
  return !(IN_ROUND.has(type) && next.phase === 'BETTING');
}

export const makeSaved = (state: RoomState, startedAt: string | undefined, now: number): Saved => ({
  v: SAVE_VERSION,
  state: { ...state, historyStack: [] }, // Undo history is not worth the space
  ...(startedAt && { startedAt }),
  savedAt: now,
});

const PHASES = new Set(['LOBBY', 'BETTING', 'BETWEEN_ROUNDS', 'ENDED']);

export type Loaded = { ok: true; state: RoomState; startedAt?: string } | { ok: false; reason: 'version' | 'expired' | 'shape' | 'invariant' };

/** Checks what storage gave back before the room trusts it. Nobody is connected right after a restart, so everyone starts offline. */
export function loadSaved(raw: unknown, now: number): Loaded {
  const s = raw as Partial<Saved> | null;
  if (!s || typeof s !== 'object' || s.v !== SAVE_VERSION) return { ok: false, reason: 'version' };
  if (typeof s.savedAt !== 'number' || now - s.savedAt > IDLE_MS) return { ok: false, reason: 'expired' };
  const st = s.state;
  if (!st || typeof st !== 'object' || typeof st.code !== 'string' || typeof st.hostId !== 'string' || !PHASES.has(st.phase)
    || !Array.isArray(st.players) || !Array.isArray(st.roundLog) || !Array.isArray(st.historyStack)
    || !st.players.every((p) => p && typeof p.userId === 'string' && typeof p.name === 'string')) return { ok: false, reason: 'shape' };
  if (!checkInvariant(st)) return { ok: false, reason: 'invariant' };
  return { ok: true, state: { ...st, players: st.players.map((p) => ({ ...p, connected: false })) }, ...(s.startedAt && { startedAt: s.startedAt }) };
}
