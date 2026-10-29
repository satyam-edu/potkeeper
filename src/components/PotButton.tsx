import { useEffect, useRef, useState } from 'react';
import { rupees } from '../lib/format';

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

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        disabled={!onTap}
        onClick={onTap}
        aria-live="polite"
        className={`flex h-[clamp(96px,18dvh,150px)] w-[clamp(96px,18dvh,150px)] flex-col items-center justify-center rounded-full bg-neon text-ink transition-transform ${bump ? 'scale-110' : 'scale-100'} ${onTap ? 'active:scale-95' : ''}`}
      >
        <span className="display text-sm font-bold tracking-widest">POT</span>
        <span className="display text-[clamp(1.75rem,6dvh,3rem)] font-bold leading-none tabular-nums">{rupees(pot)}</span>
        {onTap && <span className="mt-1 hidden text-[10px] font-semibold uppercase [@media(min-height:700px)]:block">Tap to award</span>}
      </button>
      {carry > 0 && <span className="rounded-full bg-paper px-3 py-0.5 text-xs font-bold text-ink">+{rupees(carry)} carry</span>}
    </div>
  );
}
