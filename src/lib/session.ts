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

/** Create an anonymous guest account (isGuest: true) and remember it on this device. */
export async function guestLogin(name: string): Promise<Session> {
  const res = await fetch('/api/auth/guest', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(res.status === 400 ? 'Please enter a name' : "Couldn't sign you in, try again");
  const { token, user } = (await res.json()) as { token: string; user: { id: string; name: string } };
  const s = { userId: user.id, name: user.name, token };
  saveSession(s);
  return s;
}
