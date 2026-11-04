import type { ClientMessage, RoomState } from '../../shared/types';

/** Host only, between rounds: move players up or down. The order is clockwise and sets who opens next (the player after the last opener). */
export function SeatingSheet({ state, meId, send, onClose }: { state: RoomState; meId: string; send: (m: ClientMessage) => void; onClose: () => void }) {
  const live = state.players.filter((p) => !p.cashedOut);
  const opener = state.players[state.startIndex];
  const move = (i: number, dir: -1 | 1) => {
    const order = live.map((p) => p.userId);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j]!, order[i]!];
    // cashed out players keep their tail slots (REORDER needs the full roster)
    send({ t: 'REORDER', order: [...order, ...state.players.filter((p) => p.cashedOut).map((p) => p.userId)] });
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/80" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Seats" onClick={(e) => e.stopPropagation()} className="flex max-h-[85dvh] w-full max-w-[420px] flex-col rounded-t-[28px] bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-line" />
        <h2 className="display mb-1 shrink-0 text-3xl font-bold">Move <span className="text-neon">seats</span></h2>
        <p className="mb-3 shrink-0 text-sm text-mid">Clockwise order. Next round opens with the player after {opener && !opener.cashedOut ? opener.name : 'the last opener'}.</p>
        <ul className="flex min-h-0 flex-col gap-2 overflow-y-auto">
          {live.map((p, i) => (
            <li key={p.userId} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2">
              <span className="w-5 text-center font-bold text-mid">{i + 1}</span>
              <span className="min-w-0 flex-1 font-semibold [overflow-wrap:anywhere]">
                {p.name}
                {p.userId === meId && <span className="ml-2 text-xs text-neon">YOU</span>}
              </span>
              <button aria-label={`Move ${p.name} up`} disabled={i === 0} onClick={() => move(i, -1)} className="h-11 w-11 rounded-lg btn-quiet disabled:opacity-30">▲</button>
              <button aria-label={`Move ${p.name} down`} disabled={i === live.length - 1} onClick={() => move(i, 1)} className="h-11 w-11 rounded-lg btn-quiet disabled:opacity-30">▼</button>
            </li>
          ))}
        </ul>
        <button onClick={onClose} className="mt-4 h-14 shrink-0 rounded-2xl bg-neon font-bold text-ink">Done</button>
      </div>
    </div>
  );
}
