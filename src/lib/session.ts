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
export async function checkSession(s: Session): Promise<{ name: string; isGuest: boolean; walletBalance: number; email?: string; nextNameChange: string | null } | false | null> {
  try {
    const res = await fetch('/api/me', { headers: { authorization: `Bearer ${s.token}` } });
    if (res.status === 401) return false;
    return res.ok ? ((await res.json()) as { name: string; isGuest: boolean; walletBalance: number; email?: string; nextNameChange: string | null }) : null;
  } catch {
    return null;
  }
}

/** Rename a Google account (one change per week). Returns the new session and when the next change opens. Throws a message fit for the screen. */
export async function changeName(s: Session, name: string): Promise<{ session: Session; nextNameChange: string | null }> {
  let res: Response;
  try {
    res = await fetch('/api/me', { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: `Bearer ${s.token}` }, body: JSON.stringify({ name }) });
  } catch {
    throw new Error("Couldn't reach the server, try again");
  }
  const body = (await res.json().catch(() => ({}))) as { token?: string; name?: string; nextNameChange?: string | null; error?: string };
  if (res.status === 429) throw new Error(`You can change your name again on ${niceDate(body.nextNameChange)}`);
  if (res.status === 400) throw new Error('Please enter a name');
  if (res.status === 403) throw new Error('Log in with Google to change your name');
  if (!res.ok || !body.token || !body.name) throw new Error("Couldn't change your name, try again");
  const next = { ...s, token: body.token, name: body.name };
  saveSession(next);
  return { session: next, nextNameChange: body.nextNameChange ?? null };
}

export const niceDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '');

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
