import { useEffect, useState } from 'react';
import type { ClientMessage, Player, RoomState } from '../../shared/types';
import { MAX_PLAYERS, MIN_PLAYERS } from '../../shared/engine';
import { ConfirmModal } from './ConfirmModal';

const PRESETS = [1, 5, 10, 20];

export function Lobby({ state, meId, send }: { state: RoomState; meId: string; send: (m: ClientMessage) => void }) {
  const isHost = state.hostId === meId;
  const live = state.players.filter((p) => !p.cashedOut);
  const link = `${location.origin}/room/${state.code}`;
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Player | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the link is visible to copy by hand */
    }
  };
  const toggleQr = async () => {
    if (qr) return setQr(null);
    const { default: QRCode } = await import('qrcode'); // loaded only when asked for
    setQr(await QRCode.toString(link, { type: 'svg', margin: 1, color: { dark: '#050b09', light: '#ecfdf5' } }));
  };
  useEffect(() => setQr(null), [state.code]);

  const move = (i: number, dir: -1 | 1) => {
    const order = live.map((p) => p.userId);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j]!, order[i]!];
    // cashed-out players keep their tail slots (Reorder needs the full roster)
    send({ t: 'REORDER', order: [...order, ...state.players.filter((p) => p.cashedOut).map((p) => p.userId)] });
  };

  return (
    <div className="flex flex-1 flex-col gap-5">
      <section className="rounded-2xl bg-surface p-4">
        <p className="text-xs text-mid">ROOM CODE</p>
        <p className="display text-6xl font-bold tracking-widest text-neon tabular-nums">{state.code}</p>
        <p className="mt-1 truncate text-sm text-mid">{link}</p>
        <div className="mt-3 flex gap-2">
          <button onClick={copy} className="h-12 flex-1 rounded-xl bg-surface-2 font-bold active:scale-[.98]">
            {copied ? 'Copied ✓' : 'Copy link'}
          </button>
          <button onClick={toggleQr} className="h-12 flex-1 rounded-xl bg-surface-2 font-bold active:scale-[.98]">
            {qr ? 'Hide QR' : 'Show QR'}
          </button>
        </div>
        {qr && <div className="mx-auto mt-3 w-44 rounded-lg bg-white p-1" dangerouslySetInnerHTML={{ __html: qr }} />}
      </section>

      <section>
        <p className="mb-2 text-xs text-mid">BASE BET</p>
        <div className="flex gap-2">
          {PRESETS.map((n) => (
            <button
              key={n}
              disabled={!isHost}
              onClick={() => send({ t: 'SET_BASE_BET', baseBet: n })}
              className={`h-12 flex-1 rounded-xl font-extrabold tabular-nums ${
                state.baseBet === n ? 'bg-neon text-ink' : 'bg-surface text-white'
              } ${isHost ? 'active:scale-[.97]' : 'opacity-70'}`}
            >
              ₹{n}
            </button>
          ))}
        </div>
      </section>

      <section className="flex-1">
        <p className="mb-2 text-xs text-mid">
          SEATING (clockwise) · {live.length}/{MAX_PLAYERS}
        </p>
        <ul className="flex flex-col gap-2">
          {live.map((p, i) => (
            <li key={p.userId} className="flex items-center gap-3 rounded-xl bg-surface px-3 py-3">
              <span className="w-5 text-center font-bold text-mid">{i + 1}</span>
              <span className={`h-2.5 w-2.5 rounded-full ${p.connected ? 'bg-neon' : 'bg-line'}`} />
              <span className="flex-1 truncate font-semibold">
                {p.name}
                {p.userId === meId && <span className="ml-2 text-xs text-neon">YOU</span>}
                {p.userId === state.hostId && <span className="ml-2 text-xs text-neon">HOST</span>}
              </span>
              {isHost && (
                <span className="flex gap-1">
                  <button aria-label={`Move ${p.name} up`} disabled={i === 0} onClick={() => move(i, -1)} className="h-10 w-10 rounded-lg bg-surface-2 disabled:opacity-30">▲</button>
                  <button aria-label={`Move ${p.name} down`} disabled={i === live.length - 1} onClick={() => move(i, 1)} className="h-10 w-10 rounded-lg bg-surface-2 disabled:opacity-30">▼</button>
                  {p.userId !== meId && <button aria-label={`Remove ${p.name}`} onClick={() => setRemoving(p)} className="h-10 w-10 rounded-lg bg-danger font-bold">✕</button>}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {isHost ? (
        <button
          disabled={live.length < MIN_PLAYERS}
          onClick={() => send({ t: 'START_ROUND' })}
          className="h-16 rounded-2xl bg-neon display text-2xl font-bold text-ink shadow-[0_4px_0_#8fb300] active:translate-y-[2px] active:shadow-none disabled:bg-surface-2 disabled:text-mid disabled:shadow-none"
        >
          {live.length < MIN_PLAYERS ? 'Waiting for players…' : 'Start Game'}
        </button>
      ) : (
        <p className="py-4 text-center text-mid">Waiting for the host to start…</p>
      )}
      {removing && (
        <ConfirmModal
          tone="danger"
          title={`Remove ${removing.name}?`}
          body="They'll be taken out of this room and can't rejoin it."
          confirmLabel="Remove"
          onConfirm={() => { send({ t: 'REMOVE_PLAYER', userId: removing.userId }); setRemoving(null); }}
          onCancel={() => setRemoving(null)}
        />
      )}
    </div>
  );
}
