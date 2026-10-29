import type { RoomState } from '../../shared/types';

export interface Winner {
  userId: string;
  name: string;
  gain: number;
}

/** Who got paid when a round just ended (BETTING → BETWEEN_ROUNDS), from the balance change. */
export function roundWinners(prev: RoomState, next: RoomState): Winner[] {
  if (prev.phase !== 'BETTING' || next.phase !== 'BETWEEN_ROUNDS') return [];
  return next.players.flatMap((p) => {
    const before = prev.players.find((q) => q.userId === p.userId)?.sessionBalance ?? p.sessionBalance;
    return p.sessionBalance > before ? [{ userId: p.userId, name: p.name, gain: p.sessionBalance - before }] : [];
  });
}

/** Each player's net for the round that just ended (payout minus everything they put in), or null for other transitions. */
export function roundNets(prev: RoomState, next: RoomState): Record<string, number> | null {
  if (prev.phase !== 'BETTING' || next.phase !== 'BETWEEN_ROUNDS') return null;
  return Object.fromEntries(
    next.players.map((p) => {
      const q = prev.players.find((x) => x.userId === p.userId);
      // Balance before the round = balance then + everything staked since (every stake lowers the balance one for one).
      return [p.userId, q ? p.sessionBalance - (q.sessionBalance + q.roundBet) : 0];
    }),
  );
}

/** What a seat shows: this round's net. While betting that is minus what they have put in. */
export function seatNet(state: RoomState, p: { userId: string; roundBet: number }, nets: Record<string, number> | null): number {
  return state.phase === 'BETTING' ? -p.roundBet : (nets?.[p.userId] ?? 0);
}
