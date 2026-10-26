import { useEffect, useState } from 'react';
import type { ClientMessage, RoomState } from '../../shared/types';
import { ELLIPSE_MAX, fromViewer, seatPositions } from '../lib/layout';
import { rupees } from '../lib/format';
import { ActionBar } from './ActionBar';
import { PotButton } from './PotButton';
import { SeatCard } from './SeatCard';
import { ShowdownModal } from './ShowdownModal';

export function GameTable({ state, meId, send }: { state: RoomState; meId: string; send: (m: ClientMessage) => void }) {
  const [showdown, setShowdown] = useState(false);
  const isHost = state.hostId === meId;
  // Round ended under us (e.g. everyone else packed): drop the stale modal so it can't reopen next round.
  useEffect(() => { if (state.phase !== 'BETTING') setShowdown(false); }, [state.phase]);
  const me = state.players.find((p) => p.userId === meId);
  const turnId = state.players[state.currentTurnIndex]?.userId;
  const myTurn = state.phase === 'BETTING' && turnId === meId && me?.status === 'ACTIVE';
  const turnName = state.players.find((p) => p.userId === turnId)?.name;
  const seats = fromViewer(state.players, meId);
  const seat = (p: (typeof seats)[number]) => (
    <SeatCard p={p} isTurn={state.phase === 'BETTING' && p.userId === turnId} isMe={p.userId === meId} isHost={p.userId === state.hostId} />
  );
  // Host or any ACTIVE player can call the showdown, since cards are flipped on the real table.
  const canAward = state.phase === 'BETTING' && (isHost || me?.status === 'ACTIVE');
  const active = state.players.filter((p) => p.status === 'ACTIVE');
  const pot = <PotButton pot={state.pot} carry={state.carryOverPot} onTap={canAward ? () => setShowdown(true) : undefined} />;

  return (
    <div className="flex flex-1 flex-col gap-3">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="display text-xl font-bold tracking-widest">{state.code}</span>
          <span className="rounded-full bg-neon px-2.5 py-0.5 text-xs font-extrabold text-ink">₹{state.baseBet} base</span>
        </div>
        <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-mid">Round {state.roundNumber}</span>
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
      <p className="sr-only">Pot {rupees(state.pot)}</p>
    </div>
  );
}
