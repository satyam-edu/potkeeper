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
  status: 'PENDING' | 'SETTLED'; // SETTLED: everyone confirmed the money changed hands (see the settle room)
  settledAt: string | null;
  canStart: boolean; // I may open a settle room for it (the host of that game)
  open: { ready: number; total: number } | null; // a settle room is open right now
}

/** One page of finished games, newest first. Throws if the server can't be reached. */
export async function fetchHistory(s: Session, before?: string, status?: 'SETTLED'): Promise<{ games: HistoryGame[]; next: string | null }> {
  const q = new URLSearchParams({ ...(before && { before }), ...(status && { status }) }).toString();
  const res = await fetch(`/api/me/history${q ? `?${q}` : ''}`, { headers: { authorization: `Bearer ${s.token}` } });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as { games: HistoryGame[]; next: string | null };
}

// ---- Settle room: the host opens it, every player confirms, the last click settles the game and moves the wallets.

export interface SettleView {
  game: { id: string; endedAt: string; rounds: number; baseBet: number; status: 'PENDING' | 'SETTLED'; settledAt?: string };
  canStart: boolean;
  canForce: boolean;
  room: null | {
    status: 'OPEN' | 'SETTLED' | 'CANCELLED' | 'EXPIRED';
    startedBy: string;
    startedAt: string;
    expiresAt: string;
    settledAt?: string;
    closedAt?: string;
    players: { name: string; net: number; readyAt: string | null; isMe: boolean; walletDelta?: number }[];
    payments: { from: string; to: string; amount: number; fromMe: boolean; toMe: boolean }[];
    mine: { needed: boolean; ready: boolean };
  };
}
export interface OpenRoom { gameId: string; endedAt: string; ready: number; total: number; mineReady: boolean }

const SETTLE_ERRORS: Record<string, string> = {
  NOT_HOST: 'Only the host of that game can do this',
  NOT_FOUND: "We couldn't find that game",
  ALREADY_SETTLED: 'This game is already settled',
  NOTHING_TO_SETTLE: 'Nobody owes anything in this game',
  NOT_OPEN: 'The settle room is closed. Ask the host to open it again',
  NOT_ADMIN: 'Only the developer account can do this',
  HAS_CONFIRMATIONS: 'Someone has already confirmed. They must take it back before the room can be cancelled',
  UNAUTHORIZED: 'Please log in again',
  GOOGLE_ONLY: 'Feedback is for Google accounts. Connect Google first',
  TOO_MANY: 'That is 5 messages today. Please try again tomorrow',
  BAD_REQUEST: 'Please write at least a few words',
};

async function apiCall<T>(s: Session, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { method: body ? 'POST' : 'GET', headers: { authorization: `Bearer ${s.token}`, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error("Couldn't reach the server, try again");
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(SETTLE_ERRORS[data.error ?? ''] ?? 'Something went wrong, try again');
  return data;
}

export const fetchSettle = (s: Session, gameId: string) => apiCall<SettleView>(s, `/api/settlements?gameId=${encodeURIComponent(gameId)}`);
export const startSettle = (s: Session, gameId: string) => apiCall<SettleView>(s, '/api/settlements', { gameId });
export const cancelSettle = (s: Session, gameId: string) => apiCall<SettleView>(s, '/api/settlements/cancel', { gameId });
export const clickReady = (s: Session, gameId: string, ready: boolean) => apiCall<SettleView>(s, '/api/settlements/ready', { gameId, ready });
export const forceSettleGame = (s: Session, gameId: string) => apiCall<SettleView>(s, '/api/settlements/ready', { gameId, force: true });
export const fetchOpenRooms = async (s: Session) => (await apiCall<{ open: OpenRoom[] }>(s, '/api/settlements')).open;

export const sendFeedback = (s: Session, message: string) => apiCall<{ ok: true }>(s, '/api/feedback', { message });
