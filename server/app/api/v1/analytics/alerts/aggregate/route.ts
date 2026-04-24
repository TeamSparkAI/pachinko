import { NextRequest } from "next/server";
import { JsonResponse } from "@/lib/jsonResponse";
import { ModelFactory } from "@/lib/models";
import { logger } from "@/lib/logging/server";

type AlertDimension = "policyId" | "conditionName" | "seen" | "severity" | "source" | "payloadToolkit";

export interface AlertAggregateParams {
    dimension: AlertDimension;
    policyId?: number;
    conditionName?: string;
    seen?: boolean;
    severity?: number;
    startTime?: string;
    endTime?: string;
    source?: string;
    payloadToolkit?: string;
}

export interface AlertAggregateData {
    value: string;
    count: number;
}

export interface AlertAggregatePayload {
    data: Array<AlertAggregateData>;
    query: {
        dimension: string;
        timeRange?: {
            start?: string;
            end?: string;
        };
        filters?: Omit<AlertAggregateParams, "dimension">;
    };
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const alertModel = await ModelFactory.getInstance().getAlertModel();
        const searchParams = request.nextUrl.searchParams;

        const dimension = searchParams.get("dimension") as AlertDimension;
        if (!dimension) {
            return JsonResponse.errorResponse(400, "Dimension parameter is required");
        }

        const params: AlertAggregateParams = {
            dimension,
            policyId: searchParams.get("policyId") ? parseInt(searchParams.get("policyId")!, 10) : undefined,
            conditionName: searchParams.get("conditionName") || undefined,
            seen: searchParams.get("seen") ? searchParams.get("seen") === "true" : undefined,
            severity: searchParams.get("severity") ? parseInt(searchParams.get("severity")!, 10) : undefined,
            startTime: searchParams.get("startTime") || undefined,
            endTime: searchParams.get("endTime") || undefined,
            source: searchParams.get("source") || undefined,
            payloadToolkit: searchParams.get("payloadToolkit") || undefined,
        };

        const data = await alertModel.aggregate(params);

        const response: AlertAggregatePayload = {
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
                    ...(params.policyId && { policyId: params.policyId }),
                    ...(params.conditionName && { conditionName: params.conditionName }),
                    ...(params.seen !== undefined && { seen: params.seen }),
                    ...(params.severity !== undefined && { severity: params.severity }),
                    ...(params.source && { source: params.source }),
                    ...(params.payloadToolkit && { payloadToolkit: params.payloadToolkit }),
                },
            },
        };

        return JsonResponse.payloadResponse<AlertAggregatePayload>("aggregate", response);
    } catch (error) {
        logger.error("Error getting alert aggregates:", error);
        return JsonResponse.errorResponse(500, "Failed to get alert aggregates");
    }
}
