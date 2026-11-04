import type { CSSProperties } from 'react';
import { rupees } from '../lib/format';

/** The stake to match, as one big poker chip in the middle of the table. Tap (host only) opens the showdown. */
export function BetChip({ bet, onTap }: { bet: number; onTap?: () => void }) {
  const amount = rupees(bet);
  // Every size is a share of the chip (--chip), so the text grows and shrinks with it on any screen; longer amounts get a smaller share.
  const share = amount.length <= 3 ? 0.3 : amount.length === 4 ? 0.24 : 0.19;
  return (
    <div className="flex flex-col items-center gap-1" style={{ '--chip': 'clamp(84px,13dvh,112px)' } as CSSProperties}>
      <button disabled={!onTap} onClick={onTap} aria-live="polite" className={`transition-transform ${onTap ? 'active:scale-95' : ''}`}>
        <span
          className="grid h-[var(--chip)] w-[var(--chip)] place-items-center rounded-full shadow-[0_3px_0_rgba(0,0,0,.45)]"
          style={{ background: 'repeating-conic-gradient(#f2f2f2 0 22.5deg, #d7263d 22.5deg 45deg)' }}
        >
          <span className="grid h-[76%] w-[76%] place-items-center rounded-full border-2 border-dashed border-white/50 bg-ink">
            <span className="flex flex-col items-center leading-none">
              <span className="text-center font-bold tracking-widest text-white/70" style={{ fontSize: 'calc(var(--chip) * .085)', lineHeight: 1.1 }}>CURRENT<br />BET</span>
              <span key={bet} className="bump mt-[2%] font-bold tabular-nums text-neon" style={{ fontSize: `calc(var(--chip) * ${share})` }}>{amount}</span>
            </span>
          </span>
        </span>
      </button>
      {onTap && <span className="rounded-full bg-ink/80 px-2 py-0.5 text-[9px] font-bold uppercase leading-none text-neon">Tap to award</span>}
    </div>
  );
}
