import { MessageData, MessageFilter, MessageListResult, MessagePagination, MessageAnalyticsFilter } from "./types/message";


export abstract class MessageModel {
    abstract findById(messageId: number): Promise<MessageData | null>;
    abstract list(filter: MessageFilter, pagination: MessagePagination): Promise<MessageListResult>;
    abstract create(data: Omit<MessageData, 'messageId' | 'createdAt'>): Promise<MessageData>;
    abstract update(messageId: number, data: Partial<MessageData>): Promise<MessageData>;
    abstract delete(messageId: number): Promise<boolean>;
    abstract timeSeries(params: {
        dimension: string;
        timeUnit: 'hour' | 'day' | 'week' | 'month';
    } & MessageAnalyticsFilter): Promise<Array<{ timestamp: string; counts: Record<string, number> }>>;
    abstract aggregate(params: {
        dimension: string;
    } & MessageAnalyticsFilter): Promise<Array<{ value: string; count: number }>>;
    abstract getDimensionValues(params: {
        dimensions: string[];
    } & MessageAnalyticsFilter): Promise<Record<string, string[]>>;
    abstract analyze(): Promise<void>;
    abstract deleteOldMessagesWithoutAlerts(beforeDate: string): Promise<{ deletedCount: number; preservedCount: number }>;
    abstract countMessagesWithAlerts(beforeDate: string): Promise<number>;
}
