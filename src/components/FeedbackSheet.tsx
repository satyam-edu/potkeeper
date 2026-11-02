import { useState } from 'react';
import { sendFeedback, type Session } from '../lib/session';

const HINT = 'What should we add? Found a bug? Tell us what you tapped and what went wrong. Or just say hi.';
const MAX = 500;

/** Feedback for the developer (Google accounts only; the menu keeps guests out). */
export function FeedbackSheet({ session, onClose }: { session: Session; onClose: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);
  const clean = text.trim();
  const send = async () => {
    setBusy(true);
    try {
      await sendFeedback(session, clean);
      setSent(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong');
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/80" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-label="Send feedback"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); if (clean.length >= 3 && !busy && !sent) void send(); }}
        className="sheet-up flex max-h-[90dvh] w-full max-w-[420px] flex-col gap-3 overflow-y-auto rounded-t-[28px] bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-line" />
        {sent ? (
          <>
            <h2 className="display text-3xl font-bold leading-tight">Thank <span className="text-neon">you</span></h2>
            <p className="text-mid">Your message reached Satyam. Every idea and bug gets read.</p>
            <button type="button" onClick={onClose} className="display h-14 rounded-2xl bg-neon text-xl font-bold text-ink">Done</button>
          </>
        ) : (
          <>
            <h2 className="display text-3xl font-bold leading-tight">Tell <span className="text-neon">Satyam</span></h2>
            <label className="flex flex-col gap-1">
              <textarea
                value={text}
                onChange={(e) => { setText(e.target.value); setErr(''); }}
                maxLength={MAX}
                rows={6}
                placeholder={HINT}
                aria-label="Your message"
                className="resize-none rounded-2xl bg-surface-2 p-4 text-base outline-none ring-neon focus:ring-2"
              />
              <span className="self-end text-xs tabular-nums text-mid">{text.length}/{MAX}</span>
            </label>
            {err && <p role="alert" className="rounded-xl bg-danger/15 px-3 py-2 text-sm font-semibold text-danger">{err}</p>}
            <button disabled={clean.length < 3 || busy} className="display h-14 rounded-2xl bg-neon text-xl font-bold text-ink shadow-[0_4px_0_#8fb300] active:translate-y-[2px] active:shadow-none disabled:opacity-40 disabled:shadow-none">
              {busy ? 'Sending…' : 'Send'}
            </button>
            <button type="button" onClick={onClose} className="h-12 rounded-2xl btn-quiet font-semibold">Cancel</button>
          </>
        )}
      </form>
    </div>
  );
}
