import { SignJWT, jwtVerify } from 'jose';
import { createHash, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';

const accessKey = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const refreshKey = new TextEncoder().encode(env.JWT_REFRESH_SECRET);

export type AccessPayload = {
  sub: string; // user id
  cid: string; // company id
  roles: string[]; // role keys
  branchIds: string[];
};

export async function signAccessToken(payload: AccessPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(env.JWT_ACCESS_TTL)
    .setIssuer('rcos-api')
    .sign(accessKey);
}

export async function verifyAccessToken(token: string): Promise<AccessPayload> {
  const { payload } = await jwtVerify(token, accessKey, { issuer: 'rcos-api' });
  return {
    sub: String(payload.sub),
    cid: String(payload.cid),
    roles: (payload.roles as string[]) ?? [],
    branchIds: (payload.branchIds as string[]) ?? [],
  };
}

// Refresh tokens are opaque random strings. We store their sha256 in DB.
export function generateRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(48).toString('base64url');
  const hash = createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Convert "30d" | "15m" | "3600" → seconds
export function ttlToSeconds(ttl: string): number {
  const m = ttl.match(/^(\d+)([smhd])?$/);
  if (!m) return Number(ttl);
  const n = Number(m[1]);
  switch (m[2]) {
    case 's': return n;
    case 'm': return n * 60;
    case 'h': return n * 3600;
    case 'd': return n * 86400;
    default:  return n;
  }
}
