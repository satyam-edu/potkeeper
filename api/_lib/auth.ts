import { signJwt } from '../../shared/jwt';

export const TOKEN_DAYS = 90;
export const NAME_MAX = 24;

/** Trim + collapse spaces; null if empty. Names are only ever rendered as text, never as HTML. */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
  return name || null;
}

export function issueToken(userId: string, name: string): Promise<string> {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return signJwt({ sub: userId, name, exp: Math.floor(Date.now() / 1000) + TOKEN_DAYS * 86400 }, secret);
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
