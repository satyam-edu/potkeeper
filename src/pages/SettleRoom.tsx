import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { ConfirmModal } from '../components/ConfirmModal';
import { rupees, signed } from '../lib/format';
import { cancelSettle, clickReady, fetchSettle, loadSession, startSettle, type SettleView } from '../lib/session';

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
const when = (iso: string) => `${day(iso)}, ${time(iso)}`;
const tone = (n: number) => (n === 0 ? 'text-mid' : n < 0 ? 'text-danger' : 'text-neon');
const POLL_MS = 4000;

/** One game's settle room: the host opens it, everyone confirms their own part, the last click settles it. A settled room stays as the receipt. */
export function SettleRoom({ gameId }: { gameId: string }) {
  const [, go] = useLocation();
  const [session] = useState(loadSession);
  const [view, setView] = useState<SettleView | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'start' | 'cancel' | 'ready' | null>(null);
  const [fresh, setFresh] = useState(false); // it settled while this screen was open
  const last = useRef<string | undefined>(undefined);

  const apply = (v: SettleView) => {
    if (last.current === 'OPEN' && v.room?.status === 'SETTLED') setFresh(true);
    last.current = v.room?.status;
    setErr('');
    setView(v);
  };
  const run = (call: () => Promise<SettleView>) => {
    setBusy(true);
    call().then(apply).catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Something went wrong')).finally(() => { setBusy(false); setConfirm(null); });
  };

  useEffect(() => {
    if (!session) return go('/');
    const load = () => fetchSettle(session, gameId).then(apply).catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Something went wrong'));
    void load();
    // While a room is open, look again every few seconds so everyone sees the others click.
    const t = setInterval(() => { if (last.current === 'OPEN' && document.visibilityState === 'visible') void load(); }, POLL_MS);
    return () => clearInterval(t);
  }, [gameId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!session) return null;
  const room = view?.room ?? null;
  const open = room?.status === 'OPEN';
  const settled = view?.game.status === 'SETTLED';
  const me = room?.players.find((p) => p.isMe);
  const ready = room?.players.filter((p) => p.readyAt).length ?? 0;
  const total = room?.players.length ?? 0;

  return (
    <div className="flex flex-1 flex-col gap-4 pb-2">
      <div className="flex items-center gap-3">
        <button onClick={() => go('/')} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
        </button>
        <div className="min-w-0">
          <h1 className="display text-3xl font-bold leading-tight">{settled ? 'Settled' : 'Settle up'}</h1>
          {view && <p className="text-sm text-mid">{day(view.game.endedAt)} · {view.game.rounds} round{view.game.rounds === 1 ? '' : 's'} · ₹{view.game.baseBet} base</p>}
        </div>
      </div>

      {err && <p role="alert" className="rounded-xl bg-danger/15 px-3 py-2 text-sm font-semibold text-danger">{err}</p>}
      {!view && !err && <p className="text-mid">Loading…</p>}

      {fresh && <p role="status" className="rounded-xl bg-neon px-3 py-3 text-center font-bold text-ink">Everyone confirmed. Game settled, wallets updated.</p>}

      {view && !room && !settled && (
        <section className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
          <p className="font-bold">No settle room is open</p>
          <p className="text-sm text-mid">{view.canStart ? 'Open one when you are ready to settle. Everyone from this game will be asked to confirm.' : 'The host of this game opens the settle room. Come back when they have.'}</p>
        </section>
      )}

      {room && room.status !== 'OPEN' && room.status !== 'SETTLED' && !settled && (
        <p className="rounded-xl bg-surface px-3 py-3 text-sm text-mid">The last settle room was {room.status === 'CANCELLED' ? 'cancelled' : 'closed after 48 hours'} on {when(room.closedAt ?? room.startedAt)}. Nothing was changed.</p>
      )}

      {room && (open || room.status === 'SETTLED') && (
        <>
          {open ? (
            <section className="rounded-2xl bg-surface p-4">
              <div className="flex items-baseline justify-between">
                <p className="font-bold">{ready} of {total} confirmed</p>
                <p className="text-xs text-mid">Open until {when(room.expiresAt)}</p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={ready} aria-valuemax={total}>
                <div className="h-full rounded-full bg-neon transition-all" style={{ width: `${total ? (ready / total) * 100 : 0}%` }} />
              </div>
            </section>
          ) : (
            <section className="rounded-2xl bg-neon p-4 text-ink">
              <p className="display text-3xl font-bold">✓ Settled</p>
              <p className="text-sm font-semibold">{room.settledAt ? when(room.settledAt) : ''}</p>
            </section>
          )}

          <section className="flex flex-col gap-2">
            <h2 className="text-xs font-bold tracking-widest text-mid">WHO PAYS WHOM</h2>
            <ul className="flex flex-col gap-1.5">
              {room.payments.map((p, i) => (
                <li key={i} className={`flex items-center justify-between rounded-xl px-4 py-3 ${p.fromMe || p.toMe ? 'bg-surface-2' : 'bg-surface'}`}>
                  <span className={p.fromMe || p.toMe ? 'font-bold' : 'text-mid'}>{p.fromMe ? 'You pay' : `${p.from} pays`} {p.toMe ? 'you' : p.to}</span>
                  <span className="amount text-lg tabular-nums">{rupees(p.amount)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-xs font-bold tracking-widest text-mid">{open ? 'PLAYERS' : 'WALLET CHANGE'}</h2>
            <ul className="flex flex-col gap-1.5">
              {room.players.map((p, i) => (
                <li key={i} className="flex items-center justify-between rounded-xl bg-surface px-4 py-3">
                  <span className="min-w-0">
                    <span className={`block [overflow-wrap:anywhere] ${p.isMe ? 'font-bold' : ''}`}>{p.name}{p.isMe && ' (you)'}</span>
                    <span className={`block text-xs ${p.readyAt ? 'text-neon' : 'text-mid'}`}>
                      {p.readyAt ? `${p.net > 0 ? 'Received' : 'Paid'} at ${time(p.readyAt)}` : 'Waiting'}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className={`amount block text-lg tabular-nums ${tone(open ? p.net : (p.walletDelta ?? 0))}`}>{signed(open ? p.net : (p.walletDelta ?? 0))}</span>
                    <span className="block text-[10px] font-bold tracking-widest text-mid">{open ? 'THIS GAME' : 'WALLET'}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-xs font-bold tracking-widest text-mid">TIMELINE</h2>
            <ol className="flex flex-col gap-1 text-sm">
              <li className="flex justify-between gap-3"><span>{room.startedBy} opened the settle room</span><span className="shrink-0 text-mid">{when(room.startedAt)}</span></li>
              {[...room.players].filter((p) => p.readyAt).sort((a, b) => Date.parse(a.readyAt!) - Date.parse(b.readyAt!)).map((p, i) => (
                <li key={i} className="flex justify-between gap-3"><span>{p.isMe ? 'You' : p.name} {p.net > 0 ? 'received' : 'paid'} {rupees(Math.abs(p.net))}</span><span className="shrink-0 text-mid">{when(p.readyAt!)}</span></li>
              ))}
              {room.settledAt && <li className="flex justify-between gap-3 font-bold text-neon"><span>Game settled</span><span className="shrink-0">{when(room.settledAt)}</span></li>}
            </ol>
          </section>
        </>
      )}

      <div className="mt-auto flex flex-col gap-2 pt-2">
        {open && me && (
          me.readyAt ? (
            <button disabled={busy} onClick={() => run(() => clickReady(session, gameId, false))} className="h-14 rounded-2xl bg-surface-2 font-semibold disabled:opacity-40">
              ✓ You confirmed. Tap to take it back
            </button>
          ) : (
            <button disabled={busy} onClick={() => setConfirm('ready')} className="display h-16 rounded-3xl bg-neon text-2xl font-bold text-ink shadow-[0_4px_0_#8fb300] active:translate-y-[2px] active:shadow-none disabled:opacity-40">
              {me.net > 0 ? `I received ${rupees(me.net)}` : `I paid ${rupees(-me.net)}`}
            </button>
          )
        )}
        {open && room && !room.mine.needed && <p className="text-center text-sm text-mid">You are at ₹0 in this game, so there is nothing for you to confirm.</p>}
        {view?.canStart && !open && !settled && (
          <button disabled={busy} onClick={() => setConfirm('start')} className="display h-16 rounded-3xl bg-neon text-2xl font-bold text-ink shadow-[0_4px_0_#8fb300] active:translate-y-[2px] active:shadow-none disabled:opacity-40">
            Open settle room
          </button>
        )}
        {open && view?.canStart && (
          <button disabled={busy} onClick={() => setConfirm('cancel')} className="h-12 rounded-2xl bg-surface-2 text-sm font-semibold text-mid disabled:opacity-40">Cancel the settle room</button>
        )}
      </div>

      {confirm === 'start' && (
        <ConfirmModal
          title="Open the settle room?"
          body="Everyone in this game will be asked to confirm. Each person only confirms their own part, and the game settles when all of them have. The room stays open for 48 hours."
          confirmLabel="Open settle room"
          onConfirm={() => run(() => startSettle(session, gameId))}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'cancel' && (
        <ConfirmModal
          tone="danger"
          title="Cancel the settle room?"
          body="Everyone's confirmations are cleared. You can open a new room later."
          confirmLabel="Cancel room"
          onConfirm={() => run(() => cancelSettle(session, gameId))}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'ready' && me && (
        <ConfirmModal
          title="Are you sure?"
          body={me.net > 0
            ? `Only confirm if you have already received ${rupees(me.net)}. When everyone has confirmed, the game settles and your wallet drops by ${rupees(me.net)}.`
            : `Only confirm once you have paid ${rupees(-me.net)}. When everyone has confirmed, the game settles and your wallet goes up by ${rupees(-me.net)}.`}
          confirmLabel={me.net > 0 ? 'Yes, I received it' : 'Yes, I paid'}
          onConfirm={() => run(() => clickReady(session, gameId, true))}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
