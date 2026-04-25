import { getDb } from '@/lib/models/sqlite/database';
import { logger } from '@/lib/logging/server';
import { DEFAULT_TENANT_ID } from './constants';

/**
 * After migrations, verify the default tenant from 001 exists.
 * First admin is created via `/login` when there are no users, not here.
 */
export async function ensureBootstrapData(): Promise<void> {
  const db = await getDb();
  const tenant = await db.queryOne<{ tenantId: number }>(
    'SELECT tenantId FROM tenants WHERE tenantId = ?',
    [DEFAULT_TENANT_ID]
  );
  if (!tenant) {
    logger.error('ensureBootstrapData: missing default tenant row; migration 001 must insert tenants');
    throw new Error('Default tenant not found; check migrations');
  }
}
