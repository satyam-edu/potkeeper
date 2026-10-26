import { Hero } from '../components/Hero';
import { NamePrompt } from '../components/NamePrompt';
import type { Session } from '../lib/session';

const GoogleG = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
    <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
  </svg>
);

/** First screen for anyone without a saved session. */
export function Landing({ onDone }: { onDone: (s: Session) => void }) {
  return (
    <div className="flex flex-1 flex-col gap-8">
      <Hero />
      <div className="mt-auto flex flex-col gap-4 pb-6">
        {/* Wired up in P3-04 (Google OAuth) */}
        <button disabled className="flex h-14 items-center justify-center gap-3 rounded-2xl bg-paper font-bold text-ink disabled:opacity-60">
          <GoogleG /> Continue with Google
          <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold uppercase text-mid">Soon</span>
        </button>
        <div className="flex items-center gap-3 text-xs text-mid">
          <span className="h-px flex-1 bg-line" /> OR <span className="h-px flex-1 bg-line" />
        </div>
        <NamePrompt onDone={onDone} label="Play as Guest" />
        <p className="text-center text-xs text-mid">No account needed. Connect Google later to keep your wallet across devices.</p>
      </div>
    </div>
  );
}
