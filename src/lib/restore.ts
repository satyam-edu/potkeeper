import type { ClientMessage, Player } from '../../shared/types';
import { seatLabels } from './format';

const key = (s: string) => s.trim().toLowerCase();

/**
 * Turns pasted backup text (players named by name, as a person would write it) into a RESTORE message for the players now in the room.
 * A name matches the full name or the first name the table shows, whatever the case. Returns a sentence to show when it can't.
 */
export function buildRestore(text: string, players: Player[]): { msg: Extract<ClientMessage, { t: 'RESTORE' }> } | { error: string } {
  try {
    const d = JSON.parse(text) as { round?: number; opener?: string; turn?: string; currentBet?: number; seats?: Record<string, unknown>[]; log?: Record<string, number>[] };
    if (!d || !Array.isArray(d.seats) || !Array.isArray(d.log)) return { error: 'The backup is missing the seats or the log.' };
    const labels = seatLabels(players);
    const byName = new Map<string, string>();
    for (const p of players) {
      byName.set(key(labels[p.userId] ?? p.name), p.userId);
      byName.set(key(p.name), p.userId); // a full name wins over a shared first name
    }
    const unknown = new Set<string>();
    const id = (n: unknown) => {
      const u = typeof n === 'string' ? byName.get(key(n)) : undefined;
      if (!u) unknown.add(String(n));
      return u ?? '';
    };
    const seats = d.seats.map((x) => ({ userId: id(x.name), total: x.total as number, roundBet: x.roundBet as number | undefined, packed: x.packed === true }));
    const opener = id(d.opener);
    const turn = d.turn === undefined ? undefined : id(d.turn);
    const log = d.log.map((r) => Object.fromEntries(Object.entries(r).map(([n, v]) => [id(n), v])));
    if (unknown.size) return { error: `Not in this room yet: ${[...unknown].join(', ')}.` };
    const absent = players.filter((p) => !seats.some((x) => x.userId === p.userId)).map((p) => p.name);
    if (absent.length) return { error: `In the room but not in the backup: ${absent.join(', ')}.` };
    return { msg: { t: 'RESTORE', round: d.round as number, seats, opener, ...(turn !== undefined && { turn }), currentBet: d.currentBet, log } };
  } catch {
    return { error: 'Could not read that text. Paste the whole backup.' };
  }
}
