import { NextRequest } from "next/server";
import { JsonResponse } from "@/lib/jsonResponse";
import { ModelFactory } from "@/lib/models";
import { logger } from "@/lib/logging/server";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: { messageId: string } }) {
    try {
        const messageModel = await ModelFactory.getInstance().getMessageModel();
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
