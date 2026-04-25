import { NextRequest } from "next/server";
import { JsonResponse } from "@/lib/jsonResponse";
import { ModelFactory } from "@/lib/models";
import { logger } from "@/lib/logging/server";
import { getApiTenantOr401 } from "@/lib/api/apiAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const auth = await getApiTenantOr401(request);
        if (!auth.ok) return auth.response;
        const messageModel = await ModelFactory.getInstance().getMessageModel(auth.tenantId);
        const url = new URL(request.url);
        const sort = (url.searchParams.get("sort") || "desc") as "asc" | "desc";
        const limit = 20;
        const cursor = url.searchParams.get("cursor") ? parseInt(url.searchParams.get("cursor")!, 10) : undefined;

        const filter = {
            origin: (url.searchParams.get("origin") || undefined) as "client" | "server" | undefined,
            userId: url.searchParams.get("userId") || undefined,
            source: url.searchParams.get("source") || undefined,
            payloadToolkit: url.searchParams.get("payloadToolkit") || undefined,
            payloadToolName: url.searchParams.get("payloadToolName") || undefined,
            payloadMessageId: url.searchParams.get("payloadMessageId") || undefined,
        };

        const result = await messageModel.list(filter, { sort, limit, cursor });

        return JsonResponse.payloadsResponse([
            {
                key: "messages",
                payload: result.messages,
            },
            {
                key: "pagination",
                payload: result.pagination,
            },
        ]);
    } catch (error) {
        logger.error("Error in messages endpoint:", error);
        return JsonResponse.errorResponse(500, "Internal server error");
    }
}
