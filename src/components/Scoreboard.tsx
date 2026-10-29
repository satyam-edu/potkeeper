import type { RoomState } from '../../shared/types';
import { signed } from '../lib/format';
import { seatNet } from '../lib/roundResult';

/** This round's result for every player, biggest first. Tap it for the whole game (see GameTotalSheet). */
export function Scoreboard({ state, meId, onOpen }: { state: RoomState; meId: string; onOpen: () => void }) {
  const rows = state.players.map((p) => ({ p, net: seatNet(state, p) })).sort((a, b) => b.net - a.net);
  return (
    <button onClick={onOpen} aria-label="Open game total" className="block w-full rounded-xl bg-surface px-3 py-2.5 text-left">
      <span className="mb-1.5 flex items-center justify-between pr-8 text-[10px] font-semibold uppercase tracking-widest text-mid">
        <span>This round</span>
        <span>Game total ›</span>
      </span>
      <span className="grid grid-cols-2 gap-x-5">
        {rows.map(({ p, net }) => (
          <span key={p.userId} className={`flex items-baseline justify-between gap-2 text-xs leading-6 ${p.cashedOut ? 'opacity-50' : ''}`}>
            <span className={`truncate ${p.userId === meId ? 'font-bold' : 'text-mid'}`}>{p.name}</span>
            <span className={`font-semibold tabular-nums ${net < 0 ? 'text-danger' : net > 0 ? 'text-neon' : 'text-white'}`}>{signed(net)}</span>
          </span>
        ))}
      </span>
    </button>
  );
}
