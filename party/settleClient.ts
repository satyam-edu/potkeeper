import { signBody } from '../shared/hmac';
import type { RoomState } from '../shared/types';

/** What /api/games/settle expects. Built once at End Game and kept unchanged across retries (same sessionId). */
export interface SettlePayload {
  sessionId: string;
  roomCode: string;
  baseBet: number;
  rounds: number;
  startedAt?: string;
  endedAt: string;
  players: { userId: string; name: string; net: number; cashedOut: boolean }[];
}

export function buildPayload(s: RoomState, startedAt?: string): SettlePayload {
  return {
    sessionId: s.sessionId,
    roomCode: s.code,
    baseBet: s.baseBet,
    rounds: s.roundNumber, // finished rounds only: End Game already dropped an unfinished one
    startedAt,
    endedAt: new Date().toISOString(),
    players: s.players.map((p) => ({ userId: p.userId, name: p.name, net: p.sessionBalance, cashedOut: p.cashedOut })),
  };
}

export type Outcome = 'saved' | 'retry' | 'rejected';

/** One signed POST. 2xx = saved (incl. duplicate). 4xx = the server refused the payload, retrying can't help. Anything else = try later. */
export async function postSettle(payload: SettlePayload, url: string, secret: string, doFetch: typeof fetch = fetch): Promise<Outcome> {
  const body = JSON.stringify(payload);
  try {
    const res = await doFetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-signature': await signBody(body, secret) }, body });
    if (res.ok) return 'saved';
    return res.status >= 400 && res.status < 500 && res.status !== 429 ? 'rejected' : 'retry';
  } catch {
    return 'retry'; // network error: API unreachable
  }
}

export const MAX_ATTEMPTS = 20;
/** 5s, 10s, 20s … capped at 5 min (≈ 1.5h of trying in total). */
export const backoffMs = (attempt: number) => Math.min(5000 * 2 ** attempt, 300_000);
