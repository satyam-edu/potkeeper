import { useState } from 'react';
import { changeName, niceDate, type Session } from '../lib/session';

const NAME_MAX = 24;

/** Rename sheet for Google accounts. One change per week; while locked it just says when the next one opens. */
export function NameSheet({ session, lockedUntil, onDone, onClose }: { session: Session; lockedUntil: string | null; onDone: (s: Session, nextChange: string | null) => void; onClose: () => void }) {
  const [name, setName] = useState(session.name);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const locked = !!lockedUntil;
  const clean = name.trim();
  const save = async () => {
    setBusy(true);
    try {
      const r = await changeName(session, clean);
      onDone(r.session, r.nextNameChange);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong');
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/80" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-label="Change name"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); if (!locked && clean && clean !== session.name) void save(); }}
        className="flex w-full max-w-[420px] flex-col gap-4 rounded-t-[28px] bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-line" />
        <div className="flex items-center gap-4">
          <span aria-hidden="true" className="display flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-neon text-4xl font-bold uppercase text-ink">
            {(clean || session.name).charAt(0)}
          </span>
          <div className="min-w-0">
            <h2 className="display text-3xl font-bold leading-tight">Your name</h2>
            <p className="text-sm text-mid">This is what other players see at the table.</p>
          </div>
        </div>

        <label className={`flex items-center gap-2 rounded-2xl bg-surface-2 px-4 ring-neon focus-within:ring-2 ${locked ? 'opacity-60' : ''}`}>
          <input
            value={name}
            onChange={(e) => { setName(e.target.value); setErr(''); }}
            maxLength={NAME_MAX}
            disabled={locked}
            aria-label="Your name"
            autoFocus={!locked}
            className="h-16 min-w-0 flex-1 bg-transparent text-2xl font-semibold outline-none"
          />
          <span className="text-xs font-semibold tabular-nums text-mid">{name.length}/{NAME_MAX}</span>
        </label>

        <p role={err ? 'alert' : undefined} className={`rounded-xl px-3 py-2 text-sm font-semibold ${err ? 'bg-danger/15 text-danger' : locked ? 'bg-surface-2 text-paper' : 'bg-neon/10 text-neon'}`}>
          {err || (locked ? `You can change your name again on ${niceDate(lockedUntil)}.` : 'You can change your name once a week, so pick one you like.')}
        </p>

        <div className="flex flex-col gap-2">
          {!locked && (
            <button disabled={!clean || clean === session.name || busy} className="display h-14 rounded-2xl bg-neon text-xl font-bold text-ink shadow-[0_4px_0_#8fb300] active:translate-y-[2px] active:shadow-none disabled:opacity-40 disabled:shadow-none">
              {busy ? 'Saving…' : 'Save name'}
            </button>
          )}
          <button type="button" onClick={onClose} className="h-12 rounded-2xl btn-quiet font-semibold active:scale-[.98]">{locked ? 'Close' : 'Cancel'}</button>
        </div>
      </form>
    </div>
  );
}
