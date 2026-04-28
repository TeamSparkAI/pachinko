import { NextRequest } from 'next/server';
import { getModelFactory } from '@/lib/models';
import { JsonResponse } from '@/lib/jsonResponse';
import { logger } from '@/lib/logging/server';
import { getApiTenantOr401 } from '@/lib/api/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { policyId: string } }
) {
  try {
    const auth = await getApiTenantOr401(request);
    if (!auth.ok) return auth.response;
    const modelFactory = getModelFactory();
    const policyModel = await modelFactory.getPolicyModel(auth.tenantId);
    const policy = await policyModel.findById(parseInt(params.policyId, 10));
    if (!policy) {
      return JsonResponse.errorResponse(404, 'Policy not found');
    }
    return JsonResponse.payloadResponse('policy', policy);
  } catch (error) {
    logger.error('Error getting policy:', error);
    return JsonResponse.errorResponse(500, 'Failed to get policy');
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { policyId: string } }
) {
  try {
    const auth = await getApiTenantOr401(request);
    if (!auth.ok) return auth.response;
    const modelFactory = getModelFactory();
    const policyModel = await modelFactory.getPolicyModel(auth.tenantId);
    const data = await request.json();
    const policy = await policyModel.update(parseInt(params.policyId, 10), data);
    return JsonResponse.payloadResponse('policy', policy);
  } catch (error) {
    logger.error('Error updating policy:', error);
    return JsonResponse.errorResponse(500, 'Failed to update policy');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { policyId: string } }
) {
  try {
    const auth = await getApiTenantOr401(request);
    if (!auth.ok) return auth.response;
    const modelFactory = getModelFactory();
    const policyModel = await modelFactory.getPolicyModel(auth.tenantId);
    const deleted = await policyModel.delete(parseInt(params.policyId, 10));

    if (!deleted) {
      return JsonResponse.errorResponse(404, 'Policy not found');
    }

    return JsonResponse.emptyResponse();
  } catch (error) {
    logger.error('Error deleting policy:', error);
    return JsonResponse.errorResponse(500, 'Failed to delete policy');
  }
}
