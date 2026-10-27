import mongoose from 'mongoose';
import { signJwt, verifyJwt, type JwtPayload } from '../../shared/jwt';
import { connectDb } from './db';
import { User } from './models';

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

/** Claims from an `Authorization: Bearer <token>` header, or null. Signature check only — no DB. */
export function bearerClaims(request: Request): Promise<JwtPayload | null> {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  const secret = process.env.JWT_SECRET;
  return token && secret ? verifyJwt(token, secret) : Promise.resolve(null);
}

/** The signed-in user's doc, or null if the token is bad, the user is gone, or the guest was merged away (must sign in with Google). */
export async function currentUser(request: Request) {
  const claims = await bearerClaims(request);
  if (!claims || !mongoose.isValidObjectId(claims.sub)) return null;
  await connectDb();
  const u = await User.findById(claims.sub);
  return !u || u.mergedInto ? null : u;
}
