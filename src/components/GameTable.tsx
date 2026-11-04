import { useEffect, useRef, useState } from 'react';
import { showdownPot } from '../../shared/engine';
import type { ClientMessage, Player, RoomState } from '../../shared/types';
import { roundWinners, seatNet, type Winner } from '../lib/roundResult';
import { useWakeLock } from '../lib/useWakeLock';
import { fromViewer, seatPositions } from '../lib/layout';
import { rupees, seatLabels, signed } from '../lib/format';
import { ActionBar } from './ActionBar';
import { loadSounds } from '../lib/sound';
import { ConfirmModal } from './ConfirmModal';
import { PlayerSheet } from './PlayerSheet';
import { BetChip } from './BetChip';
import { GameTotalSheet } from './GameTotalSheet';
import { Scoreboard } from './Scoreboard';
import { WinCard } from './WinCard';
import { SeatCard } from './SeatCard';
import { SeatingSheet } from './SeatingSheet';
import { SoundToggle } from './SoundToggle';
import { RulesSheet } from './RulesSheet';
import { ShowdownModal } from './ShowdownModal';

export function GameTable({ state, meId, send }: { state: RoomState; meId: string; send: (m: ClientMessage) => void }) {
  useWakeLock();
  useEffect(() => { void loadSounds(); }, []);
  const [rules, setRules] = useState(false);
  const [totals, setTotals] = useState(false);
  const [seating, setSeating] = useState(false);
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
  const [sheet, setSheet] = useState<Player | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'end' } | { kind: 'remove' | 'transfer'; p: Player } | null>(null);
  const isHost = state.hostId === meId;
  const me = state.players.find((p) => p.userId === meId);
  const turnId = state.players[state.currentTurnIndex]?.userId;
  const myTurn = state.phase === 'BETTING' && turnId === meId && me?.status === 'ACTIVE';
  const staked = state.players.reduce((n, p) => n + p.roundBet, 0);
  const shower = state.players.find((p) => p.userId === state.showBy);
  const seats = fromViewer(state.players.filter((p) => !p.cashedOut), meId); // cashed out players leave the table; they come back if the Host allows a rejoin
  // The D button marks who opened this round (they bet first); it moves on to the next player each round.
  const opener = state.players[state.startIndex];
  const dealerId = opener && !opener.cashedOut ? opener.userId : null;
  const labels = seatLabels(seats);
  const seat = (p: (typeof seats)[number]) => (
    <SeatCard
      label={labels[p.userId] ?? p.name}
      dealer={p.userId === dealerId}
      net={seatNet(state, p)}
      won={!!result?.some((w) => w.userId === p.userId)}
      onClick={isHost && p.userId !== meId ? () => setSheet(p) : undefined}
      p={p} isTurn={state.phase === 'BETTING' && p.userId === turnId} isMe={p.userId === meId} isHost={p.userId === state.hostId} />
  );
  // Only the host can tap the pot to award it. Any player on their turn can still use Show, which opens the same winner list.
  const canAward = state.phase === 'BETTING' && isHost;
  const active = state.players.filter((p) => p.status === 'ACTIVE');
  const pot = <BetChip bet={state.currentBet} onTap={canAward && !state.showBy ? () => send({ t: 'SHOW' }) : undefined} />;
  // Whose turn it is, under the chip.
  const betInfo = (
    <p className="max-w-[150px] text-center text-xs font-semibold leading-tight [overflow-wrap:anywhere]" aria-live="polite">
      {me?.status === 'WAITING' ? <span className="text-white/80 [text-shadow:0_1px_3px_rgba(0,0,0,.9)]">You'll join next round</span> : myTurn ? <span className="flex items-center justify-center gap-1.5 text-sm font-bold text-neon"><span className="blink h-2 w-2 rounded-full bg-neon" aria-hidden="true" />YOUR TURN</span> : <span className="text-white/80 [text-shadow:0_1px_3px_rgba(0,0,0,.9)]">{turnId && labels[turnId] ? `${labels[turnId]}'s turn` : ''}</span>}
    </p>
  );

  return (
    <div className="relative isolate flex h-[calc(100dvh-0.75rem-max(1rem,env(safe-area-inset-bottom)))] flex-col gap-2">
      {/* The room around the table: dark green, lit from the middle, darker at the corners. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_48%,#12573a_0%,#0a3322_42%,#04130c_78%,#020907_100%)]" />
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="display text-xl font-bold tracking-widest">{state.code}</span>
          <span className="rounded-full bg-neon px-2.5 py-0.5 text-xs font-extrabold text-ink">₹{state.baseBet}</span>
          <span className="text-xs font-semibold text-mid">R{state.roundNumber}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setRules(true)} aria-label="Hand rules" className="h-9 w-9 rounded-full btn-quiet font-bold text-neon">?</button>
          {isHost && (<>
            <button disabled={state.historyStack.length === 0} onClick={() => send({ t: 'UNDO' })} className="h-9 rounded-full btn-quiet px-4 text-sm font-bold disabled:opacity-40">↶ Undo</button>
            <button onClick={() => setConfirm({ kind: 'end' })} className="h-9 rounded-full bg-danger px-4 text-sm font-bold">End</button>
          </>)}
        </div>
      </header>

      <div className="relative">
        <Scoreboard state={state} meId={meId} onOpen={() => setTotals(true)} />
        <SoundToggle className="absolute right-1 top-0" />
      </div>

      <div className="relative mx-auto min-h-0 w-full flex-1">
        {/* The table: a bevelled dark rail with stitching, a sunken black lip, and cloth felt (lit from the top, grain, dark edges, faint outline and watermark). */}
        <div aria-hidden="true" className="absolute inset-x-[2%] inset-y-[1%] rounded-[999px] bg-[linear-gradient(145deg,#52575a_0%,#202322_30%,#0d0f0e_62%,#383c3d_100%)] p-[19px] shadow-[0_16px_30px_rgba(0,0,0,.75),0_0_0_1px_rgba(255,255,255,.08),inset_0_2px_1px_rgba(255,255,255,.22),inset_0_-4px_8px_rgba(0,0,0,.65)]">
          <div className="pointer-events-none absolute inset-[7px] rounded-[999px] border border-dashed border-white/15" />
          <div className="h-full w-full rounded-[999px] bg-black p-[3px] shadow-[0_1px_0_rgba(255,255,255,.14),inset_0_3px_7px_rgba(0,0,0,.95)]">
            <div className="relative h-full w-full overflow-hidden rounded-[999px] bg-[radial-gradient(ellipse_at_50%_36%,#31c46c_0%,#1c9a50_38%,#0d6e36_72%,#07481f_100%)] shadow-[inset_0_7px_20px_rgba(0,0,0,.75),inset_0_-5px_16px_rgba(0,0,0,.5)]">
              <div className="felt-grain absolute inset-0" />
              <div className="absolute inset-3.5 rounded-[999px] border border-[#dff7e8]/25 shadow-[0_0_0_1px_rgba(0,0,0,.28),inset_0_0_0_1px_rgba(0,0,0,.18)]" />
              <span className="display absolute left-1/2 top-[70%] -translate-x-1/2 text-xl tracking-[.4em] text-white/[.08]">POTKEEPER</span>
            </div>
          </div>
        </div>
        {seatPositions(seats.length, 40, 38).map((pos, i) => (
          <div key={seats[i]!.userId} className={`absolute -translate-x-1/2 -translate-y-1/2 ${seats.length > 8 ? 'scale-[.8]' : seats.length > 6 ? 'scale-90' : ''}`} style={{ left: `${pos.left}%`, top: `${pos.top}%` }}>
            {seat(seats[i]!)}
          </div>
        ))}
        <div className="absolute left-1/2 top-[46%] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5">{state.phase === 'BETTING' && <>{pot}{betInfo}</>}</div>
      </div>

      {winPopup && state.phase === 'BETWEEN_ROUNDS' && result && <WinCard state={state} winners={result} onClose={() => setWinPopup(false)} />}
      {state.phase === 'BETWEEN_ROUNDS' ? (
        isHost ? (
          <div className="flex gap-2">
            <button onClick={() => setSeating(true)} className="display h-16 rounded-3xl btn-quiet px-5 text-xl font-bold">Seats</button>
            <button onClick={() => send({ t: 'START_ROUND' })} className="display h-16 flex-1 rounded-3xl bg-neon text-2xl font-bold text-ink shadow-[0_4px_0_#8fb300] active:translate-y-[2px] active:shadow-none">
              Next Round
            </button>
          </div>
        ) : (
          <p className="py-4 text-center text-mid">Round over · waiting for the host…</p>
        )
      ) : (
        <>
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
      {seating && isHost && state.phase === 'BETWEEN_ROUNDS' && <SeatingSheet state={state} meId={meId} send={send} onClose={() => setSeating(false)} />}
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
