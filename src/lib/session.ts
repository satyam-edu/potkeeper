import { signJwt } from '../../shared/jwt';

export interface Session {
  userId: string;
  name: string;
  token: string;
}

const KEY = 'pk_session';

export function loadSession(): Session | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null') as Session | null;
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

/**
 * DEV-ONLY login: signs a token in the browser so the room server accepts us.
 * Replaced by POST /api/auth/guest in P3-02 — never ships to production.
 */
export async function devLogin(name: string): Promise<Session> {
  if (!import.meta.env.DEV) throw new Error('Login is not available yet');
  const old = loadSession();
  const userId = old?.userId ?? crypto.randomUUID();
  const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
  const token = await signJwt({ sub: userId, name, exp }, import.meta.env.VITE_DEV_JWT_SECRET ?? 'dev');
  const s = { userId, name, token };
  saveSession(s);
  return s;
}
