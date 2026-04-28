import { getModelFactory } from '@/lib/models';
import { getDb } from '@/lib/models/sqlite/database';
import { DEFAULT_TENANT_ID } from '@/lib/auth/constants';

/**
 * Deletes every `users` row for the default tenant (migration 001 `tenantId = 1`).
 * Used by `pachinko --admin-reset` so operators can re-open first-account signup at `/login`.
 */
export async function resetDefaultTenantUsers(): Promise<number> {
  const modelFactory = getModelFactory();
  await modelFactory.initialize();
  const db = await getDb();
  const result = await db.execute('DELETE FROM users WHERE tenantId = ?', [DEFAULT_TENANT_ID]);
  return result.changes ?? 0;
}
