import { getDb } from '@/lib/models/sqlite/database';
import { logger } from '@/lib/logging/server';
import { hashPassword } from './password';
import {
  BOOTSTRAP_ADMIN_EMAIL,
  BOOTSTRAP_ADMIN_PASSWORD,
  DEFAULT_TENANT_ID,
} from './constants';

/**
 * One row in `users` means bootstrap already ran.
 */
export async function ensureBootstrapData(): Promise<void> {
  const db = await getDb();
  const count = await db.queryOne<{ c: number }>(
    'SELECT COUNT(*) as c FROM users'
  );
  if (count && count.c > 0) {
    return;
  }

  const tenant = await db.queryOne<{ tenantId: number }>(
    'SELECT tenantId FROM tenants WHERE tenantId = ?',
    [DEFAULT_TENANT_ID]
  );
  if (!tenant) {
    logger.error('ensureBootstrapData: missing default tenant row; migration 001 must insert tenants');
    throw new Error('Default tenant not found; check migrations');
  }

  const passwordHash = await hashPassword(BOOTSTRAP_ADMIN_PASSWORD);
  const userResult = await db.execute(
    `INSERT INTO users (tenantId, email, passwordHash, role) VALUES (?, ?, ?, 'admin')`,
    [DEFAULT_TENANT_ID, BOOTSTRAP_ADMIN_EMAIL, passwordHash]
  );
  if (!userResult.changes) {
    throw new Error('Failed to insert bootstrap user');
  }

  logger.info(`Bootstrap: created user ${BOOTSTRAP_ADMIN_EMAIL}. Create an API key under Settings.`);
}
