import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME } from './constants';

export interface SessionPayload {
  userId: number;
  tenantId: number;
}

const JWT_ALGORITHM: jwt.Algorithm = 'HS256';
const SEVEN_DAYS = 7 * 24 * 60 * 60;

const DEV_FALLBACK_SESSION_SECRET = '__pachinko_dev_session_secret_change_me__';

function getSessionSecret(): string {
  const s = process.env.PACHINKO_SESSION_JWT_SECRET?.trim();
  return s || DEV_FALLBACK_SESSION_SECRET;
}

export function signSessionToken(payload: SessionPayload): string {
  return jwt.sign(
    { sub: String(payload.userId), tid: String(payload.tenantId) },
    getSessionSecret(),
    { algorithm: JWT_ALGORITHM, expiresIn: SEVEN_DAYS }
  );
}

function verifySessionToken(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, getSessionSecret(), { algorithms: [JWT_ALGORITHM] }) as jwt.JwtPayload;
    if (typeof decoded.sub !== 'string' || typeof decoded.tid !== 'string') {
      return null;
    }
    const userId = parseInt(decoded.sub, 10);
    const tenantId = parseInt(decoded.tid, 10);
    if (Number.isNaN(userId) || Number.isNaN(tenantId)) {
      return null;
    }
    return { userId, tenantId };
  } catch {
    return null;
  }
}

export function getSessionFromRequest(request: NextRequest): SessionPayload | null {
  const c = request.cookies.get(SESSION_COOKIE_NAME);
  if (!c?.value) {
    return null;
  }
  return verifySessionToken(c.value);
}

export async function getSessionFromCookieStore(): Promise<SessionPayload | null> {
  const store = await cookies();
  const c = store.get(SESSION_COOKIE_NAME);
  if (!c?.value) {
    return null;
  }
  return verifySessionToken(c.value);
}

export const SESSION_MAX_AGE_SEC = SEVEN_DAYS;
