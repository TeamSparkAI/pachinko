import { NextRequest } from 'next/server';
import { JsonResponse } from '../../../../../lib/jsonResponse';
import { RetentionService } from '../../../../../lib/services/retentionService';
import { logger } from '@/lib/logging/server';
import { getApiTenantOr401 } from '@/lib/api/apiAuth';

export async function POST(request: NextRequest) {
    try {
        const auth = await getApiTenantOr401(request);
        if (!auth.ok) return auth.response;
        const retentionService = RetentionService.getInstance();
        const stats = await retentionService.enforceRetention(auth.tenantId);

        return JsonResponse.payloadResponse('stats', stats);
    } catch (error) {
        logger.error('Error enforcing retention:', error);
        return JsonResponse.errorResponse(500, 'Failed to enforce retention policies');
    }
}

export async function GET(request: NextRequest) {
    try {
        const auth = await getApiTenantOr401(request);
        if (!auth.ok) return auth.response;
        const retentionService = RetentionService.getInstance();
        const stats = await retentionService.getRetentionStats(auth.tenantId);

        return JsonResponse.payloadResponse('stats', stats);
    } catch (error) {
        logger.error('Error getting retention stats:', error);
        return JsonResponse.errorResponse(500, 'Failed to get retention statistics');
    }
} 