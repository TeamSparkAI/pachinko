import { MessageOrigin } from "@/lib/jsonrpc";

/** Ingest origin for a row (e.g. `arcade` from Engine webhooks). */
export type MessageSource = string;

export interface MessageData {
    messageId: number;
    timestamp: string;
    timestampResult?: string;
    userId: string;
    source: MessageSource | null;
    payloadToolkit: string;
    payloadToolVersion: string;
    origin: MessageOrigin;
    payloadMessageId: string;
    payloadMethod: string;
    payloadToolName: string;
    payloadParams: any;
    payloadResult: any;
    payloadError: any;
    createdAt: string;
    alerts?: boolean;
}

export interface MessageListItemData {
    messageId: number;
    timestamp: string;
    timestampResult?: string;
    userId: string;
    source: MessageSource | null;
    payloadToolkit: string;
    payloadToolVersion: string;
    origin: MessageOrigin;
    payloadMessageId: string;
    payloadMethod: string;
    payloadToolName: string;
    hasError: boolean;
    createdAt: string;
    alerts?: boolean;
}

export interface MessageFilter {
    origin?: MessageOrigin;
    userId?: string;
    source?: string;
    payloadToolkit?: string;
    payloadMethod?: string;
    payloadMessageId?: string;
    payloadToolName?: string;
    startTime?: string;
    endTime?: string;
}

/** Filters passed to time-series / aggregate / dimension value queries. */
export interface MessageAnalyticsFilter {
    userId?: string;
    source?: string;
    payloadToolkit?: string;
    payloadMethod?: string;
    payloadToolName?: string;
    startTime?: string;
    endTime?: string;
}

export interface MessagePagination {
    sort: 'asc' | 'desc';
    limit: number;
    cursor?: number;
}

export interface MessageListResult {
    messages: MessageListItemData[];
    pagination: {
        total: number;
        remaining: number;
        hasMore: boolean;
        nextCursor: number | null;
        limit: number;
        sort: 'asc' | 'desc';
    };
}
