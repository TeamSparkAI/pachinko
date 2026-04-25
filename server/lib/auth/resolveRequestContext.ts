import type { NextRequest } from 'next/server';
import { getSessionFromRequest } from './session';
import { parseBearerApiKey } from './apiKeyFormat';
import { getDb } from '@/lib/models/sqlite/database';
import { verifyPassword } from './password';

export type RequestAuthContext =
  | { authMode: 'session'; tenantId: number; userId: number }
  | { authMode: 'bearer'; tenantId: number; keyId: number; userId: null }
  | { authMode: 'unauthenticated' };

/**
 * Resolves session cookie or `Authorization: Bearer keyLookupId.secret` API key.
 */
export async function resolveRequestContext(request: NextRequest): Promise<RequestAuthContext> {
  const session = getSessionFromRequest(request);
  if (session) {
    return { authMode: 'session', tenantId: session.tenantId, userId: session.userId };
  }

  const authHeader = request.headers.get('authorization');
  const parsed = parseBearerApiKey(authHeader);
  if (!parsed) {
    return { authMode: 'unauthenticated' };
  }

  const db = await getDb();
  const row = await db.queryOne<{
    keyId: number;
    tenantId: number;
    secretHash: string;
  }>(
    `SELECT keyId, tenantId, secretHash FROM tenant_api_keys
     WHERE keyLookupId = ? AND revokedAt IS NULL`,
    [parsed.keyLookupId]
  );

  if (!row) {
    return { authMode: 'unauthenticated' };
  }

  const ok = await verifyPassword(row.secretHash, parsed.secret);
  if (!ok) {
    return { authMode: 'unauthenticated' };
  }

  return { authMode: 'bearer', tenantId: row.tenantId, keyId: row.keyId, userId: null };
}

export function isAuthorizedTenant(ctx: RequestAuthContext): ctx is
  | { authMode: 'session'; tenantId: number; userId: number }
  | { authMode: 'bearer'; tenantId: number; keyId: number; userId: null } {
  return ctx.authMode === 'session' || ctx.authMode === 'bearer';
}
