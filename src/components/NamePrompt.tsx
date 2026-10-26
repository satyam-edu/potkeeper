import { useState } from 'react';
import { devLogin, type Session } from '../lib/session';

/** Temporary name-only entry. Replaced by the real Landing page (guest / Google) in Phase 3. */
export function NamePrompt({ onDone, label = 'Continue' }: { onDone: (s: Session) => void; label?: string }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const go = async () => {
    setBusy(true);
    try {
      onDone(await devLogin(name.trim()));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong');
      setBusy(false);
    }
  };
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (name.trim()) void go(); }}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={24}
        placeholder="Your name"
        autoFocus
        className="h-14 rounded-xl bg-surface px-4 text-lg outline-none ring-neon focus:ring-2"
      />
      {err && <p className="text-sm text-red-400">{err}</p>}
      <button disabled={!name.trim() || busy} className="h-14 rounded-xl bg-neon text-lg font-extrabold text-ink disabled:bg-surface-2 disabled:text-mid">
        {label}
      </button>
    </form>
  );
}
