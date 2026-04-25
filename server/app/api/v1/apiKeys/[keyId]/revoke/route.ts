import { NextRequest } from 'next/server';
import { getDb } from '@/lib/models/sqlite/database';
import { JsonResponse } from '@/lib/jsonResponse';
import { getApiSessionOr403 } from '@/lib/api/apiAuth';
import { logger } from '@/lib/logging/server';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { keyId: string } }
) {
  try {
    const auth = await getApiSessionOr403(request);
    if (!auth.ok) return auth.response;
    const keyId = parseInt(params.keyId, 10);
    if (Number.isNaN(keyId)) {
      return JsonResponse.errorResponse(400, 'Invalid key id');
    }
    const db = await getDb();
    const { changes } = await db.execute(
      `UPDATE tenant_api_keys
       SET revokedAt = COALESCE(revokedAt, datetime('now'))
       WHERE keyId = ? AND tenantId = ? AND revokedAt IS NULL`,
      [keyId, auth.tenantId]
    );
    if (!changes) {
      return JsonResponse.errorResponse(404, 'Key not found or already revoked');
    }
    const row = await db.queryOne<{
      keyId: number;
      keyLookupId: string;
      name: string | null;
      createdAt: string;
      revokedAt: string | null;
    }>(
      `SELECT keyId, keyLookupId, name, createdAt, revokedAt FROM tenant_api_keys WHERE keyId = ? AND tenantId = ?`,
      [keyId, auth.tenantId]
    );
    if (!row) {
      return JsonResponse.errorResponse(500, 'Failed to read key');
    }
    return JsonResponse.payloadResponse('apiKey', row);
  } catch (e) {
    logger.error('apiKeys revoke', e);
    return JsonResponse.errorResponse(500, 'Internal server error');
  }
}
