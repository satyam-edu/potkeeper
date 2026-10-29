import { useEffect, useRef, useState } from 'react';
import { rupees } from '../lib/format';

// Where each coin of the pile sits (% of the pile box). The pile grows with the pot, up to the 12 spots.
const COINS: [number, number][] = [[50, 62], [32, 68], [68, 68], [42, 44], [58, 44], [22, 52], [78, 52], [50, 84], [36, 86], [64, 86], [50, 28], [50, 50]];
const coinCount = (pot: number) => (pot <= 0 ? 0 : Math.min(COINS.length, 2 + Math.ceil(Math.log2(pot + 1) * 1.6)));

/** The pot as a pile of notes and coins with the amount on a plate in front. Tap (host only) opens the showdown. */
export function PotButton({ pot, carry, onTap }: { pot: number; carry: number; onTap?: () => void }) {
  // Scale-pulse whenever the pot changes.
  const [bump, setBump] = useState(false);
  const last = useRef(pot);
  useEffect(() => {
    if (last.current === pot) return;
    last.current = pot;
    setBump(true);
    const t = setTimeout(() => setBump(false), 180);
    return () => clearTimeout(t);
  }, [pot]);
  const n = coinCount(pot);

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        disabled={!onTap}
        onClick={onTap}
        aria-live="polite"
        className={`relative flex h-[clamp(104px,19dvh,156px)] w-[clamp(104px,19dvh,156px)] flex-col items-center transition-transform ${bump ? 'scale-110' : 'scale-100'} ${onTap ? 'active:scale-95' : ''}`}
      >
        <span aria-hidden="true" className="relative w-full flex-1">
          {n > 0 && (
            <>
              <span className="absolute left-[10%] top-[18%] h-[44%] w-[62%] -rotate-[18deg] rounded-[3px] border-2 border-[#b65f12] bg-[#e8892b]" />
              <span className="absolute right-[8%] top-[26%] h-[44%] w-[62%] rotate-[14deg] rounded-[3px] border-2 border-[#1f7a43] bg-[#2f9e5b]" />
              {COINS.slice(0, n).map(([x, y], i) => (
                <span
                  key={i}
                  className="absolute aspect-square w-[24%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#8a6410] bg-[#d6a21a] shadow-[inset_0_0_0_3px_rgba(255,255,255,.3)]"
                  style={{ left: `${x}%`, top: `${y}%` }}
                />
              ))}
            </>
          )}
        </span>
        <span className="relative z-10 -mt-3 flex flex-col items-center rounded-2xl bg-ink/90 px-3 py-1 text-white">
          <span className="text-[10px] font-bold leading-none tracking-widest text-white/70">POT</span>
          <span className="text-[clamp(1.25rem,4.5dvh,2rem)] font-bold leading-tight tabular-nums">{rupees(pot)}</span>
          {onTap && <span className="hidden text-[9px] font-semibold uppercase leading-none text-neon [@media(min-height:700px)]:block">Tap to award</span>}
        </span>
      </button>
      {carry > 0 && <span className="rounded-full bg-paper px-3 py-0.5 text-xs font-bold text-ink">+{rupees(carry)} carry</span>}
    </div>
  );
}
