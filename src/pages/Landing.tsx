import { GoogleButton } from '../components/GoogleButton';
import { Hero } from '../components/Hero';
import { NamePrompt } from '../components/NamePrompt';
import type { Session } from '../lib/session';

const PERKS = ['Your balance is always saved', 'Play from any phone', 'One tap, no password'];

/** First screen for anyone without a saved session. Google is the loud, recommended way in; the guest option is there but quiet and says what it costs. */
export function Landing({ onDone }: { onDone: (s: Session) => void }) {
  return (
    <div className="flex flex-1 flex-col gap-8">
      <Hero />
      <div className="mt-auto flex flex-col gap-4 pb-6">
        <section className="relative flex flex-col gap-3 rounded-3xl border-2 border-neon bg-surface px-4 pb-4 pt-6">
          <span className="absolute -top-3 left-4 rounded-full bg-neon px-3 py-1 text-[11px] font-bold tracking-widest text-ink">RECOMMENDED</span>
          <ul className="flex flex-col gap-1.5">
            {PERKS.map((p) => (
              <li key={p} className="flex items-start gap-2 text-sm">
                <span aria-hidden="true" className="font-bold text-neon">✓</span>
                {p}
              </li>
            ))}
          </ul>
          <GoogleButton onDone={onDone} />
        </section>

        <details className="group">
          <summary className="mx-auto flex h-11 w-fit cursor-pointer list-none items-center gap-1 px-3 text-sm text-mid underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden">
            Skip, play as a guest
            <span aria-hidden="true" className="transition-transform group-open:rotate-90">›</span>
          </summary>
          <div className="mt-2 flex flex-col gap-3">
            <p className="rounded-xl bg-surface px-3 py-2 text-xs text-mid">
              A guest account stays on this phone only. If you log out or clear your browser, your balance and games are gone. You can connect Google later to keep them.
            </p>
            <NamePrompt onDone={onDone} label="Play as Guest" />
          </div>
        </details>
      </div>
    </div>
  );
}
