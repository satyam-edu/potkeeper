import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { DealingCards } from './DealingCards';
import { signed } from '../lib/format';
import { fetchHistory, type HistoryGame, type Session } from '../lib/session';

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
const tone = (n: number) => (n < 0 ? 'text-danger' : 'text-neon');

/** Past games, newest first. Tap a row to see everyone's result and to open its settle room. `settledOnly` is the Settled tab. */
export function History({ session, settledOnly = false }: { session: Session; settledOnly?: boolean }) {
  const [, go] = useLocation();
  const [games, setGames] = useState<HistoryGame[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = (before?: string) => {
    setBusy(true);
    setFailed(false);
    fetchHistory(session, before, settledOnly ? 'SETTLED' : undefined)
      .then((p) => { setGames((g) => [...(before ? (g ?? []) : []), ...p.games]); setNext(p.next); })
      .catch(() => setFailed(true))
      .finally(() => setBusy(false));
  };
  useEffect(() => load(), [session.token]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section>
      {games?.length === 0 && <p className="text-mid">{settledOnly ? 'No settled games yet. Games you have settled up show here.' : 'No games yet. Your finished games show up here.'}</p>}
      <ul className="flex flex-col gap-2">
        {games?.map((g) => (
          <li key={g.id} className="rounded-2xl bg-ink border border-white/15">
            <button onClick={() => setOpen(open === g.id ? null : g.id)} aria-expanded={open === g.id} className="flex min-h-16 w-full items-center justify-between px-4 py-2 text-left">
              <span className="flex flex-col">
                <span className="font-bold">{day(g.endedAt)}</span>
                <span className="text-sm text-mid">{time(g.endedAt)} · {g.rounds} round{g.rounds === 1 ? '' : 's'} · ₹{g.baseBet} base</span>
                <span className={`mt-1 w-fit rounded-full px-2 py-0.5 text-[11px] font-bold ${g.status === 'SETTLED' ? 'border border-neon text-neon' : g.open ? 'bg-neon text-ink' : 'border border-line text-paper'}`}>
                  {g.status === 'SETTLED' ? '✓ Settled' : g.open ? `Settling ${g.open.ready} of ${g.open.total}` : 'Pending'}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span className={`amount text-xl tabular-nums ${g.net === 0 ? 'text-mid' : tone(g.net)}`}>{signed(g.net)}</span>
                <svg viewBox="0 0 24 24" aria-hidden="true" className={`h-5 w-5 text-mid transition-transform ${open === g.id ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </span>
            </button>
            {open === g.id && (
              <ul className="flex flex-col gap-1 border-t border-white/15 px-4 py-3">
                {g.players.map((p, i) => (
                  <li key={i} className="flex justify-between text-sm">
                    <span className={p.isMe ? 'font-bold' : 'text-mid'}>{p.name}{p.isMe && ' (you)'}</span>
                    <span className={`font-semibold tabular-nums ${p.net === 0 ? 'text-mid' : tone(p.net)}`}>{signed(p.net)}</span>
                  </li>
                ))}
                <li className="pt-2">
                  <button onClick={() => go(`/settle/${g.id}`)} className={`h-12 w-full rounded-2xl font-bold ${g.status === 'PENDING' && (g.open || g.canStart) ? 'bg-neon text-ink' : 'btn-quiet'}`}>
                    {g.status === 'SETTLED' ? 'View receipt' : g.open ? 'Open settle room' : g.canStart ? 'Settle this game' : 'See settle status'}
                  </button>
                </li>
              </ul>
            )}
          </li>
        ))}
      </ul>
      {games === null && !failed && <div className="flex flex-col items-center gap-1 py-6"><DealingCards label="Loading your games" /><p className="text-sm text-mid">Loading…</p></div>}
      {failed && <button onClick={() => load(games?.length ? next ?? undefined : undefined)} className="text-sm text-danger underline">Couldn't load history. Tap to retry.</button>}
      {next && !failed && (
        <button disabled={busy} onClick={() => load(next)} className="mt-3 h-12 w-full rounded-2xl btn-quiet font-semibold disabled:opacity-40">Show more</button>
      )}
    </section>
  );
}
