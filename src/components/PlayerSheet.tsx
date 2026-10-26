import type { Player } from '../../shared/types';
import { initials, hue, signed } from '../lib/format';

/** Host-only actions for one seat. Both buttons lead to a ConfirmModal in the parent. */
export function PlayerSheet({ p, onTransfer, onRemove, onClose }: { p: Player; onTransfer: () => void; onRemove: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/80" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={p.name} onClick={(e) => e.stopPropagation()} className="w-full max-w-[420px] rounded-t-[28px] bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full font-bold text-ink" style={{ background: `hsl(${hue(p.userId)} 80% 70%)` }}>{initials(p.name)}</div>
          <div className="flex-1">
            <p className="font-bold">{p.name}</p>
            <p className="text-sm text-mid">Session {signed(p.sessionBalance)}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <button onClick={onTransfer} className="h-14 rounded-2xl bg-paper font-bold text-ink active:scale-[.98]">Make host</button>
          <button onClick={onRemove} className="h-14 rounded-2xl bg-danger font-bold text-white active:scale-[.98]">Cash out / remove</button>
          <button onClick={onClose} className="h-12 rounded-2xl bg-surface-2 font-semibold">Close</button>
        </div>
      </div>
    </div>
  );
}
