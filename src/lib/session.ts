export interface Session {
  userId: string;
  name: string;
  token: string;
  isGuest: boolean;
}

const KEY = 'pk_session';

export function loadSession(): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as (Omit<Session, 'isGuest'> & { isGuest?: boolean }) | null;
    return s && { ...s, isGuest: s.isGuest !== false }; // sessions saved before Google login existed are guests
  } catch {
    return null;
  }
}

export function saveSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode: session just won't persist */
  }
}

/** Create an anonymous guest account (isGuest: true) and remember it on this device. */
export async function guestLogin(name: string): Promise<Session> {
  const res = await fetch('/api/auth/guest', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(res.status === 400 ? 'Please enter a name' : "Couldn't sign you in, try again");
  const { token, user } = (await res.json()) as { token: string; user: { id: string; name: string } };
  const s = { userId: user.id, name: user.name, token, isGuest: true };
  saveSession(s);
  return s;
}

/** Ask the server who we are. `false` = the account is gone/merged/invalid (sign out); `null` = couldn't reach it (keep going). */
export async function checkSession(s: Session): Promise<{ name: string; isGuest: boolean; walletBalance: number } | false | null> {
  try {
    const res = await fetch('/api/me', { headers: { authorization: `Bearer ${s.token}` } });
    if (res.status === 401) return false;
    return res.ok ? ((await res.json()) as { name: string; isGuest: boolean; walletBalance: number }) : null;
  } catch {
    return null;
  }
}

export interface HistoryGame {
  id: string;
  endedAt: string;
  rounds: number;
  baseBet: number;
  net: number;
  players: { name: string; net: number; isMe: boolean }[];
}

/** One page of finished games, newest first. Throws if the server can't be reached. */
export async function fetchHistory(s: Session, before?: string): Promise<{ games: HistoryGame[]; next: string | null }> {
  const res = await fetch(`/api/me/history${before ? `?before=${encodeURIComponent(before)}` : ''}`, { headers: { authorization: `Bearer ${s.token}` } });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as { games: HistoryGame[]; next: string | null };
}
