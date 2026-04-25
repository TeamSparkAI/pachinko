import { NextRequest } from 'next/server';
import { getDb } from '@/lib/models/sqlite/database';
import { JsonResponse } from '@/lib/jsonResponse';
import { getApiSessionOr403 } from '@/lib/api/apiAuth';
import { logger } from '@/lib/logging/server';

export const dynamic = 'force-dynamic';

export async function DELETE(
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
      `DELETE FROM tenant_api_keys WHERE keyId = ? AND tenantId = ?`,
      [keyId, auth.tenantId]
    );
    if (!changes) {
      return JsonResponse.errorResponse(404, 'Key not found');
    }
    return JsonResponse.payloadResponse('success', true);
  } catch (e) {
    logger.error('apiKeys DELETE', e);
    return JsonResponse.errorResponse(500, 'Internal server error');
  }
}
