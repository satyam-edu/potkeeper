import { rupees } from '../lib/format';

const buzz = () => navigator.vibrate?.(10);

const base = 'display h-16 rounded-3xl text-2xl font-bold active:translate-y-[2px] active:shadow-none disabled:bg-surface-2 disabled:text-mid disabled:shadow-none';

/** PACK / SHOW / BET in the thumb zone. Only enabled on your turn. */
export function ActionBar({ canAct, level, onBet, onPack, onShow }: { canAct: boolean; level: number; onBet: () => void; onPack: () => void; onShow: () => void }) {
  const press = (f: () => void) => () => {
    buzz();
    f();
  };
  return (
    <div className="flex gap-2 rounded-[28px] bg-surface p-2">
      <button disabled={!canAct} onClick={press(onPack)} className={`${base} basis-1/4 bg-danger text-white shadow-[0_4px_0_#9c2b2b]`}>
        Pack
      </button>
      <button disabled={!canAct} onClick={press(onShow)} className={`${base} basis-1/4 bg-paper text-ink shadow-[0_4px_0_#b8b8b8]`}>
        Show
      </button>
      <button disabled={!canAct} onClick={press(onBet)} className={`${base} flex-1 bg-neon text-ink shadow-[0_4px_0_#8fb300]`}>
        Bet {rupees(level)}
      </button>
    </div>
  );
}
