import { NextRequest } from 'next/server';
import { ModelFactory } from '@/lib/models';
import { JsonResponse } from '@/lib/jsonResponse';
import { logger } from '@/lib/logging/server';
import { ConditionRegistry } from '@/lib/policy-engine/conditions/registry/ConditionRegistry';
import { ActionRegistry } from '@/lib/policy-engine/actions/registry/ActionRegistry';
import { getApiTenantOr401 } from '@/lib/api/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { configId: string } }
) {
  try {
    const auth = await getApiTenantOr401(request);
    if (!auth.ok) return auth.response;
    const configId = parseInt(params.configId, 10);
    if (isNaN(configId)) {
      return JsonResponse.errorResponse(400, 'Invalid configId');
    }

    const policyElementModel = await ModelFactory.getInstance().getPolicyElementModel(auth.tenantId);
    const element = await policyElementModel.findById(configId);

    if (!element) {
      return JsonResponse.errorResponse(404, 'Policy element not found');
    }

    return JsonResponse.payloadResponse('policyElement', element);
  } catch (error) {
    logger.error('Error getting policy element:', error);
    return JsonResponse.errorResponse(500, 'Failed to get policy element');
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { configId: string } }
) {
  try {
    const auth = await getApiTenantOr401(request);
    if (!auth.ok) return auth.response;
    const configId = parseInt(params.configId, 10);
    if (isNaN(configId)) {
      return JsonResponse.errorResponse(400, 'Invalid configId');
    }

    const body = await request.json();
    const { config, enabled } = body;

    const updateData: Record<string, unknown> = {};
    if (config !== undefined) updateData.config = config;
    if (enabled !== undefined) updateData.enabled = enabled;

    if (Object.keys(updateData).length === 0) {
      return JsonResponse.errorResponse(400, 'No valid fields to update');
    }

    const policyElementModel = await ModelFactory.getInstance().getPolicyElementModel(auth.tenantId);

    if (updateData.config !== undefined) {
      const existingElement = await policyElementModel.findById(configId);

      if (!existingElement) {
        return JsonResponse.errorResponse(404, 'Policy element not found');
      }

      let elementClass = null;
      if (existingElement.elementType === 'condition') {
        elementClass = ConditionRegistry.getCondition(existingElement.className);
      } else if (existingElement.elementType === 'action') {
        elementClass = ActionRegistry.getAction(existingElement.className);
      }

      if (elementClass && elementClass.configValidator) {
        const configValidation = elementClass.configValidator(updateData.config);
        if (!configValidation.isValid) {
          return JsonResponse.errorResponse(400, `Invalid config: ${configValidation.error}`);
        }
      }
    }

    const element = await policyElementModel.update(configId, updateData);

    return JsonResponse.payloadResponse('policyElement', element);
  } catch (error) {
    logger.error('Error updating policy element:', error);
    return JsonResponse.errorResponse(500, 'Failed to update policy element');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { configId: string } }
) {
  try {
    const auth = await getApiTenantOr401(request);
    if (!auth.ok) return auth.response;
    const configId = parseInt(params.configId, 10);
    if (isNaN(configId)) {
      return JsonResponse.errorResponse(400, 'Invalid configId');
    }

    const policyElementModel = await ModelFactory.getInstance().getPolicyElementModel(auth.tenantId);
    const deleted = await policyElementModel.delete(configId);

    if (!deleted) {
      return JsonResponse.errorResponse(404, 'Policy element not found');
    }

    return JsonResponse.emptyResponse();
  } catch (error) {
    logger.error('Error deleting policy element:', error);
    return JsonResponse.errorResponse(500, 'Failed to delete policy element');
  }
}
