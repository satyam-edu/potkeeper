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
