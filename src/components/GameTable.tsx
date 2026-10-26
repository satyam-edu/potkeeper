import { useEffect, useState } from 'react';
import type { ClientMessage, Player, RoomState } from '../../shared/types';
import { ELLIPSE_MAX, fromViewer, seatPositions } from '../lib/layout';
import { rupees, signed } from '../lib/format';
import { ActionBar } from './ActionBar';
import { ConfirmModal } from './ConfirmModal';
import { GameOver } from './GameOver';
import { PlayerSheet } from './PlayerSheet';
import { PotButton } from './PotButton';
import { SeatCard } from './SeatCard';
import { ShowdownModal } from './ShowdownModal';

export function GameTable({ state, meId, send }: { state: RoomState; meId: string; send: (m: ClientMessage) => void }) {
  const [showdown, setShowdown] = useState(false);
  const [sheet, setSheet] = useState<Player | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'end' } | { kind: 'remove' | 'transfer'; p: Player } | null>(null);
  const isHost = state.hostId === meId;
  // Round ended under us (e.g. everyone else packed): drop the stale modal so it can't reopen next round.
  useEffect(() => { if (state.phase !== 'BETTING') setShowdown(false); }, [state.phase]);
  const me = state.players.find((p) => p.userId === meId);
  const turnId = state.players[state.currentTurnIndex]?.userId;
  const myTurn = state.phase === 'BETTING' && turnId === meId && me?.status === 'ACTIVE';
  const staked = state.players.reduce((n, p) => n + p.roundBet, 0);
  const turnName = state.players.find((p) => p.userId === turnId)?.name;
  const seats = fromViewer(state.players, meId);
  const seat = (p: (typeof seats)[number]) => (
    <SeatCard
      onClick={isHost && p.userId !== meId && !p.cashedOut ? () => setSheet(p) : undefined}
      p={p} isTurn={state.phase === 'BETTING' && p.userId === turnId} isMe={p.userId === meId} isHost={p.userId === state.hostId} />
  );
  // Host or any ACTIVE player can call the showdown, since cards are flipped on the real table.
  const canAward = state.phase === 'BETTING' && (isHost || me?.status === 'ACTIVE');
  const active = state.players.filter((p) => p.status === 'ACTIVE');
  const pot = <PotButton pot={state.pot} carry={state.carryOverPot} onTap={canAward ? () => setShowdown(true) : undefined} />;

  if (state.phase === 'ENDED') return <GameOver state={state} />;

  return (
    <div className="flex flex-1 flex-col gap-3">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="display text-xl font-bold tracking-widest">{state.code}</span>
          <span className="rounded-full bg-neon px-2.5 py-0.5 text-xs font-extrabold text-ink">₹{state.baseBet}</span>
          <span className="text-xs font-semibold text-mid">R{state.roundNumber}</span>
        </div>
        {isHost && (
          <div className="flex gap-2">
            <button disabled={state.historyStack.length === 0} onClick={() => send({ t: 'UNDO' })} className="h-9 rounded-full bg-surface-2 px-4 text-sm font-bold disabled:opacity-40">↶ Undo</button>
            <button onClick={() => setConfirm({ kind: 'end' })} className="h-9 rounded-full bg-danger px-4 text-sm font-bold">End</button>
          </div>
        )}
      </header>

      {seats.length <= ELLIPSE_MAX ? (
        <div className="relative mx-auto aspect-[4/5] w-full flex-1">
          {seatPositions(seats.length).map((pos, i) => (
            <div key={seats[i]!.userId} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${pos.left}%`, top: `${pos.top}%` }}>
              {seat(seats[i]!)}
            </div>
          ))}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">{pot}</div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center gap-4">
          <div className="grid grid-cols-4 gap-2">
            {seats.map((p) => (
              <div key={p.userId}>{seat(p)}</div>
            ))}
          </div>
          {pot}
        </div>
      )}

      {state.phase === 'BETWEEN_ROUNDS' ? (
        isHost ? (
          <button onClick={() => send({ t: 'START_ROUND' })} className="display h-16 rounded-3xl bg-neon text-2xl font-bold text-ink shadow-[0_4px_0_#8fb300] active:translate-y-[2px] active:shadow-none">
            Next Round
          </button>
        ) : (
          <p className="py-4 text-center text-mid">Round over · waiting for the host…</p>
        )
      ) : (
        <>
          <p className="text-center text-sm font-semibold" aria-live="polite">
            {me?.status === 'WAITING' ? "You'll join next round" : myTurn ? <span className="text-neon">YOUR TURN</span> : <span className="text-mid">{turnName ? `${turnName}'s turn` : ''}</span>}
          </p>
          <ActionBar canAct={myTurn} baseBet={state.baseBet} onBet={() => send({ t: 'BET' })} onPack={() => send({ t: 'PACK' })} />
        </>
      )}
      {showdown && state.phase === 'BETTING' && (
        <ShowdownModal
          pot={state.pot}
          active={active}
          onAward={(ids) => { send({ t: 'AWARD_POT', winnerIds: ids }); setShowdown(false); }}
          onClose={() => setShowdown(false)}
        />
      )}
      {sheet && (
        <PlayerSheet
          p={sheet}
          onClose={() => setSheet(null)}
          onTransfer={() => { setConfirm({ kind: 'transfer', p: sheet }); setSheet(null); }}
          onRemove={() => { setConfirm({ kind: 'remove', p: sheet }); setSheet(null); }}
        />
      )}
      {confirm?.kind === 'end' && (
        <ConfirmModal
          tone="danger"
          title="End game now?"
          body={staked > 0
            ? `A round is in progress. Current round bets (${rupees(staked)}) will be refunded and the session will close.`
            : 'The session closes and final balances are settled.'}
          confirmLabel={staked > 0 ? 'Refund & End Game' : 'End Game'}
          onConfirm={() => { send({ t: 'END_GAME' }); setConfirm(null); }}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm?.kind === 'remove' && (
        <ConfirmModal
          tone="danger"
          title={`Cash out ${confirm.p.name}?`}
          body={`${confirm.p.name}'s balance (${signed(confirm.p.sessionBalance)}) is locked into the final settlement.${state.phase === 'BETTING' && confirm.p.status === 'ACTIVE' ? ' They fold, and their stake stays in the pot.' : ''}`}
          confirmLabel="Cash Out"
          onConfirm={() => { send({ t: 'REMOVE_PLAYER', userId: confirm.p.userId }); setConfirm(null); }}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm?.kind === 'transfer' && (
        <ConfirmModal
          tone="paper"
          title={`Make ${confirm.p.name} the host?`}
          body="You lose Undo, End Game and the power to remove players."
          confirmLabel="Transfer"
          onConfirm={() => { send({ t: 'TRANSFER_HOST', toUserId: confirm.p.userId }); setConfirm(null); }}
          onCancel={() => setConfirm(null)}
        />
      )}
      <p className="sr-only">Pot {rupees(state.pot)}</p>
    </div>
  );
}
