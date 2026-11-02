import { GoogleButton } from './GoogleButton';
import { signed } from '../lib/format';
import type { Session } from '../lib/session';

/** Gentle nudge for guests: connect Google so the balance and games are never lost. `balance` makes it personal when there is something to lose. */
export function GuestSheet({ onDone, onLater, balance }: { onDone: (s: Session) => void; onLater: () => void; balance?: number | null }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/80" onClick={onLater}>
      <div role="dialog" aria-modal="true" aria-label="Save your progress" onClick={(e) => e.stopPropagation()} className="w-full max-w-[420px] rounded-t-[28px] bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        <h2 className="display text-3xl font-bold leading-tight">Save your <span className="text-neon">progress</span></h2>
        <p className="my-3 text-mid">
          {balance ? `Your ${signed(balance)} is saved on this phone only. ` : ''}
          Connect Google so your balance and games are never lost, even if you change phone or clear your browser.
        </p>
        <GoogleButton onDone={onDone} />
        <button onClick={onLater} className="mt-3 h-12 w-full rounded-2xl bg-surface-2 font-semibold">Maybe later</button>
      </div>
    </div>
  );
}
