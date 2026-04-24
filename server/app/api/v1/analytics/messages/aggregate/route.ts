import { NextRequest } from "next/server";
import { JsonResponse } from "@/lib/jsonResponse";
import { ModelFactory } from "@/lib/models";
import { logger } from "@/lib/logging/server";

const DIMENSION_ALIASES: Record<string, string> = {
    method: "payloadMethod",
    toolName: "payloadToolName",
    serverName: "payloadToolkit",
};

export interface MessageAggregateParams {
    dimension: string;
    userId?: string;
    source?: string;
    payloadToolkit?: string;
    payloadMethod?: string;
    payloadToolName?: string;
    startTime?: string;
    endTime?: string;
}

export interface MessageAggregateData {
    value: string;
    count: number;
}

export interface MessageAggregatePayload {
    data: Array<MessageAggregateData>;
    query: {
        dimension: string;
        timeRange?: {
            start?: string;
            end?: string;
        };
        filters?: Omit<MessageAggregateParams, "dimension">;
    };
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const messageModel = await ModelFactory.getInstance().getMessageModel();
        const url = new URL(request.url);

        const dimRaw = url.searchParams.get("dimension") || "";
        const dimension = DIMENSION_ALIASES[dimRaw] || dimRaw;
        if (!dimension) {
            return JsonResponse.errorResponse(400, "Dimension parameter is required");
        }

        const params: MessageAggregateParams = {
            dimension,
            userId: url.searchParams.get("userId") || undefined,
            source: url.searchParams.get("source") || undefined,
            payloadToolkit: url.searchParams.get("payloadToolkit") || undefined,
            payloadMethod: url.searchParams.get("payloadMethod") || undefined,
            payloadToolName: url.searchParams.get("payloadToolName") || undefined,
            startTime: url.searchParams.get("startTime") || undefined,
            endTime: url.searchParams.get("endTime") || undefined,
        };

        const data = await messageModel.aggregate(params);

        const response: MessageAggregatePayload = {
            data,
            query: {
                dimension: params.dimension,
                timeRange:
                    params.startTime || params.endTime
                        ? {
                              start: params.startTime,
                              end: params.endTime,
                          }
                        : undefined,
                filters: {
                    ...(params.userId && { userId: params.userId }),
                    ...(params.source && { source: params.source }),
                    ...(params.payloadToolkit && { payloadToolkit: params.payloadToolkit }),
                    ...(params.payloadMethod && { payloadMethod: params.payloadMethod }),
                    ...(params.payloadToolName && { payloadToolName: params.payloadToolName }),
                },
            },
        };

        return JsonResponse.payloadResponse<MessageAggregatePayload>("aggregate", response);
    } catch (error) {
        logger.error("Error in aggregate endpoint:", error);
        return JsonResponse.errorResponse(500, "An error occurred");
    }
}
