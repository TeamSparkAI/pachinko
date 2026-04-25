import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { getDb } from '@/lib/models/sqlite/database';

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = await getDb();
  const user = await db.queryOne<{
    userId: number;
    email: string;
    tenantId: number;
    role: string | null;
  }>(
    'SELECT userId, email, tenantId, role FROM users WHERE userId = ? AND tenantId = ?',
    [session.userId, session.tenantId]
  );
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenant = await db.queryOne<{ name: string; slug: string }>(
    'SELECT name, slug FROM tenants WHERE tenantId = ?',
    [session.tenantId]
  );

  return NextResponse.json({
    user: {
      userId: user.userId,
      email: user.email,
      role: user.role,
    },
    tenant: tenant
      ? { tenantId: session.tenantId, name: tenant.name, slug: tenant.slug }
      : { tenantId: session.tenantId, name: '', slug: '' },
  });
}
