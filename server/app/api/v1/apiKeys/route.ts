import { NextRequest } from 'next/server';
import { nanoid } from 'nanoid';
import { getDb } from '@/lib/models/sqlite/database';
import { JsonResponse } from '@/lib/jsonResponse';
import { getApiSessionOr403 } from '@/lib/api/apiAuth';
import { hashPassword } from '@/lib/auth/password';
import { logger } from '@/lib/logging/server';

const KEY_LOOKUP_LEN = 12;
const KEY_SECRET_LEN = 32;

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await getApiSessionOr403(request);
    if (!auth.ok) return auth.response;
    const db = await getDb();
    const { rows } = await db.query<{
      keyId: number;
      keyLookupId: string;
      name: string | null;
      createdAt: string;
      revokedAt: string | null;
    }>(
      `SELECT keyId, keyLookupId, name, createdAt, revokedAt FROM tenant_api_keys
       WHERE tenantId = ? ORDER BY createdAt DESC`,
      [auth.tenantId]
    );
    return JsonResponse.payloadResponse('apiKeys', rows);
  } catch (e) {
    logger.error('apiKeys GET', e);
    return JsonResponse.errorResponse(500, 'Internal server error');
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getApiSessionOr403(request);
    if (!auth.ok) return auth.response;
    let name = 'API key';
    try {
      const body = (await request.json()) as { name?: unknown };
      if (typeof body?.name === 'string' && body.name.trim()) {
        name = body.name.trim().slice(0, 120);
      }
    } catch {
      /* no body */
    }
    const keyLookupId = nanoid(KEY_LOOKUP_LEN);
    const secret = nanoid(KEY_SECRET_LEN);
    const secretHash = await hashPassword(secret);
    const db = await getDb();
    const { lastID } = await db.execute(
      `INSERT INTO tenant_api_keys (tenantId, keyLookupId, name, secretHash) VALUES (?, ?, ?, ?)`,
      [auth.tenantId, keyLookupId, name, secretHash]
    );
    if (!lastID) {
      return JsonResponse.errorResponse(500, 'Failed to create key');
    }
    const created = await db.queryOne<{
      keyId: number;
      keyLookupId: string;
      name: string | null;
      createdAt: string;
    }>(
      `SELECT keyId, keyLookupId, name, createdAt FROM tenant_api_keys WHERE keyId = ? AND tenantId = ?`,
      [lastID, auth.tenantId]
    );
    if (!created) {
      return JsonResponse.errorResponse(500, 'Failed to read new key');
    }
    const bearerToken = `${keyLookupId}.${secret}`;
    return JsonResponse.payloadResponse('created', {
      ...created,
      bearerToken,
    });
  } catch (e) {
    logger.error('apiKeys POST', e);
    return JsonResponse.errorResponse(500, 'Internal server error');
  }
}
