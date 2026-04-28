import { NextRequest } from "next/server";
import { JsonResponse } from "@/lib/jsonResponse";
import { getModelFactory } from "@/lib/models";
import { logger } from "@/lib/logging/server";
import { getApiTenantOr401 } from "@/lib/api/apiAuth";

type TimeUnit = "hour" | "day" | "week" | "month";
type Dimension = "policyId" | "conditionName" | "seen" | "severity" | "payloadToolkit" | "payloadToolName";

interface AlertTimeSeriesParams {
    dimension: Dimension;
    timeUnit: TimeUnit;
    policyId?: number;
    conditionName?: string;
    seen?: boolean;
    severity?: number;
    startTime?: string;
    endTime?: string;
    payloadToolkit?: string;
    payloadToolName?: string;
}

export interface AlertTimeSeriesData {
    timestamp: string;
    counts: Record<string, number>;
}

export interface AlertTimeSeriesPayload {
    data: Array<AlertTimeSeriesData>;
    query: {
        dimension: Dimension;
        timeUnit: TimeUnit;
        timeRange?: {
            start?: string;
            end?: string;
        };
        filters?: Omit<AlertTimeSeriesParams, "dimension" | "timeUnit">;
    };
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const auth = await getApiTenantOr401(request);
        if (!auth.ok) return auth.response;
        const modelFactory = getModelFactory();
        const { searchParams } = new URL(request.url);
        const params: AlertTimeSeriesParams = {
            dimension: searchParams.get("dimension") as Dimension,
            timeUnit: searchParams.get("timeUnit") as TimeUnit,
            policyId: searchParams.get("policyId") ? Number(searchParams.get("policyId")) : undefined,
            conditionName: searchParams.get("conditionName") || undefined,
            seen: searchParams.get("seen") === "true" ? true : searchParams.get("seen") === "false" ? false : undefined,
            severity: searchParams.get("severity") ? Number(searchParams.get("severity")) : undefined,
            startTime: searchParams.get("startTime") || undefined,
            endTime: searchParams.get("endTime") || undefined,
            payloadToolkit: searchParams.get("payloadToolkit") || undefined,
            payloadToolName: searchParams.get("payloadToolName") || undefined,
        };

        if (!params.dimension || !params.timeUnit) {
            return JsonResponse.errorResponse(400, "Missing required parameters");
        }

        const alertModel = await modelFactory.getAlertModel(auth.tenantId);
        const data = await alertModel.timeSeries(params);

        const response: AlertTimeSeriesPayload = {
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
                    ...(params.policyId && { policyId: params.policyId }),
                    ...(params.conditionName && { conditionName: params.conditionName }),
                    ...(params.seen !== undefined && { seen: params.seen }),
                    ...(params.severity !== undefined && { severity: params.severity }),
                    ...(params.payloadToolkit && { payloadToolkit: params.payloadToolkit }),
                    ...(params.payloadToolName && { payloadToolName: params.payloadToolName }),
                },
            },
        };

        return JsonResponse.payloadResponse("timeSeries", response);
    } catch (error) {
        logger.error("Error in alerts timeSeries endpoint:", error);
        return JsonResponse.errorResponse(500, "Internal server error");
    }
}
