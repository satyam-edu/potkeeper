import type { Player } from '../../shared/types';
import { signed } from '../lib/format';

/** Whole game totals, biggest first. Seat cards only show the current round. */
export function Scoreboard({ players, meId }: { players: Player[]; meId: string }) {
  const rows = [...players].sort((a, b) => b.sessionBalance - a.sessionBalance);
  return (
    <section aria-label="Game totals" className="rounded-xl bg-surface px-3 py-1.5">
      <h2 className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-mid">Game total</h2>
      <ul className="grid grid-cols-2 gap-x-5">
        {rows.map((p) => (
          <li key={p.userId} className={`flex items-baseline justify-between gap-2 text-xs leading-5 ${p.cashedOut ? 'opacity-50' : ''}`}>
            <span className={`truncate ${p.userId === meId ? 'font-bold' : 'text-mid'}`}>{p.name}</span>
            <span className={`font-semibold tabular-nums ${p.sessionBalance < 0 ? 'text-danger' : p.sessionBalance > 0 ? 'text-neon' : 'text-white'}`}>{signed(p.sessionBalance)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
