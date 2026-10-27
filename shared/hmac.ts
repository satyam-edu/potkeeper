// HMAC-SHA256 hex signature for the PartyKit → /api/games/settle call. WebCrypto: runs in Node and Workers.
const enc = new TextEncoder();
const key = (secret: string, use: KeyUsage) =>
  crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [use]);

export async function signBody(body: string, secret: string): Promise<string> {
  const sig = await crypto.subtle.sign('HMAC', await key(secret, 'sign'), enc.encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time check (WebCrypto verify). False for a wrong, malformed or missing signature. */
export async function verifyBody(body: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature || !/^[0-9a-f]{64}$/.test(signature)) return false;
  const bytes = Uint8Array.from(signature.match(/../g)!, (h) => parseInt(h, 16));
  return crypto.subtle.verify('HMAC', await key(secret, 'verify'), bytes, enc.encode(body));
}
