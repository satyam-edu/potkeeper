import type { RoomState } from '../../shared/types';
import { signed } from '../lib/format';

const tone = (n: number) => (n < 0 ? 'text-danger' : n > 0 ? 'text-neon' : 'text-white');

/** The whole game so far: every player's total, then each finished round with who won and lost what. */
export function GameTotalSheet({ state, meId, onClose }: { state: RoomState; meId: string; onClose: () => void }) {
  const log = state.roundLog ?? []; // a client can briefly see a room that predates the log
  const total = (id: string) => log.reduce((n, r) => n + (r[id] ?? 0), 0);
  const rows = [...state.players].sort((a, b) => total(b.userId) - total(a.userId));
  const name = (id: string) => state.players.find((p) => p.userId === id)?.name ?? '?';
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/80" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Game total" onClick={(e) => e.stopPropagation()} className="flex max-h-[85dvh] w-full max-w-[420px] flex-col rounded-t-[28px] bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-line" />
        <h2 className="display mb-3 shrink-0 text-3xl font-bold">Game <span className="text-neon">total</span></h2>
        <div className="min-h-0 overflow-y-auto">
          <ul className="flex flex-col gap-1.5">
            {rows.map((p) => (
              <li key={p.userId} className={`flex items-center justify-between rounded-xl bg-surface-2 px-4 py-2.5 ${p.cashedOut ? 'opacity-50' : ''}`}>
                <span className={p.userId === meId ? 'font-bold' : ''}>{p.name}</span>
                <span className={`text-lg font-bold tabular-nums ${tone(total(p.userId))}`}>{signed(total(p.userId))}</span>
              </li>
            ))}
          </ul>
          <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-widest text-mid">Round by round</p>
          {log.length === 0 ? (
            <p className="text-sm text-mid">No round has finished yet.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {log.map((r, i) => ({ r, n: i + 1 })).reverse().map(({ r, n }) => (
                <li key={n} className="rounded-xl border border-line px-3 py-2">
                  <p className="mb-1 text-xs font-bold text-mid">Round {n}</p>
                  <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                    {Object.entries(r).sort((a, b) => b[1] - a[1]).map(([id, v]) => (
                      <li key={id} className="flex items-baseline justify-between gap-2 text-sm">
                        <span className={`truncate ${id === meId ? 'font-bold' : 'text-mid'}`}>{name(id)}</span>
                        <span className={`font-semibold tabular-nums ${tone(v)}`}>{signed(v)}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </div>
        <button onClick={onClose} className="mt-4 h-12 shrink-0 rounded-2xl bg-surface-2 font-semibold">Close</button>
      </div>
    </div>
  );
}
