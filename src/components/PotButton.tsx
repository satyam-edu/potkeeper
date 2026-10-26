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
    <div className="flex flex-col items-center gap-2">
      <button
        disabled={!onTap}
        onClick={onTap}
        aria-live="polite"
        className={`flex h-[150px] w-[150px] flex-col items-center justify-center rounded-full bg-neon text-ink shadow-[0_0_40px_rgba(198,255,0,.35)] transition-transform ${bump ? 'scale-110' : 'scale-100'} ${onTap ? 'active:scale-95' : ''}`}
      >
        <span className="display text-sm font-bold tracking-widest">POT</span>
        <span className="display text-5xl font-bold leading-none tabular-nums">{rupees(pot)}</span>
        {onTap && <span className="mt-1 text-[10px] font-semibold uppercase">Tap to award</span>}
      </button>
      {carry > 0 && <span className="rounded-full bg-paper px-3 py-0.5 text-xs font-bold text-ink">+{rupees(carry)} carry</span>}
    </div>
  );
}
