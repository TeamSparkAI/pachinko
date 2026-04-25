import { NextResponse } from 'next/server';
import { getDb } from '@/lib/models/sqlite/database';

export const dynamic = 'force-dynamic';

/** Public: whether any user exists (drives login vs first-account UI). */
export async function GET() {
  const db = await getDb();
  const row = await db.queryOne<{ c: number }>('SELECT COUNT(*) as c FROM users');
  const hasUsers = (row?.c ?? 0) > 0;
  return NextResponse.json({ hasUsers });
}
