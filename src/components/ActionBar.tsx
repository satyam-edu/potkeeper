import { rupees } from '../lib/format';

const buzz = () => navigator.vibrate?.(10);

/** PACK / BET in the thumb zone. Only enabled on your turn. */
export function ActionBar({ canAct, baseBet, onBet, onPack }: { canAct: boolean; baseBet: number; onBet: () => void; onPack: () => void }) {
  const press = (f: () => void) => () => {
    buzz();
    f();
  };
  return (
    <div className="flex gap-3 rounded-[28px] bg-surface p-2">
      <button
        disabled={!canAct}
        onClick={press(onPack)}
        className="display h-16 basis-[38%] rounded-3xl bg-danger text-2xl font-bold text-white shadow-[0_4px_0_#9c2b2b] active:translate-y-[2px] active:shadow-none disabled:bg-surface-2 disabled:text-mid disabled:shadow-none"
      >
        Pack
      </button>
      <button
        disabled={!canAct}
        onClick={press(onBet)}
        className="display h-16 flex-1 rounded-3xl bg-neon text-2xl font-bold text-ink shadow-[0_4px_0_#8fb300] active:translate-y-[2px] active:shadow-none disabled:bg-surface-2 disabled:text-mid disabled:shadow-none"
      >
        Bet +{rupees(baseBet)}
      </button>
    </div>
  );
}
