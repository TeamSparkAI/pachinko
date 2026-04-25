import { NextRequest } from "next/server";
import { JsonResponse } from "@/lib/jsonResponse";
import { ModelFactory } from "@/lib/models";
import { getApiTenantOr401 } from "@/lib/api/apiAuth";

export const dynamic = "force-dynamic";

const DIMENSION_ALIASES: Record<string, string> = {
    method: "payloadMethod",
    toolName: "payloadToolName",
    serverName: "payloadToolkit",
};

type TimeUnit = "hour" | "day" | "week" | "month";

export interface MessageTimeSeriesParams {
    dimension: string;
    timeUnit: TimeUnit;
    userId?: string;
    source?: string;
    payloadToolkit?: string;
    payloadMethod?: string;
    payloadToolName?: string;
    startTime?: string;
    endTime?: string;
}

export interface MessageTimeSeriesData {
    timestamp: string;
    counts: Record<string, number>;
}

export interface MessageTimeSeriesPayload {
    data: Array<MessageTimeSeriesData>;
    query: {
        dimension: string;
        timeUnit: TimeUnit;
        timeRange?: {
            start?: string;
            end?: string;
        };
        filters?: Omit<MessageTimeSeriesParams, "dimension" | "timeUnit">;
    };
}

export async function GET(request: NextRequest) {
    try {
        const auth = await getApiTenantOr401(request);
        if (!auth.ok) return auth.response;
        const { searchParams } = new URL(request.url);
        const dimRaw = searchParams.get("dimension") || "";
        const dimension = DIMENSION_ALIASES[dimRaw] || dimRaw;

        const params: MessageTimeSeriesParams = {
            dimension,
            timeUnit: searchParams.get("timeUnit") as TimeUnit,
            userId: searchParams.get("userId") || undefined,
            source: searchParams.get("source") || undefined,
            payloadToolkit: searchParams.get("payloadToolkit") || undefined,
            payloadMethod: searchParams.get("payloadMethod") || undefined,
            payloadToolName: searchParams.get("payloadToolName") || undefined,
            startTime: searchParams.get("startTime") || undefined,
            endTime: searchParams.get("endTime") || undefined,
        };

        if (!params.dimension || !params.timeUnit) {
            return JsonResponse.errorResponse(400, "Missing required parameters");
        }

        const messageModel = await ModelFactory.getInstance().getMessageModel(auth.tenantId);
        const data = await messageModel.timeSeries(params);

        const response: MessageTimeSeriesPayload = {
            data,
            query: {
                dimension: params.dimension,
                timeUnit: params.timeUnit,
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

        return JsonResponse.payloadResponse<MessageTimeSeriesPayload>("timeSeries", response);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An error occurred";
        return JsonResponse.errorResponse(500, errorMessage);
    }
}
