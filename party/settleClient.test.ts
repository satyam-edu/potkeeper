import { describe, expect, it } from 'vitest';
import { verifyBody } from '../shared/hmac';
import { createRoom } from '../shared/engine';
import { backoffMs, buildPayload, postSettle } from './settleClient';

const payload = () => {
  const s = createRoom('4829', 'u1', 'Sid', 5);
  return buildPayload({ ...s, sessionId: 'sess-1', roundNumber: 3 }, '2026-10-28T10:00:00.000Z');
};
const reply = (status: number) => (async () => new Response('{}', { status })) as unknown as typeof fetch;

describe('postSettle', () => {
  it('signs the exact body it sends', async () => {
    let seen: { body: string; sig: string | null } | undefined;
    const f = (async (_u: string, init: RequestInit) => {
      seen = { body: String(init.body), sig: new Headers(init.headers).get('x-signature') };
      return new Response('{}');
    }) as unknown as typeof fetch;
    expect(await postSettle(payload(), 'http://x', 'sec', f)).toBe('saved');
    expect(await verifyBody(seen!.body, seen!.sig, 'sec')).toBe(true);
    expect(JSON.parse(seen!.body)).toMatchObject({ sessionId: 'sess-1', rounds: 3, players: [{ userId: 'u1', net: 0 }] });
  });

  it('outage retries, a refusal does not; the same payload succeeds once the API is back', async () => {
    const p = payload();
    const down = (async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch;
    expect(await postSettle(p, 'http://x', 's', down)).toBe('retry');
    expect(await postSettle(p, 'http://x', 's', reply(500))).toBe('retry');
    expect(await postSettle(p, 'http://x', 's', reply(429))).toBe('retry');
    expect(await postSettle(p, 'http://x', 's', reply(400))).toBe('rejected');
    expect(await postSettle(p, 'http://x', 's', reply(401))).toBe('rejected');
    expect(await postSettle(p, 'http://x', 's', reply(200))).toBe('saved');
  });

  it('backs off 5s → 5min cap', () => {
    expect([0, 1, 2, 10].map(backoffMs)).toEqual([5000, 10000, 20000, 300000]);
  });
});

describe('buildPayload after a reopen', () => {
  it('sends only what changed since the earlier save', () => {
    const s = createRoom('4829', 'u1', 'Sid', 5);
    const p = { ...s.players[0]!, sessionBalance: 8 };
    const q = { ...p, userId: 'u2', name: 'Raj', sessionBalance: -8 };
    const out = buildPayload({ ...s, players: [p, q], sessionId: 'sess-2', roundNumber: 5, settledRounds: 3, settledBalances: { u1: 10, u2: -10 } });
    expect(out.rounds).toBe(2);
    expect(out.players.map((x) => x.net)).toEqual([-2, 2]);
  });
});
