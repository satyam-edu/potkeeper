import { GoogleButton } from '../components/GoogleButton';
import { Hero } from '../components/Hero';
import { NamePrompt } from '../components/NamePrompt';
import type { Session } from '../lib/session';

/** First screen for anyone without a saved session. */
export function Landing({ onDone }: { onDone: (s: Session) => void }) {
  return (
    <div className="flex flex-1 flex-col gap-8">
      <Hero />
      <div className="mt-auto flex flex-col gap-4 pb-6">
        <GoogleButton onDone={onDone} />
        <div className="flex items-center gap-3 text-xs text-mid">
          <span className="h-px flex-1 bg-line" /> OR <span className="h-px flex-1 bg-line" />
        </div>
        <NamePrompt onDone={onDone} label="Play as Guest" />
        <p className="text-center text-xs text-mid">No account needed. Connect Google later to keep your wallet across devices.</p>
      </div>
    </div>
  );
}
