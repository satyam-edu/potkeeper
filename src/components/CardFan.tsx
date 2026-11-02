import { useState, type CSSProperties } from 'react';
import { after } from '../lib/anim';

// A Pure Sequence (A K Q of one suit): the best hand after a Trail.
const CARDS = [
  { rank: 'A', x: -58, r: -14, d: 0.3 },
  { rank: 'K', x: 58, r: 14, d: 0.45 },
  { rank: 'Q', x: 0, r: 0, d: 0.6 },
] as const;

/** Three cards are dealt, turn over and float. Tap them to deal again. */
export function CardFan() {
  const [round, setRound] = useState(0);
  return (
    <div className="flex flex-col items-center gap-2">
      <button key={round} onClick={() => setRound((n) => n + 1)} aria-label="Deal the cards again" className="bob relative h-44 w-64 active:scale-95">
        {CARDS.map((c) => (
          <span
            key={c.rank}
            style={{ ...after(c.d), '--x': `${c.x}px`, '--r': `${c.r}deg` } as CSSProperties}
            className="deal-card absolute left-1/2 top-3 -ml-12 block h-36 w-24 [perspective:600px]"
          >
            <span className="flip-card relative block h-full w-full">
              <span className="absolute inset-0 flex flex-col justify-between rounded-xl border-2 border-ink/20 bg-paper p-2 text-ink [backface-visibility:hidden]">
                <span className="display text-2xl font-bold leading-none">{c.rank}<span className="block text-lg">♠</span></span>
                <span className="self-center text-5xl leading-none">♠</span>
                <span className="display rotate-180 text-2xl font-bold leading-none">{c.rank}<span className="block text-lg">♠</span></span>
              </span>
              <span className="absolute inset-0 rounded-xl border-2 border-white bg-[repeating-linear-gradient(45deg,#8e1b1b_0_4px,#b02a2a_4px_8px)] [backface-visibility:hidden] [transform:rotateY(180deg)]" />
            </span>
          </span>
        ))}
      </button>
      <p style={after(2.6)} className="rise text-xs font-semibold tracking-widest text-mid">PURE SEQUENCE · TAP TO DEAL AGAIN</p>
    </div>
  );
}
