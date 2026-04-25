import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { getDb } from '@/lib/models/sqlite/database';
import { hashPassword, verifyPassword } from '@/lib/auth/password';

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = (await request.json()) as { currentPassword?: string; newPassword?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
  if (!currentPassword || !newPassword || newPassword.length < 8) {
    return NextResponse.json(
      { error: 'currentPassword and newPassword (min 8 characters) are required' },
      { status: 400 }
    );
  }

  const db = await getDb();
  const user = await db.queryOne<{ passwordHash: string }>(
    'SELECT passwordHash FROM users WHERE userId = ? AND tenantId = ?',
    [session.userId, session.tenantId]
  );
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!(await verifyPassword(user.passwordHash, currentPassword))) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
  }

  const newHash = await hashPassword(newPassword);
  await db.execute('UPDATE users SET passwordHash = ? WHERE userId = ? AND tenantId = ?', [
    newHash,
    session.userId,
    session.tenantId,
  ]);

  return NextResponse.json({ ok: true });
}
