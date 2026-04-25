import { NextRequest } from 'next/server';
import { ModelFactory } from '@/lib/models';
import { JsonResponse } from '@/lib/jsonResponse';
import { logger } from '@/lib/logging/server';
import { getApiTenantOr401 } from '@/lib/api/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: { messageId: string } }
) {
    try {
        const auth = await getApiTenantOr401(request);
        if (!auth.ok) return auth.response;
        const messageId = parseInt(params.messageId, 10);
        if (isNaN(messageId)) {
            return JsonResponse.errorResponse(400, 'Invalid message ID');
        }

        const messageActionModel = await ModelFactory.getInstance().getMessageActionModel(auth.tenantId);
        const messageAction = await messageActionModel.findByMessageId(messageId);

        if (!messageAction) {
            return JsonResponse.payloadResponse('messageAction', null);
        }

        return JsonResponse.payloadResponse('messageAction', messageAction);
    } catch (error) {
        logger.error('Error in message actions endpoint:', error);
        return JsonResponse.errorResponse(500, 'Internal server error');
    }
}
