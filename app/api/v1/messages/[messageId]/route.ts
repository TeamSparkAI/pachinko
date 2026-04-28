import { NextRequest } from "next/server";
import { JsonResponse } from "@/lib/jsonResponse";
import { getModelFactory } from "@/lib/models";
import { logger } from "@/lib/logging/server";
import { getApiTenantOr401 } from "@/lib/api/apiAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { messageId: string } }) {
    try {
        const auth = await getApiTenantOr401(request);
        if (!auth.ok) return auth.response;
        const modelFactory = getModelFactory();
        const messageModel = await modelFactory.getMessageModel(auth.tenantId);
        const message = await messageModel.findById(parseInt(params.messageId, 10));

        if (!message) {
            return JsonResponse.errorResponse(404, "Message not found");
        }

        return JsonResponse.payloadResponse("message", message);
    } catch (error) {
        logger.error("Error in message endpoint:", error);
        return JsonResponse.errorResponse(500, "Internal server error");
    }
}
