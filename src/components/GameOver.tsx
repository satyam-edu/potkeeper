import { simplifyDebts } from '../../shared/settle';
import type { ClientMessage, RoomState } from '../../shared/types';
import { rupees, signed } from '../lib/format';

const SAVE_TEXT = {
  saving: 'Saving to wallets…',
  saved: '✓ Saved to your wallet',
  failed: "Couldn't save to wallets. Screenshot this screen and tell the host.",
};

const BTN = 'display h-16 rounded-3xl text-xl font-bold uppercase tracking-wide active:translate-y-[2px] active:shadow-none disabled:bg-surface-2 disabled:text-mid disabled:shadow-none';

/** Settle-Up screen (DESIGN 6.6): leaderboard, who pays whom, and whether the wallets were updated. */
export function GameOver({ state, save, isHost, send, onHome }: { state: RoomState; save: keyof typeof SAVE_TEXT; isHost: boolean; send: (m: ClientMessage) => void; onHome: () => void }) {
  const name = (id: string) => state.players.find((p) => p.userId === id)?.name ?? '?';
  const board = [...state.players].sort((a, b) => b.sessionBalance - a.sessionBalance);
  const payments = simplifyDebts(Object.fromEntries(state.players.map((p) => [p.userId, p.sessionBalance])));
  const rounds = state.roundNumber;
  return (
    <div className="flex flex-1 flex-col gap-5 pt-4">
      <div>
        <h1 className="display text-5xl font-bold leading-none">Game <span className="text-neon">over</span></h1>
        <p className="mt-2 text-mid">{rounds} round{rounds === 1 ? '' : 's'} played</p>
      </div>
      <section>
        <p className="mb-2 text-xs text-mid">LEADERBOARD</p>
        <ul className="flex flex-col gap-2">
          {board.map((p, i) => {
            const winner = i === 0 && p.sessionBalance > 0;
            return (
              <li key={p.userId} className={`flex items-center justify-between rounded-2xl px-4 py-3 ${winner ? 'bg-neon text-ink' : 'bg-surface'}`}>
                <span className="flex items-center gap-3 font-semibold">
                  <span className="display w-5 text-lg opacity-60">{i + 1}</span>
                  {p.name}
                </span>
                <span className={`display text-xl font-bold tabular-nums ${winner ? '' : p.sessionBalance < 0 ? 'text-danger' : 'text-neon'}`}>{signed(p.sessionBalance)}</span>
              </li>
            );
          })}
        </ul>
      </section>
      {payments.length > 0 && (
        <section>
          <p className="mb-2 text-xs text-mid">SETTLE UP</p>
          <ul className="flex flex-col gap-2">
            {payments.map((pay) => (
              <li key={pay.from + pay.to} className="flex items-center justify-between rounded-2xl bg-paper px-4 py-3 font-semibold text-ink">
                <span>{name(pay.from)} → {name(pay.to)}</span>
                <span className="display text-xl font-bold tabular-nums">{rupees(pay.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="mt-auto flex flex-col gap-3 pb-2">
        <p role="status" className={`text-center text-sm ${save === 'saved' ? 'text-neon' : save === 'failed' ? 'text-danger' : 'text-mid'}`}>{SAVE_TEXT[save]}</p>
        {isHost && (
          <>
            <div className="flex gap-2">
              <button disabled={save !== 'saved'} onClick={() => send({ t: 'NEW_GAME' })} className={`${BTN} flex-1 bg-neon text-ink shadow-[0_4px_0_var(--color-neon-dim)]`}>New game</button>
              <button disabled={save !== 'saved'} onClick={() => send({ t: 'REOPEN_GAME' })} className={`${BTN} flex-1 bg-paper text-ink shadow-[0_4px_0_#b8b8b8]`}>Reopen game</button>
            </div>
            <p className="text-center text-xs text-mid">New game starts from ₹0. Reopen keeps these totals and keeps playing.</p>
          </>
        )}
        {!isHost && <p className="text-center text-xs text-mid">The host can start a new game or reopen this one.</p>}
        <button onClick={onHome} className={isHost ? 'h-14 rounded-2xl bg-surface-2 font-semibold' : `${BTN} h-16 bg-neon text-ink shadow-[0_4px_0_var(--color-neon-dim)]`}>
          Back to Home
        </button>
      </div>
    </div>
  );
}
