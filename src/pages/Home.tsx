import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { ConfirmModal } from '../components/ConfirmModal';
import { AboutSheet } from '../components/AboutSheet';
import { FeedbackSheet } from '../components/FeedbackSheet';
import { GuestSheet } from '../components/GuestSheet';
import { History } from '../components/History';
import { MenuButton } from '../components/MenuButton';
import { NameSheet } from '../components/NameSheet';
import { WalletCard } from '../components/WalletCard';
import { checkSession, fetchOpenRooms, loadSession, saveSession, type OpenRoom, type Session } from '../lib/session';
import { Landing } from './Landing';

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

// Last balance seen, kept only while the page stays open (not saved anywhere). Coming back to Home from a room shows it at once and
// refreshes it; a refresh or hard load starts empty, so the cards animation plays once while the real number is fetched.
let lastWallet: { userId: string; balance: number } | null = null;
const CARDS_MIN_MS = 2200; // one whole round of the card flip (1.8s + the last card's 0.36s delay, see card-flip in index.css), so all three cards finish before the number appears

const newCode = () => String(1000 + Math.floor(Math.random() * 9000));

export function Home() {
  const [, go] = useLocation();
  const [session, setSession] = useState<Session | null>(loadSession);
  const [code, setCode] = useState('');
  const [logout, setLogout] = useState(false);
  const [tab, setTab] = useState<'play' | 'history' | 'settled'>('play');
  const [rooms, setRooms] = useState<OpenRoom[]>([]); // settle rooms waiting on me
  const [wallet, setWallet] = useState<number | null>(() => (lastWallet && lastWallet.userId === session?.userId ? lastWallet.balance : null));
  const [cardsDone, setCardsDone] = useState(wallet !== null); // false only on a fresh load, until the minimum time has passed
  useEffect(() => {
    if (cardsDone) return;
    const t = setTimeout(() => setCardsDone(true), CARDS_MIN_MS);
    return () => clearTimeout(t);
  }, [cardsDone]);
  const [renaming, setRenaming] = useState(false);
  const [about, setAbout] = useState(false);
  const [feedback, setFeedback] = useState(false);
  const [nameLockedUntil, setNameLockedUntil] = useState<string | null>(null); // when a Google user may rename again
  const [avatar, setAvatar] = useState<string | null>(null); // Google profile photo, if the account has one
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
      if (me) { setWallet(me.walletBalance); lastWallet = { userId: session.userId, balance: me.walletBalance }; setEmail(me.email ?? null); setAvatar(me.avatarUrl ?? null); setNameLockedUntil(me.nextNameChange); }
      if (me === false) { lastWallet = null; saveSession(null); setSession(null); }
      else if (me && (me.isGuest !== session.isGuest || me.name !== session.name || (me.avatarUrl ?? undefined) !== session.avatarUrl)) {
        const next = { ...session, isGuest: me.isGuest, name: me.name, avatarUrl: me.avatarUrl ?? undefined };
        saveSession(next);
        setSession(next);
      }
    });
    void fetchOpenRooms(session).then(setRooms).catch(() => setRooms([])); // just no banner if it fails
  }, [session?.token]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!session) return <Landing onDone={setSession} />;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <img src="/logo.png" alt="PotKeeper" className="h-12 w-12 rounded-xl" />
        <MenuButton
          onFeedback={() => (session.isGuest ? setSheet(true) : setFeedback(true))} // a guest is nudged to connect Google instead
          onAbout={() => setAbout(true)}
          onLogout={() => setLogout(true)}
        />
      </div>
      <div>
        <p className="flex items-center gap-2 text-3xl font-light text-mid">
          {avatar && <img src={avatar} alt="" referrerPolicy="no-referrer" onError={() => setAvatar(null)} className="h-11 w-11 shrink-0 rounded-full border-2 border-neon object-cover" />}
          <span className="min-w-0 [overflow-wrap:anywhere]">Hi, {session.name}</span>
          {!session.isGuest && (
            <button onClick={() => setRenaming(true)} aria-label="Change name" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full btn-quiet text-neon active:scale-95">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </button>
          )}
        </p>
        <h1 className="display title-fade text-[clamp(3.25rem,19vw,4.75rem)] font-bold leading-[0.95]">PotKeeper</h1>
      </div>
      <WalletCard balance={cardsDone ? wallet : null} isGuest={session.isGuest} onSync={() => setSheet(true)} />
      <div role="tablist" className="flex gap-2">
        {(['play', 'history', 'settled'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`h-11 rounded-full px-6 text-sm font-bold capitalize ${tab === t ? 'bg-neon text-ink' : 'btn-quiet'}`}
          >
            {t}
          </button>
        ))}
      </div>
      <div hidden={tab !== 'play'} className="flex flex-col gap-3">
        {rooms.map((r) => (
          <button key={r.gameId} onClick={() => go(`/settle/${r.gameId}`)} className="flex items-center justify-between rounded-2xl border-2 border-neon bg-surface px-4 py-3 text-left active:scale-[.98]">
            <span className="flex flex-col">
              <span className="font-bold">{r.mineReady ? 'Waiting for the others' : 'Settle room is open'}</span>
              <span className="text-sm text-mid">{new Date(r.endedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} game · {r.ready} of {r.total} confirmed</span>
            </span>
            <span className="rounded-full bg-neon px-3 py-1.5 text-sm font-bold text-ink">Open</span>
          </button>
        ))}
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
          <button disabled={code.length !== 4} aria-label="Join room" className="flex h-11 w-11 items-center justify-center rounded-full bg-paper text-ink disabled:opacity-40">
            <Arrow />
          </button>
        </form>
      </div>
      <div hidden={tab !== 'history'}>
        <History session={session} />
      </div>
      {tab === 'settled' && <History session={session} settledOnly />}
      {logout && (
        <ConfirmModal
          tone="danger"
          title="Log out?"
          body={session.isGuest
            ? "You are playing as a guest. If you log out, this guest wallet and its history can't be opened again. Sync Google first if you want to keep them."
            : `${email ? `You are logged in with Google as ${email}. ` : ''}You will be logged out on this device. Log in with Google again to get your wallet and history back.`}
          confirmLabel="Log out"
          onConfirm={() => { setLogout(false); lastWallet = null; saveSession(null); setSession(null); }}
          onCancel={() => setLogout(false)}
        />
      )}
      {about && <AboutSheet onClose={() => setAbout(false)} />}
      {feedback && !session.isGuest && <FeedbackSheet session={session} onClose={() => setFeedback(false)} />}
      {renaming && (
        <NameSheet
          session={session}
          lockedUntil={nameLockedUntil}
          onDone={(s, next) => { setSession(s); setNameLockedUntil(next); setRenaming(false); }}
          onClose={() => setRenaming(false)}
        />
      )}
      {session.isGuest && sheet && <GuestSheet balance={wallet} onDone={(s) => { setSession(s); setSheet(false); }} onLater={later} />}
    </div>
  );
}
