import { loadSession, saveSession, type Session } from './session';

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

interface Gis {
  accounts: {
    id: {
      initialize(c: { client_id: string; callback: (r: { credential: string }) => void }): void;
      renderButton(el: HTMLElement, o: Record<string, unknown>): void;
    };
  };
}
const gis = () => (window as unknown as { google?: Gis }).google;

let loading: Promise<void> | null = null;
/** Google Identity Services script, loaded once and only when a Google button is shown. */
export function loadGis(): Promise<void> {
  loading ??= new Promise((resolve, reject) => {
    if (gis()) return resolve();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load Google sign-in'));
    document.head.appendChild(s);
  });
  return loading;
}

export async function renderGoogleButton(el: HTMLElement, onSession: (s: Session) => void, onError: (m: string) => void) {
  if (!GOOGLE_CLIENT_ID) return;
  await loadGis();
  gis()!.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: async ({ credential }) => {
      try {
        onSession(await googleLogin(credential));
      } catch (e) {
        onError(e instanceof Error ? e.message : "Couldn't sign you in with Google");
      }
    },
  });
  gis()!.accounts.id.renderButton(el, { theme: 'filled_black', shape: 'pill', size: 'large', text: 'continue_with', width: 320 });
}

/** Exchange the Google ID token for our session. A guest's token is sent along so the server can merge it. */
async function googleLogin(idToken: string): Promise<Session> {
  const old = loadSession();
  const res = await fetch('/api/auth/google', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken, guestToken: old?.isGuest !== false ? old?.token : undefined }),
  });
  if (!res.ok) throw new Error("Couldn't sign you in with Google");
  const { token, user } = (await res.json()) as { token: string; user: { id: string; name: string } };
  const s = { userId: user.id, name: user.name, token, isGuest: false };
  saveSession(s);
  return s;
}
