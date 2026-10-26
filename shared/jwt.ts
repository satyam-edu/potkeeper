// HS256 JWT via WebCrypto — runs in Node (Vercel), Cloudflare Workers (PartyKit) and browsers. No DB, no deps.
const enc = new TextEncoder();
const b64 = (b: ArrayBuffer | string) => {
  const bytes = typeof b === 'string' ? enc.encode(b) : new Uint8Array(b);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const key = (secret: string, use: KeyUsage) =>
  crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [use]);

export interface JwtPayload {
  sub: string; // userId
  name: string;
  exp: number; // seconds since epoch
}

export async function signJwt(payload: JwtPayload, secret: string): Promise<string> {
  const body = `${b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64(JSON.stringify(payload))}`;
  const sig = await crypto.subtle.sign('HMAC', await key(secret, 'sign'), enc.encode(body));
  return `${body}.${b64(sig)}`;
}

/** Returns the payload, or null if the signature is wrong, the token is malformed, or it has expired. */
export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  try {
    const [h, p, s] = token.split('.');
    if (!h || !p || !s) return null;
    const valid = await crypto.subtle.verify('HMAC', await key(secret, 'verify'), unb64(s), enc.encode(`${h}.${p}`));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(unb64(p))) as JwtPayload;
    if (typeof payload.sub !== 'string' || typeof payload.exp !== 'number' || payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}
