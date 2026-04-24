import { NextRequest } from "next/server";
import { JsonResponse } from "@/lib/jsonResponse";
import { ModelFactory } from "@/lib/models";
import { logger } from "@/lib/logging/server";

export const dynamic = "force-dynamic";

const MESSAGE_DIMENSIONS = ["userId", "source", "payloadToolkit", "payloadMethod", "payloadToolName"] as const;
type MessageDimension = (typeof MESSAGE_DIMENSIONS)[number];

const ALERT_DIMENSIONS = ["policyId", "conditionName", "seen", "severity"] as const;
type AlertDimension = (typeof ALERT_DIMENSIONS)[number];

export type Dimension = MessageDimension | AlertDimension;

const ID_DIMENSIONS: Partial<
    Record<MessageDimension | AlertDimension, { model: "policy"; idField: string; nameField: string }>
> = {
    policyId: {
        model: "policy",
        idField: "policyId",
        nameField: "name",
    },
} as const;

const STATIC_DIMENSIONS = {
    severity: [
        { value: "1", label: "Critical" },
        { value: "2", label: "High" },
        { value: "3", label: "Medium" },
        { value: "4", label: "Low" },
        { value: "5", label: "Info" },
    ],
    seen: [
        { value: "seen", label: "Seen" },
        { value: "unseen", label: "New" },
    ],
} as const;

export interface DimensionsParams {
    dimensions: Dimension[];
    userId?: string;
    source?: string;
    payloadToolkit?: string;
    payloadMethod?: string;
    payloadToolName?: string;
    policyId?: number;
    conditionName?: string;
    seen?: boolean;
    severity?: number;
    startTime?: string;
    endTime?: string;
}

export interface DimensionsPayload {
    data: Record<
        string,
        Array<{
            value: string;
            label: string;
        }>
    >;
    query: {
        dimensions: string[];
        timeRange?: {
            start?: string;
            end?: string;
        };
        filters?: DimensionsParams;
    };
}

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;

        const dimensions = searchParams.getAll("dimension") as Dimension[];
        if (dimensions.length === 0) {
            return JsonResponse.errorResponse(400, "Dimensions parameter is required");
        }

        const params: DimensionsParams = {
            dimensions,
            userId: searchParams.get("userId") || undefined,
            source: searchParams.get("source") || undefined,
            payloadToolkit: searchParams.get("payloadToolkit") || undefined,
            payloadMethod: searchParams.get("payloadMethod") || undefined,
            payloadToolName: searchParams.get("payloadToolName") || undefined,
            policyId: searchParams.get("policyId") ? Number(searchParams.get("policyId")) : undefined,
            conditionName: searchParams.get("conditionName") || undefined,
            seen: searchParams.get("seen") ? searchParams.get("seen") === "true" : undefined,
            severity: searchParams.get("severity") ? Number(searchParams.get("severity")) : undefined,
            startTime: searchParams.get("startTime") || undefined,
            endTime: searchParams.get("endTime") || undefined,
        };

        const messageModel = await ModelFactory.getInstance().getMessageModel();
        const alertModel = await ModelFactory.getInstance().getAlertModel();
        const policyModel = await ModelFactory.getInstance().getPolicyModel();

        const idDimensions = dimensions.filter((dim) => dim in ID_DIMENSIONS);
        const staticDimensions = dimensions.filter((dim) => dim in STATIC_DIMENSIONS);
        const dynamicDimensions = dimensions.filter(
            (dim) => !idDimensions.includes(dim) && !staticDimensions.includes(dim)
        );

        const messageDimensions = dynamicDimensions.filter((dim) =>
            MESSAGE_DIMENSIONS.includes(dim as MessageDimension)
        );
        const alertDimensions = dynamicDimensions.filter((dim) => ALERT_DIMENSIONS.includes(dim as AlertDimension));

        const msgFilter = {
            userId: params.userId,
            source: params.source,
            payloadToolkit: params.payloadToolkit,
            payloadMethod: params.payloadMethod,
            payloadToolName: params.payloadToolName,
            startTime: params.startTime,
            endTime: params.endTime,
        };

        const alertFilter = {
            policyId: params.policyId,
            conditionName: params.conditionName,
            seen: params.seen,
            startTime: params.startTime,
            endTime: params.endTime,
            source: params.source,
            payloadToolkit: params.payloadToolkit,
        };

        const [messageData, alertData, idData] = await Promise.all([
            messageDimensions.length > 0
                ? messageModel.getDimensionValues({
                      dimensions: messageDimensions,
                      ...msgFilter,
                  })
                : Promise.resolve({}),
            alertDimensions.length > 0
                ? alertModel.getDimensionValues({
                      dimensions: alertDimensions,
                      ...alertFilter,
                  })
                : Promise.resolve({}),
            Promise.all(
                idDimensions.map(async (dim) => {
                    const config = ID_DIMENSIONS[dim];
                    if (!config) {
                        throw new Error(`No configuration found for dimension: ${dim}`);
                    }

                    const idValues =
                        MESSAGE_DIMENSIONS.includes(dim as MessageDimension)
                            ? await messageModel.getDimensionValues({
                                  dimensions: [dim as string],
                                  ...msgFilter,
                              })
                            : await alertModel.getDimensionValues({
                                  dimensions: [dim as string],
                                  ...alertFilter,
                              });

                    const ids = idValues[dim] || [];
                    const numericIds = ids.map((id) => Number(id));
                    const records = await policyModel.getByIds(numericIds);

                    return {
                        [dim]: records.map((record) => ({
                            value: String(record[config.idField as keyof typeof record]),
                            label: record.name,
                        })),
                    };
                })
            ).then((results) => Object.assign({}, ...results)),
        ]);

        const result = {
            data: {
                ...Object.fromEntries(
                    staticDimensions.map((dim) => [
                        dim,
                        STATIC_DIMENSIONS[dim as keyof typeof STATIC_DIMENSIONS],
                    ])
                ),
                ...idData,
                ...(Object.keys(messageData).length > 0
                    ? Object.fromEntries(
                          Object.entries(messageData).map(([dim, values]) => [
                              dim,
                              (dim === "payloadToolName"
                                  ? (values as string[]).filter((v) => v !== "")
                                  : (values as string[])
                              ).map((value) => ({
                                  value: String(value),
                                  label: String(value),
                              })),
                          ])
                      )
                    : {}),
                ...(Object.keys(alertData).length > 0
                    ? Object.fromEntries(
                          Object.entries(alertData).map(([dim, values]) => [
                              dim,
                              (values as string[]).map((value) => ({
                                  value: String(value),
                                  label: String(value),
                              })),
                          ])
                      )
                    : {}),
            },
            query: {
                dimensions,
                timeRange:
                    params.startTime && params.endTime
                        ? {
                              start: params.startTime,
                              end: params.endTime,
                          }
                        : undefined,
                filters: params,
            },
        };

        return JsonResponse.payloadResponse<DimensionsPayload>("dimensions", result);
    } catch (error) {
        logger.error("Error in dimensions endpoint:", error);
        return JsonResponse.errorResponse(500, "An error occurred");
    }
}
