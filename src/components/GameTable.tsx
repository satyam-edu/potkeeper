import { useEffect, useRef, useState } from 'react';
import { showdownPot } from '../../shared/engine';
import type { ClientMessage, Player, RoomState } from '../../shared/types';
import { roundWinners, seatNet, type Winner } from '../lib/roundResult';
import { useWakeLock } from '../lib/useWakeLock';
import { ELLIPSE_MAX, fromViewer, seatPositions } from '../lib/layout';
import { rupees, signed } from '../lib/format';
import { ActionBar } from './ActionBar';
import { loadSounds } from '../lib/sound';
import { ConfirmModal } from './ConfirmModal';
import { PlayerSheet } from './PlayerSheet';
import { PotButton } from './PotButton';
import { GameTotalSheet } from './GameTotalSheet';
import { Scoreboard } from './Scoreboard';
import { SeatCard } from './SeatCard';
import { SoundToggle } from './SoundToggle';
import { RulesSheet } from './RulesSheet';
import { ShowdownModal } from './ShowdownModal';

export function GameTable({ state, meId, send }: { state: RoomState; meId: string; send: (m: ClientMessage) => void }) {
  useWakeLock();
  useEffect(() => { void loadSounds(); }, []);
  const [rules, setRules] = useState(false);
  const [totals, setTotals] = useState(false);
  const [result, setResult] = useState<Winner[] | null>(null);
  const [winPopup, setWinPopup] = useState(false); // centre popup for a few seconds after a round ends
  const prev = useRef<RoomState | null>(null);
  // Remember who just won so the table can celebrate until the next round starts.
  useEffect(() => {
    const w = prev.current ? roundWinners(prev.current, state) : [];
    if (w.length) { setResult(w); setWinPopup(true); }
    else if (state.phase !== 'BETWEEN_ROUNDS') { setResult(null); setWinPopup(false); }
    prev.current = state;
  }, [state]);
  useEffect(() => {
    if (!winPopup) return;
    const t = setTimeout(() => setWinPopup(false), 4000);
    return () => clearTimeout(t);
  }, [winPopup]);
  const [sheet, setSheet] = useState<Player | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'end' } | { kind: 'remove' | 'transfer'; p: Player } | null>(null);
  const isHost = state.hostId === meId;
  const me = state.players.find((p) => p.userId === meId);
  const turnId = state.players[state.currentTurnIndex]?.userId;
  const myTurn = state.phase === 'BETTING' && turnId === meId && me?.status === 'ACTIVE';
  const staked = state.players.reduce((n, p) => n + p.roundBet, 0);
  const shower = state.players.find((p) => p.userId === state.showBy);
  const turnName = state.players.find((p) => p.userId === turnId)?.name;
  const seats = fromViewer(state.players, meId);
  const seat = (p: (typeof seats)[number], fluid = false) => (
    <SeatCard
      fluid={fluid}
      net={seatNet(state, p)}
      won={!!result?.some((w) => w.userId === p.userId)}
      onClick={isHost && p.userId !== meId && !p.cashedOut ? () => setSheet(p) : undefined}
      p={p} isTurn={state.phase === 'BETTING' && p.userId === turnId} isMe={p.userId === meId} isHost={p.userId === state.hostId} />
  );
  // Only the host can tap the pot to award it. Any player on their turn can still use Show, which opens the same winner list.
  const canAward = state.phase === 'BETTING' && isHost;
  const active = state.players.filter((p) => p.status === 'ACTIVE');
  const pot = <PotButton pot={state.pot} carry={state.carryOverPot} onTap={canAward && !state.showBy ? () => send({ t: 'SHOW' }) : undefined} />;

  return (
    <div className="flex h-[calc(100dvh-0.75rem-max(1rem,env(safe-area-inset-bottom)))] flex-col gap-2">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="display text-xl font-bold tracking-widest">{state.code}</span>
          <span className="rounded-full bg-neon px-2.5 py-0.5 text-xs font-extrabold text-ink">₹{state.baseBet}</span>
          <span className="text-xs font-semibold text-mid">R{state.roundNumber}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setRules(true)} aria-label="Hand rules" className="h-9 w-9 rounded-full bg-surface-2 font-bold text-neon">?</button>
          {isHost && (<>
            <button disabled={state.historyStack.length === 0} onClick={() => send({ t: 'UNDO' })} className="h-9 rounded-full bg-surface-2 px-4 text-sm font-bold disabled:opacity-40">↶ Undo</button>
            <button onClick={() => setConfirm({ kind: 'end' })} className="h-9 rounded-full bg-danger px-4 text-sm font-bold">End</button>
          </>)}
        </div>
      </header>

      <div className="relative">
        <Scoreboard state={state} meId={meId} onOpen={() => setTotals(true)} />
        <SoundToggle className="absolute right-1 top-0" />
      </div>

      {seats.length <= ELLIPSE_MAX ? (
        <div className="relative mx-auto min-h-0 w-full flex-1">
          {seatPositions(seats.length, 36, 35).map((pos, i) => (
            <div key={seats[i]!.userId} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${pos.left}%`, top: `${pos.top}%` }}>
              {seat(seats[i]!)}
            </div>
          ))}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">{pot}</div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
          {pot}
          <div className={`grid w-full gap-1.5 ${seats.length > 8 ? 'grid-cols-5' : 'grid-cols-4'}`}>
            {seats.map((p) => (
              <div key={p.userId}>{seat(p, true)}</div>
            ))}
          </div>
        </div>
      )}

      {winPopup && state.phase === 'BETWEEN_ROUNDS' && result && (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center px-8">
          <div className="absolute inset-0 bg-ink/75 backdrop-blur-sm" aria-hidden="true" />
          <button
            onClick={() => setWinPopup(false)}
            aria-live="polite"
            className="pop pointer-events-auto flex max-w-full flex-col items-center gap-1 relative rounded-[28px] border border-white bg-white/90 px-8 py-6 text-center text-ink backdrop-blur-xl"
          >
            <span className="text-2xl text-neon-dim" aria-hidden="true">★</span>
            {result.map((w) => (
              <span key={w.userId} className="flex flex-col items-center leading-tight">
                <span className="break-words text-2xl font-bold [overflow-wrap:anywhere]">{w.name}</span>
                <span className="text-4xl font-bold tabular-nums">won {rupees(Math.max(0, (state.roundLog ?? []).at(-1)?.[w.userId] ?? 0))}</span>
              </span>
            ))}
          </button>
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
          <p className="flex items-center justify-center gap-3 rounded-2xl border-2 border-neon bg-surface py-1.5">
            <span className="blink h-2.5 w-2.5 rounded-full bg-neon" aria-hidden="true" />
            <span className="text-xs font-bold uppercase tracking-widest text-mid">Current bet</span>
            <span key={state.currentBet} className="bump text-3xl font-bold leading-none tabular-nums text-neon">{rupees(state.currentBet)}</span>
          </p>
          <p className="text-center text-sm font-semibold" aria-live="polite">
            {me?.status === 'WAITING' ? "You'll join next round" : myTurn ? <span className="text-neon">YOUR TURN</span> : <span className="text-mid">{turnName ? `${turnName}'s turn` : ''}</span>}
          </p>
          <ActionBar canAct={myTurn && !state.showBy} level={state.currentBet + state.baseBet} onBet={() => send({ t: 'BET' })} onPack={() => send({ t: 'PACK' })} onShow={() => send({ t: 'SHOW' })} />
        </>
      )}
      {state.phase === 'BETTING' && shower && (
        <ShowdownModal
          pot={showdownPot(state)}
          topUp={showdownPot(state) - state.pot}
          active={active}
          by={shower.name}
          canPick={isHost || me?.status === 'ACTIVE'}
          onAward={(ids) => send({ t: 'AWARD_POT', winnerIds: ids })}
          onClose={isHost || state.showBy === meId ? () => send({ t: 'CANCEL_SHOW' }) : undefined}
        />
      )}
      {totals && <GameTotalSheet state={state} meId={meId} onClose={() => setTotals(false)} />}
      {rules && <RulesSheet onClose={() => setRules(false)} />}
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
