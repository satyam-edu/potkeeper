import { rupees } from '../lib/format';

/** The pot as one poker chip with the amount inside. Tap (host only) opens the showdown. */
export function PotButton({ pot, carry, onTap }: { pot: number; carry: number; onTap?: () => void }) {
  const amount = rupees(pot);

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        disabled={!onTap}
        onClick={onTap}
        aria-live="polite"
        className={`flex flex-col items-center gap-1 transition-transform ${onTap ? 'active:scale-95' : ''}`}
      >
        <span
          className="grid h-[clamp(76px,12dvh,100px)] w-[clamp(76px,12dvh,100px)] place-items-center rounded-full shadow-[0_3px_0_rgba(0,0,0,.45)]"
          style={{ background: 'repeating-conic-gradient(#f2f2f2 0 22.5deg, #d7263d 22.5deg 45deg)' }}
        >
          <span className="grid h-[72%] w-[72%] place-items-center rounded-full border-2 border-dashed border-white/50 bg-ink text-white">
            <span className="flex flex-col items-center leading-none">
              <span className="text-[9px] font-bold tracking-widest text-white/70">POT</span>
              <span className={`mt-0.5 font-bold tabular-nums ${amount.length <= 3 ? 'text-2xl' : amount.length <= 5 ? 'text-xl' : 'text-base'}`}>{amount}</span>
            </span>
          </span>
        </span>
        {onTap && <span className="rounded-full bg-ink/80 px-2 py-0.5 text-[9px] font-bold uppercase leading-none text-neon">Tap to award</span>}
      </button>
      {carry > 0 && <span className="rounded-full bg-paper px-3 py-0.5 text-xs font-bold text-ink">+{rupees(carry)} carry</span>}
    </div>
  );
}
