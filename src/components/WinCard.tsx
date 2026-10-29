import type { RoomState } from '../../shared/types';
import { signed } from '../lib/format';
import type { Winner } from '../lib/roundResult';

const Corner = ({ flip }: { flip?: boolean }) => (
  <span aria-hidden="true" className={`absolute flex flex-col items-center leading-none ${flip ? 'bottom-3 right-3 rotate-180' : 'left-3 top-3'}`}>
    <span className="text-2xl font-bold">A</span>
    <span className="text-xl">♠</span>
  </span>
);

/** Round result shaped like an ace card: the winner(s) big and highlighted, everyone else's loss underneath. Shown on every phone. */
export function WinCard({ state, winners, onClose }: { state: RoomState; winners: Winner[]; onClose: () => void }) {
  const log = (state.roundLog ?? []).at(-1) ?? {};
  const won = new Set(winners.map((w) => w.userId));
  const others = Object.entries(log)
    .filter(([id]) => !won.has(id))
    .map(([id, net]) => ({ id, net, name: state.players.find((p) => p.userId === id)?.name ?? '?' }))
    .sort((a, b) => a.net - b.net);
  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-ink/75 backdrop-blur-sm" aria-hidden="true" />
      <button
        onClick={onClose}
        aria-live="polite"
        className="pop pointer-events-auto relative aspect-[5/7] w-[min(72vw,260px)] rounded-[18px] border border-white bg-white/95 text-center text-ink"
      >
        <Corner />
        <Corner flip />
        <span className="flex h-full flex-col overflow-y-auto px-9 py-14">
          <span className="m-auto flex w-full flex-col">
        {winners.map((w) => (
          <span key={w.userId} className="mb-3 flex flex-col items-center leading-tight">
            <span className="break-words text-xl font-bold [overflow-wrap:anywhere]">{w.name}</span>
            <span className="mt-1 rounded-xl bg-neon px-3 py-1 text-3xl font-bold tabular-nums">won ₹{Math.max(0, log[w.userId] ?? 0)}</span>
          </span>
        ))}
        {others.length > 0 && (
          <ul className="mt-1 flex flex-col gap-1 border-t border-ink/15 pt-3">
            {others.map((o) => (
              <li key={o.id} className="flex items-baseline justify-between gap-2 text-sm">
                <span className="break-words text-left text-ink/70 [overflow-wrap:anywhere]">{o.name}</span>
                <span className={`font-bold tabular-nums ${o.net < 0 ? 'text-danger' : 'text-ink'}`}>{signed(o.net)}</span>
              </li>
            ))}
          </ul>
        )}
          </span>
        </span>
      </button>
    </div>
  );
}
