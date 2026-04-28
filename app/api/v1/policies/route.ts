import { NextRequest } from 'next/server';
import { getModelFactory } from '@/lib/models';
import { JsonResponse } from '@/lib/jsonResponse';
import { logger } from '@/lib/logging/server';
import { getApiTenantOr401 } from '@/lib/api/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const auth = await getApiTenantOr401(request);
        if (!auth.ok) return auth.response;
        const modelFactory = getModelFactory();
        const policyModel = await modelFactory.getPolicyModel(auth.tenantId);
        const policies = await policyModel.list();
        return JsonResponse.payloadResponse('policies', policies);
    } catch (error) {
        logger.error('Error listing policies:', error);
        return JsonResponse.errorResponse(500, 'Failed to list policies');
    }
}

export async function POST(request: NextRequest) {
    try {
        const auth = await getApiTenantOr401(request);
        if (!auth.ok) return auth.response;
        const modelFactory = getModelFactory();
        const policyModel = await modelFactory.getPolicyModel(auth.tenantId);
        const data = await request.json();
        const policy = await policyModel.create(data);
        return JsonResponse.payloadResponse('policy', policy);
    } catch (error) {
        logger.error('Error creating policy:', error);
        return JsonResponse.errorResponse(500, 'Failed to create policy');
    }
} 