import { useEffect, useRef, useState } from 'react';
import { CardFan } from '../components/CardFan';
import { GoogleButton } from '../components/GoogleButton';
import { Hero } from '../components/Hero';
import { NamePrompt } from '../components/NamePrompt';
import { after } from '../lib/anim';
import type { Session } from '../lib/session';

const PERKS = ['Your balance is always saved', 'Play from any phone', 'One tap, no password'];

// Faint suits floating up behind the page: left %, size, seconds to cross, start delay, colour.
const SUITS = [
  { s: '♠', left: 6, size: 28, t: 17, d: 0, c: 'text-white/10' },
  { s: '♥', left: 22, size: 40, t: 21, d: 4, c: 'text-neon/15' },
  { s: '♦', left: 38, size: 24, t: 15, d: 9, c: 'text-white/10' },
  { s: '♣', left: 54, size: 36, t: 19, d: 2, c: 'text-neon/15' },
  { s: '♠', left: 68, size: 26, t: 16, d: 7, c: 'text-white/10' },
  { s: '♥', left: 82, size: 34, t: 22, d: 11, c: 'text-neon/15' },
  { s: '♦', left: 92, size: 22, t: 14, d: 5, c: 'text-white/10' },
] as const;

/** First screen for anyone without a saved session. Google is the loud, recommended way in; the guest option is there but quiet and says what it costs. */
export function Landing({ onDone }: { onDone: (s: Session) => void }) {
  // The guest form is a bottom sheet: it slides up over the page, then the cursor goes into the name box.
  const [guest, setGuest] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!guest) return;
    const focus = setTimeout(() => sheet.current?.querySelector('input')?.focus({ preventScroll: true }), 400); // after it has slid up; a phone may still wait for a tap
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setGuest(false);
    document.addEventListener('keydown', esc);
    return () => { clearTimeout(focus); document.removeEventListener('keydown', esc); };
  }, [guest]);
  return (
    <>
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        {SUITS.map((x, i) => (
          <span key={i} style={{ ...after(x.d), left: `${x.left}%`, fontSize: x.size, '--t': `${x.t}s` } as React.CSSProperties} className={`suit-drift ${x.c}`}>{x.s}</span>
        ))}
      </div>
      <div className="relative z-10 flex flex-1 flex-col gap-[clamp(0.5rem,2dvh,1rem)]">
        <Hero />
        <div className="flex min-h-0 flex-1 items-center justify-center"><CardFan /></div>
        <div className="flex flex-col gap-[clamp(0.25rem,1.5dvh,1rem)] pb-[clamp(0.25rem,2dvh,1.5rem)]">
          <section style={after(0.5)} className="rise relative flex flex-col gap-3 rounded-3xl border-2 border-neon bg-surface px-4 pb-4 pt-6">
            <span className="shine absolute -top-3 left-4 rounded-full bg-neon px-3 py-1 text-[11px] font-bold tracking-widest text-ink">RECOMMENDED</span>
            <ul className="flex flex-col gap-1.5">
              {PERKS.map((p, i) => (
                <li key={p} style={after(0.9 + i * 0.15)} className="fade flex items-start gap-2 text-sm">
                  <span aria-hidden="true" className="font-bold text-neon">✓</span>
                  {p}
                </li>
              ))}
            </ul>
            <GoogleButton onDone={onDone} />
          </section>

          <button
            style={after(1.5)}
            onClick={() => setGuest(true)}
            aria-haspopup="dialog"
            className="fade mx-auto flex h-11 w-fit items-center gap-1 px-3 text-sm text-mid underline-offset-4 hover:underline"
          >
            Skip, play as a guest <span aria-hidden="true">›</span>
          </button>
        </div>
      </div>
      {guest && (
        <div style={after(0)} className="fade fixed inset-0 z-40 flex items-end justify-center bg-ink/80" onClick={() => setGuest(false)}>
          <div ref={sheet} role="dialog" aria-modal="true" aria-label="Play as a guest" onClick={(e) => e.stopPropagation()} className="sheet-up w-full max-w-[420px] rounded-t-[28px] bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
            <h2 className="display text-3xl font-bold leading-tight">Play as a <span className="text-neon">guest</span></h2>
            <p className="my-3 text-sm text-mid">
              A guest account stays on this phone only. If you log out or clear your browser, your balance and games are gone. You can connect Google later to keep them.
            </p>
            <NamePrompt onDone={onDone} label="Play as Guest" autoFocus={false} />
            <button onClick={() => setGuest(false)} className="mt-3 h-12 w-full rounded-2xl btn-quiet font-semibold">Back to Google</button>
          </div>
        </div>
      )}
    </>
  );
}
