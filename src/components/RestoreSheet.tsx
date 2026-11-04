import { useState } from 'react';
import type { ClientMessage, RoomState } from '../../shared/types';
import { buildRestore } from '../lib/restore';

/** Host only, in a fresh room: rebuild a game whose room was lost, from pasted backup text (totals, the round in play, the round log). */
export function RestoreSheet({ state, send, onClose }: { state: RoomState; send: (m: ClientMessage) => void; onClose: () => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const go = () => {
    const r = buildRestore(text, state.players.filter((p) => !p.cashedOut));
    if ('error' in r) return setError(r.error);
    send(r.msg);
    onClose();
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/80" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Restore a game" onClick={(e) => e.stopPropagation()} className="flex max-h-[85dvh] w-full max-w-[420px] flex-col rounded-t-[28px] bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-line" />
        <h2 className="display mb-1 shrink-0 text-3xl font-bold">Restore <span className="text-neon">game</span></h2>
        <p className="mb-3 shrink-0 text-sm text-mid">Everyone must be in the room first. Paste the backup text, then the game carries on from where it stopped.</p>
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setError(''); }}
          aria-label="Backup text"
          placeholder="Paste the backup here"
          className="min-h-32 flex-1 resize-none rounded-xl border border-white/25 bg-ink p-3 text-sm outline-none focus:border-neon"
        />
        {error && <p role="alert" className="mt-2 shrink-0 text-sm font-semibold text-danger">{error}</p>}
        <button onClick={go} disabled={!text.trim()} className="mt-4 h-14 shrink-0 rounded-2xl bg-neon font-bold text-ink disabled:opacity-40">Restore game</button>
        <button onClick={onClose} className="mt-2 h-12 shrink-0 rounded-2xl btn-quiet font-bold">Cancel</button>
      </div>
    </div>
  );
}
