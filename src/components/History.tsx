import { useEffect, useState } from 'react';
import { signed } from '../lib/format';
import { fetchHistory, type HistoryGame, type Session } from '../lib/session';

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const tone = (n: number) => (n < 0 ? 'text-danger' : 'text-neon');

/** Past games, newest first. Tap a row to see everyone's result. */
export function History({ session }: { session: Session }) {
  const [games, setGames] = useState<HistoryGame[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = (before?: string) => {
    setBusy(true);
    setFailed(false);
    fetchHistory(session, before)
      .then((p) => { setGames((g) => [...(before ? (g ?? []) : []), ...p.games]); setNext(p.next); })
      .catch(() => setFailed(true))
      .finally(() => setBusy(false));
  };
  useEffect(() => load(), [session.token]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section>
      <p className="mb-2 text-xs font-semibold tracking-widest text-mid">HISTORY</p>
      {games?.length === 0 && <p className="text-mid">No games yet. Your finished games show up here.</p>}
      <ul className="flex flex-col gap-2">
        {games?.map((g) => (
          <li key={g.id} className="rounded-2xl bg-surface">
            <button onClick={() => setOpen(open === g.id ? null : g.id)} aria-expanded={open === g.id} className="flex min-h-14 w-full items-center justify-between px-4 text-left">
              <span>
                <span className="font-semibold">{day(g.endedAt)}, {time(g.endedAt)}</span>
                <span className="text-sm text-mid"> · {g.rounds} round{g.rounds === 1 ? '' : 's'} · ₹{g.baseBet} base</span>
              </span>
              <span className={`display text-xl font-bold tabular-nums ${g.net === 0 ? 'text-mid' : tone(g.net)}`}>{signed(g.net)}</span>
            </button>
            {open === g.id && (
              <ul className="flex flex-col gap-1 border-t border-line px-4 py-3">
                {g.players.map((p, i) => (
                  <li key={i} className="flex justify-between text-sm">
                    <span className={p.isMe ? 'font-bold' : 'text-mid'}>{p.name}{p.isMe && ' (you)'}</span>
                    <span className={`font-semibold tabular-nums ${p.net === 0 ? 'text-mid' : tone(p.net)}`}>{signed(p.net)}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      {games === null && !failed && <p className="text-mid">Loading…</p>}
      {failed && <button onClick={() => load(games?.length ? next ?? undefined : undefined)} className="text-sm text-danger underline">Couldn't load history. Tap to retry.</button>}
      {next && !failed && (
        <button disabled={busy} onClick={() => load(next)} className="mt-3 h-12 w-full rounded-2xl bg-surface-2 font-semibold disabled:opacity-40">Show more</button>
      )}
    </section>
  );
}
