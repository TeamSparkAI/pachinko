import { MessageOrigin } from "@/lib/jsonrpc";
import { PolicyCondition } from "@/lib/models/types/policy";
import { Finding } from "@/lib/policy-engine/types/core";

export interface AlertData {
    alertId: number;
    tenantId: number;
    messageId: number;
    policyId: number;
    origin: MessageOrigin;
    condition: PolicyCondition;
    findings: Finding[];
    timestamp: string;
    createdAt: string;
    seenAt: string | null;
}

export interface AlertReadData extends AlertData {
    policySeverity: number;
    payloadToolkit: string;
    payloadToolVersion: string;
    payloadToolName: string;
}

export interface AlertFilter {
    messageId?: number;
    policyId?: number;
    conditionName?: string;
    seen?: boolean;
    severity?: number;
    startTime?: string;
    endTime?: string;
    payloadToolkit?: string;
    payloadToolName?: string;
}

export interface AlertPagination {
    sort: "asc" | "desc";
    limit: number;
    cursor?: number;
}

export interface AlertListResult {
    alerts: AlertReadData[];
    pagination: {
        total: number;
        remaining: number;
        hasMore: boolean;
        nextCursor: number | null;
        limit: number;
        sort: "asc" | "desc";
    };
}
