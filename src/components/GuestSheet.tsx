import { GoogleButton } from './GoogleButton';
import type { Session } from '../lib/session';

/** Gentle nudge for guests: sign in with Google to keep the wallet across devices. */
export function GuestSheet({ onDone, onLater }: { onDone: (s: Session) => void; onLater: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/80" onClick={onLater}>
      <div role="dialog" aria-modal="true" aria-label="Connect Google" onClick={(e) => e.stopPropagation()} className="w-full max-w-[420px] rounded-t-[28px] bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        <h2 className="display text-3xl font-bold leading-tight">Save your <span className="text-neon">wallet</span></h2>
        <p className="my-3 text-mid">Connect your Google account to keep your wallet and game history across devices. Nothing you've won or lost so far is lost.</p>
        <GoogleButton onDone={onDone} />
        <button onClick={onLater} className="mt-3 h-12 w-full rounded-2xl bg-surface-2 font-semibold">Maybe later</button>
      </div>
    </div>
  );
}
