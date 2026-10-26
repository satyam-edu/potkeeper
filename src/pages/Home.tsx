import { useState } from 'react';
import { useLocation } from 'wouter';
import { NamePrompt } from '../components/NamePrompt';
import { loadSession, saveSession, type Session } from '../lib/session';

const newCode = () => String(1000 + Math.floor(Math.random() * 9000));

export function Home() {
  const [, go] = useLocation();
  const [session, setSession] = useState<Session | null>(loadSession);
  const [code, setCode] = useState('');

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="pt-6 text-center">
        <h1 className="display text-6xl font-bold leading-none text-white">Pot<span className="text-neon">Keeper</span></h1>
        <p className="mt-1 text-mid">Chip-free 3 Patti. Just your phone.</p>
      </header>

      {!session ? (
        <NamePrompt onDone={setSession} label="Continue" />
      ) : (
        <>
          <p className="text-center text-lg">
            Hi, <b>{session.name}</b>{' '}
            <button className="text-sm text-mid underline" onClick={() => { saveSession(null); setSession(null); }}>
              not you?
            </button>
          </p>
          <button
            onClick={() => go(`/room/${newCode()}?create=5`)}
            className="h-16 rounded-2xl bg-neon display text-2xl font-bold text-ink shadow-[0_4px_0_#8fb300] active:translate-y-[2px] active:shadow-none"
          >
            Create Room
          </button>
          <form
            className="flex gap-2"
            onSubmit={(e) => { e.preventDefault(); if (code.length === 4) go(`/room/${code}`); }}
          >
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              inputMode="numeric"
              placeholder="4-digit code"
              className="h-14 min-w-0 flex-1 rounded-xl bg-surface px-4 text-lg tabular-nums outline-none ring-neon focus:ring-2"
            />
            <button disabled={code.length !== 4} className="h-14 rounded-xl bg-surface-2 px-6 font-extrabold disabled:opacity-40">
              Join
            </button>
          </form>
        </>
      )}
    </div>
  );
}
