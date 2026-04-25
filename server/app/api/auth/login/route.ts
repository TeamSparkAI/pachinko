import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/models/sqlite/database';
import { verifyPassword } from '@/lib/auth/password';
import { signSessionToken, SESSION_MAX_AGE_SEC } from '@/lib/auth/session';
import { SESSION_COOKIE_NAME } from '@/lib/auth/constants';

export async function POST(request: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = (await request.json()) as { email?: string; password?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || !password) {
    return NextResponse.json({ error: 'email and password are required' }, { status: 400 });
  }

  const db = await getDb();
  const user = await db.queryOne<{
    userId: number;
    tenantId: number;
    passwordHash: string;
  }>('SELECT userId, tenantId, passwordHash FROM users WHERE LOWER(email) = ?', [email]);

  if (!user || !(await verifyPassword(user.passwordHash, password))) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  const token = signSessionToken({ userId: user.userId, tenantId: user.tenantId });
  const res = NextResponse.json({ ok: true, tenantId: user.tenantId, userId: user.userId });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SEC,
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}
