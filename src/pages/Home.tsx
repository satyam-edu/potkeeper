import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { ConfirmModal } from '../components/ConfirmModal';
import { GuestSheet } from '../components/GuestSheet';
import { History } from '../components/History';
import { WalletCard } from '../components/WalletCard';
import { checkSession, loadSession, saveSession, type Session } from '../lib/session';
import { Landing } from './Landing';

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

const newCode = () => String(1000 + Math.floor(Math.random() * 9000));

export function Home() {
  const [, go] = useLocation();
  const [session, setSession] = useState<Session | null>(loadSession);
  const [code, setCode] = useState('');
  const [logout, setLogout] = useState(false);
  const [tab, setTab] = useState<'play' | 'history'>('play');
  const [wallet, setWallet] = useState<number | null>(null);
  const [email, setEmail] = useState<string | null>(null); // Google account, shown on the log out warning
  const dismissed = () => { try { return sessionStorage.getItem('pk_google_later') === '1'; } catch { return false; } };
  const [sheet, setSheet] = useState(() => !dismissed()); // shown once per browser session unless Google is connected
  const later = () => {
    try { sessionStorage.setItem('pk_google_later', '1'); } catch { /* ignore */ }
    setSheet(false);
  };

  // Drop a saved login the server no longer knows (account merged or database reset).
  useEffect(() => {
    if (!session) return;
    void checkSession(session).then((me) => {
      if (me) { setWallet(me.walletBalance); setEmail(me.email ?? null); }
      if (me === false) { saveSession(null); setSession(null); }
      else if (me && (me.isGuest !== session.isGuest || me.name !== session.name)) {
        const next = { ...session, isGuest: me.isGuest, name: me.name };
        saveSession(next);
        setSession(next);
      }
    });
  }, [session?.token]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!session) return <Landing onDone={setSession} />;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <img src="/logo.png" alt="PotKeeper" className="h-12 w-12 rounded-xl" />
        <button className="h-11 rounded-full bg-surface-2 px-4 text-sm font-semibold text-mid" onClick={() => setLogout(true)}>
          Log out
        </button>
      </div>
      <div>
        <p className="text-3xl font-light text-mid">Hi, {session.name}</p>
        <h1 className="display title-fade text-[clamp(3.25rem,19vw,4.75rem)] font-bold leading-[0.95]">PotKeeper</h1>
      </div>
      <WalletCard balance={wallet} isGuest={session.isGuest} onSync={() => setSheet(true)} />
      <div role="tablist" className="flex gap-2">
        {(['play', 'history'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`h-11 rounded-full px-6 text-sm font-bold capitalize ${tab === t ? 'bg-neon text-ink' : 'bg-surface-2 text-mid'}`}
          >
            {t}
          </button>
        ))}
      </div>
      <div hidden={tab !== 'play'} className="flex flex-col gap-3">
        <button
          onClick={() => go(`/room/${newCode()}?create=5`)}
          className="display flex h-16 items-center justify-between rounded-full bg-neon pl-7 pr-2 text-2xl font-bold text-ink active:scale-[.98]"
        >
          Create Room
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-neon"><Arrow /></span>
        </button>
        <form className="flex h-14 items-center rounded-full bg-surface pl-5 pr-1.5 focus-within:ring-2 focus-within:ring-neon" onSubmit={(e) => { e.preventDefault(); if (code.length === 4) go(`/room/${code}`); }}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            inputMode="numeric"
            placeholder="Room code"
            aria-label="Room code"
            className="h-full min-w-0 flex-1 bg-transparent text-lg tabular-nums outline-none"
          />
          <button disabled={code.length !== 4} aria-label="Join room" className="flex h-11 w-11 items-center justify-center rounded-full bg-paper text-ink disabled:bg-surface-2 disabled:text-mid">
            <Arrow />
          </button>
        </form>
      </div>
      <div hidden={tab !== 'history'}>
        <History session={session} />
      </div>
      {logout && (
        <ConfirmModal
          tone="danger"
          title="Log out?"
          body={session.isGuest
            ? "You are playing as a guest. If you log out, this guest wallet and its history can't be opened again. Sync Google first if you want to keep them."
            : `${email ? `You are logged in with Google as ${email}. ` : ''}You will be logged out on this device. Log in with Google again to get your wallet and history back.`}
          confirmLabel="Log out"
          onConfirm={() => { setLogout(false); saveSession(null); setSession(null); }}
          onCancel={() => setLogout(false)}
        />
      )}
      {session.isGuest && sheet && <GuestSheet onDone={(s) => { setSession(s); setSheet(false); }} onLater={later} />}
    </div>
  );
}
