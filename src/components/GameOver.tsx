import { simplifyDebts } from '../../shared/settle';
import type { RoomState } from '../../shared/types';
import { rupees, signed } from '../lib/format';

/** Interim end-of-game view built from room state. Replaced by the saved Settle-Up screen in Phase 4. */
export function GameOver({ state }: { state: RoomState }) {
  const name = (id: string) => state.players.find((p) => p.userId === id)?.name ?? '?';
  const board = [...state.players].sort((a, b) => b.sessionBalance - a.sessionBalance);
  const payments = simplifyDebts(Object.fromEntries(state.players.map((p) => [p.userId, p.sessionBalance])));
  return (
    <div className="flex flex-1 flex-col gap-5 pt-4">
      <h1 className="display text-5xl font-bold leading-none">Game <span className="text-neon">over</span></h1>
      <p className="text-mid">{state.roundNumber} round{state.roundNumber === 1 ? '' : 's'} played</p>
      <ul className="flex flex-col gap-2">
        {board.map((p, i) => (
          <li key={p.userId} className={`flex items-center justify-between rounded-2xl px-4 py-3 ${i === 0 && p.sessionBalance > 0 ? 'bg-neon text-ink' : 'bg-surface'}`}>
            <span className="font-semibold">{p.name}</span>
            <span className={`display text-xl font-bold tabular-nums ${i === 0 && p.sessionBalance > 0 ? '' : p.sessionBalance < 0 ? 'text-danger' : 'text-neon'}`}>{signed(p.sessionBalance)}</span>
          </li>
        ))}
      </ul>
      {payments.length > 0 && (
        <section>
          <p className="mb-2 text-xs text-mid">SETTLE UP</p>
          <ul className="flex flex-col gap-2">
            {payments.map((pay) => (
              <li key={pay.from + pay.to} className="rounded-2xl bg-paper px-4 py-3 font-semibold text-ink">
                {name(pay.from)} pays {rupees(pay.amount)} to {name(pay.to)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
