import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/models/sqlite/database';
import { hashPassword, validateNewPassword } from '@/lib/auth/password';
import { signSessionToken, SESSION_MAX_AGE_SEC } from '@/lib/auth/session';
import { SESSION_COOKIE_NAME, DEFAULT_TENANT_ID } from '@/lib/auth/constants';

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

  const pwdErr = validateNewPassword(password);
  if (pwdErr) {
    return NextResponse.json({ error: pwdErr }, { status: 400 });
  }

  const db = await getDb();
  try {
    const { userId } = await db.transactionImmediate(async (tx) => {
      const count = await tx.queryOne<{ c: number }>('SELECT COUNT(*) as c FROM users');
      if ((count?.c ?? 0) > 0) {
        throw registrationClosedError();
      }
      const passwordHash = await hashPassword(password);
      const ins = await tx.execute(
        `INSERT INTO users (tenantId, email, passwordHash, role) VALUES (?, ?, ?, 'admin')`,
        [DEFAULT_TENANT_ID, email, passwordHash]
      );
      if (!ins.changes || ins.lastID == null) {
        throw new Error('Failed to create user');
      }
      return { userId: ins.lastID };
    });

    const token = signSessionToken({ userId, tenantId: DEFAULT_TENANT_ID });
    const res = NextResponse.json({ ok: true, tenantId: DEFAULT_TENANT_ID, userId });
    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SEC,
      secure: process.env.NODE_ENV === 'production',
    });
    return res;
  } catch (e) {
    if (isRegistrationClosed(e)) {
      return NextResponse.json(
        { error: 'An account already exists. Sign in instead.' },
        { status: 403 }
      );
    }
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('SQLITE_CONSTRAINT') || msg.toLowerCase().includes('unique')) {
      return NextResponse.json({ error: 'That email is already in use.' }, { status: 409 });
    }
    throw e;
  }
}

const REGISTRATION_CLOSED = 'REGISTRATION_CLOSED';

function registrationClosedError(): Error {
  const err = new Error('Registration closed');
  err.name = REGISTRATION_CLOSED;
  return err;
}

function isRegistrationClosed(e: unknown): boolean {
  return e instanceof Error && e.name === REGISTRATION_CLOSED;
}
