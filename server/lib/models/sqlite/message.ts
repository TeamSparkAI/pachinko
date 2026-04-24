import { MessageModel } from '../message';
import { DatabaseClient, SqliteValue } from '../sqlite/database';
import { MessageOrigin } from '../../jsonrpc';
import { logger } from '@/lib/logging/server';
import {
    MessageData,
    MessageFilter,
    MessageListResult,
    MessagePagination,
    MessageAnalyticsFilter,
} from '../types/message';

export class SqliteMessageModel extends MessageModel {
    private db: DatabaseClient;

    constructor(db: DatabaseClient) {
        super();
        this.db = db;
    }

    async findById(messageId: number): Promise<MessageData | null> {
        const result = await this.db.query<MessageData & { hasAlerts: number }>(
            `SELECT m.*,
                    CASE WHEN a.alertId IS NOT NULL THEN 1 ELSE 0 END as hasAlerts
             FROM messages m
             LEFT JOIN alerts a ON m.messageId = a.messageId
             WHERE m.messageId = ?`,
            [messageId]
        );
        if (!result.rows[0]) return null;

        const msg = result.rows[0];
        const { hasAlerts: _hasAlerts, ...rest } = msg as MessageData & { hasAlerts: number };
        return {
            ...rest,
            origin: msg.origin as MessageOrigin,
            payloadParams: msg.payloadParams ? JSON.parse(msg.payloadParams as unknown as string) : null,
            payloadResult: msg.payloadResult ? JSON.parse(msg.payloadResult as unknown as string) : null,
            payloadError: msg.payloadError ? JSON.parse(msg.payloadError as unknown as string) : null,
            alerts: (msg as { hasAlerts: number }).hasAlerts === 1,
        };
    }

    async list(filter: MessageFilter, pagination: MessagePagination): Promise<MessageListResult> {
        const conditions: string[] = [];
        const params: SqliteValue[] = [];

        if (filter.origin) {
            conditions.push('m.origin = ?');
            params.push(filter.origin);
        }
        if (filter.userId) {
            conditions.push('m.userId = ?');
            params.push(filter.userId);
        }
        if (filter.source) {
            conditions.push('m.source = ?');
            params.push(filter.source);
        }
        if (filter.payloadToolkit) {
            conditions.push('m.payloadToolkit = ?');
            params.push(filter.payloadToolkit);
        }
        if (filter.payloadMethod) {
            conditions.push('m.payloadMethod = ?');
            params.push(filter.payloadMethod);
        }
        if (filter.payloadMessageId) {
            conditions.push('m.payloadMessageId = ?');
            params.push(filter.payloadMessageId);
        }
        if (filter.payloadToolName) {
            conditions.push('m.payloadToolName = ?');
            params.push(filter.payloadToolName);
        }
        if (filter.startTime) {
            conditions.push('m.timestamp >= ?');
            params.push(filter.startTime);
        }
        if (filter.endTime) {
            conditions.push('m.timestamp <= ?');
            params.push(filter.endTime);
        }
        if (pagination.cursor) {
            conditions.push(`m.messageId ${pagination.sort === 'asc' ? '>' : '<'} ?`);
            params.push(pagination.cursor);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const orderClause = `ORDER BY m.messageId ${pagination.sort}`;
        const limitClause = `LIMIT ?`;

        const queryParams = [...params, pagination.limit];

        const messages = await this.db.query<{
            messageId: number;
            timestamp: string;
            timestampResult?: string;
            userId: string;
            source: string | null;
            payloadToolkit: string;
            payloadToolVersion: string;
            origin: string;
            payloadMessageId: string;
            payloadMethod: string;
            payloadToolName: string;
            createdAt: string;
            hasAlerts: number;
            hasError: number;
        }>(
            `SELECT m.messageId, m.timestamp, m.timestampResult, m.userId, m.source,
                    m.payloadToolkit, m.payloadToolVersion, m.origin, m.payloadMessageId, m.payloadMethod,
                    m.payloadToolName, m.createdAt,
                    CASE WHEN EXISTS (SELECT 1 FROM alerts a WHERE a.messageId = m.messageId) THEN 1 ELSE 0 END as hasAlerts,
                    CASE WHEN m.payloadError IS NULL THEN 0 ELSE 1 END as hasError
             FROM messages m
             ${whereClause} ${orderClause} ${limitClause}`,
            queryParams
        );

        const messageItems = messages.rows.map((msg) => ({
            messageId: msg.messageId,
            timestamp: msg.timestamp,
            timestampResult: msg.timestampResult,
            userId: msg.userId,
            source: msg.source,
            payloadToolkit: msg.payloadToolkit,
            payloadToolVersion: msg.payloadToolVersion,
            origin: msg.origin as MessageOrigin,
            payloadMessageId: msg.payloadMessageId,
            payloadMethod: msg.payloadMethod,
            payloadToolName: msg.payloadToolName,
            hasError: msg.hasError === 1,
            createdAt: msg.createdAt,
            alerts: msg.hasAlerts === 1,
        }));

        const total = await this.db.query<{ count: number }>(
            `SELECT COUNT(*) as count FROM messages m ${whereClause}`,
            params
        );

        const lastMessage = messageItems[messageItems.length - 1];
        const hasMore = messageItems.length === pagination.limit;
        const nextCursor = hasMore ? lastMessage.messageId : null;

        return {
            messages: messageItems,
            pagination: {
                total: total.rows[0].count,
                remaining: total.rows[0].count - messageItems.length,
                hasMore,
                nextCursor,
                limit: pagination.limit,
                sort: pagination.sort,
            },
        };
    }

    async create(data: Omit<MessageData, 'messageId' | 'createdAt'>): Promise<MessageData> {
        await this.db.execute(
            `INSERT INTO messages (
                timestamp, origin, userId, source, payloadToolkit, payloadToolVersion,
                payloadMessageId, payloadMethod, payloadToolName, payloadParams, payloadResult, payloadError
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                data.timestamp,
                data.origin,
                data.userId,
                data.source ?? null,
                data.payloadToolkit ?? '',
                data.payloadToolVersion ?? '',
                data.payloadMessageId,
                data.payloadMethod,
                data.payloadToolName,
                data.payloadParams ? JSON.stringify(data.payloadParams) : null,
                data.payloadResult ? JSON.stringify(data.payloadResult) : null,
                data.payloadError ? JSON.stringify(data.payloadError) : null,
            ]
        );

        const result = await this.db.query<{ messageId: number }>('SELECT last_insert_rowid() as messageId');
        if (!result.rows[0]) {
            throw new Error('Failed to get last insert ID');
        }

        return this.findById(result.rows[0].messageId) as Promise<MessageData>;
    }

    async update(messageId: number, payload: Partial<MessageData>): Promise<MessageData> {
        const updates: string[] = [];
        const params: SqliteValue[] = [];

        if (payload.payloadResult !== undefined) {
            updates.push('payloadResult = ?');
            params.push(payload.payloadResult ? JSON.stringify(payload.payloadResult) : null);
        }
        if (payload.payloadError !== undefined) {
            updates.push('payloadError = ?');
            params.push(payload.payloadError ? JSON.stringify(payload.payloadError) : null);
        }
        if (payload.timestampResult !== undefined) {
            updates.push('timestampResult = ?');
            params.push(payload.timestampResult);
        }

        if (updates.length === 0) {
            return this.findById(messageId) as Promise<MessageData>;
        }

        await this.db.execute(`UPDATE messages SET ${updates.join(', ')} WHERE messageId = ?`, [...params, messageId]);

        return this.findById(messageId) as Promise<MessageData>;
    }

    async delete(messageId: number): Promise<boolean> {
        const result = await this.db.execute('DELETE FROM messages WHERE messageId = ?', [messageId]);
        return result.changes > 0;
    }

    private buildAnalyticsWhere(params: MessageAnalyticsFilter): { clause: string; queryParams: SqliteValue[] } {
        const conditions: string[] = [];
        const queryParams: SqliteValue[] = [];

        if (params.userId) {
            conditions.push('m.userId = ?');
            queryParams.push(params.userId);
        }
        if (params.source) {
            conditions.push('m.source = ?');
            queryParams.push(params.source);
        }
        if (params.payloadToolkit) {
            conditions.push('m.payloadToolkit = ?');
            queryParams.push(params.payloadToolkit);
        }
        if (params.payloadMethod) {
            conditions.push('m.payloadMethod = ?');
            queryParams.push(params.payloadMethod);
        }
        if (params.payloadToolName) {
            conditions.push('m.payloadToolName = ?');
            queryParams.push(params.payloadToolName);
        }
        if (params.startTime) {
            conditions.push('date(m.timestamp) >= date(?)');
            queryParams.push(params.startTime);
        }
        if (params.endTime) {
            conditions.push('date(m.timestamp) <= date(?)');
            queryParams.push(params.endTime);
        }

        const clause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        return { clause, queryParams };
    }

    private dimensionColumn(dimension: string): string {
        switch (dimension) {
            case 'payloadMethod':
                return 'm.payloadMethod';
            case 'payloadToolName':
                return 'm.payloadToolName';
            case 'userId':
                return 'm.userId';
            case 'source':
                return 'm.source';
            case 'payloadToolkit':
                return 'm.payloadToolkit';
            default:
                return `m.${dimension}`;
        }
    }

    async timeSeries(
        params: {
            dimension: string;
            timeUnit: 'hour' | 'day' | 'week' | 'month';
        } & MessageAnalyticsFilter
    ): Promise<Array<{ timestamp: string; counts: Record<string, number> }>> {
        const { clause: whereClause, queryParams } = this.buildAnalyticsWhere(params);

        let timeFormat: string;
        switch (params.timeUnit) {
            case 'hour':
                timeFormat = '%Y-%m-%d %H:00:00';
                break;
            case 'day':
                timeFormat = '%Y-%m-%d';
                break;
            case 'week':
                timeFormat = '%Y-%W';
                break;
            case 'month':
                timeFormat = '%Y-%m';
                break;
            default:
                timeFormat = '%Y-%m-%d';
        }

        const dimensionColumn = this.dimensionColumn(params.dimension);

        const query = `
            SELECT
                ${dimensionColumn} as dimension,
                strftime('${timeFormat}', m.timestamp) as timestamp,
                COUNT(*) as count
            FROM messages m
            ${whereClause}
            GROUP BY ${dimensionColumn}, strftime('${timeFormat}', m.timestamp)
            HAVING ${dimensionColumn} IS NOT NULL
            ORDER BY timestamp, ${dimensionColumn}
        `;

        const results = await this.db.query<{ dimension: string | number; timestamp: string; count: number }>(
            query,
            queryParams
        );

        const dataByTimestamp = results.rows.reduce(
            (acc: Record<string, Record<string, number>>, row: { dimension: string | number; timestamp: string; count: number }) => {
                if (!acc[row.timestamp]) {
                    acc[row.timestamp] = {};
                }
                acc[row.timestamp][String(row.dimension)] = row.count;
                return acc;
            },
            {}
        );

        return Object.entries(dataByTimestamp).map(([timestamp, counts]) => ({
            timestamp,
            counts,
        }));
    }

    async aggregate(
        params: {
            dimension: string;
        } & MessageAnalyticsFilter
    ): Promise<Array<{ value: string; count: number }>> {
        const { clause: whereClause, queryParams } = this.buildAnalyticsWhere(params);
        const dimensionColumn = this.dimensionColumn(params.dimension);

        const query = `
            SELECT
                ${dimensionColumn} as value,
                COUNT(*) as count
            FROM messages m
            ${whereClause}
            GROUP BY ${dimensionColumn}
            HAVING ${dimensionColumn} IS NOT NULL
            ORDER BY count DESC
        `;

        const results = await this.db.query(query, queryParams);
        return results.rows.map((row) => ({
            value: String(row.value),
            count: Number(row.count),
        }));
    }

    async getDimensionValues(
        params: {
            dimensions: string[];
        } & MessageAnalyticsFilter
    ): Promise<Record<string, string[]>> {
        const { clause: whereClause, queryParams } = this.buildAnalyticsWhere(params);

        const dimensionColumns = params.dimensions.map((dim) => this.dimensionColumn(dim));

        const queries = dimensionColumns.map((column) => {
            const tail = whereClause ? `${whereClause} AND ${column} IS NOT NULL` : `WHERE ${column} IS NOT NULL`;
            return `
            SELECT DISTINCT ${column} as value
            FROM messages m
            ${tail}
            ORDER BY ${column}
        `;
        });

        const results = await Promise.all(queries.map((query) => this.db.query(query, queryParams)));

        return params.dimensions.reduce((acc, dim, i) => {
            acc[dim] = results[i].rows.map((row) => String((row as { value: unknown }).value));
            return acc;
        }, {} as Record<string, string[]>);
    }

    async analyze(): Promise<void> {
        await this.db.analyze();
    }

    async deleteOldMessagesWithoutAlerts(beforeDate: string): Promise<{ deletedCount: number; preservedCount: number }> {
        const preservedCountResult = await this.db.query<{ preservedCount: number }>(
            `SELECT COUNT(DISTINCT m.messageId) as preservedCount
             FROM messages m
             WHERE m.createdAt < ? AND EXISTS (
                 SELECT 1 FROM alerts a WHERE a.messageId = m.messageId
             )`,
            [beforeDate]
        );

        const countResult = await this.db.query<{ deletedCount: number }>(
            `SELECT COUNT(*) as deletedCount
             FROM messages m
             WHERE m.createdAt < ? AND NOT EXISTS (
                 SELECT 1 FROM alerts a WHERE a.messageId = m.messageId
             )`,
            [beforeDate]
        );

        await this.db.execute(
            `DELETE FROM messages
             WHERE createdAt < ? AND NOT EXISTS (
                 SELECT 1 FROM alerts a WHERE a.messageId = messages.messageId
             )`,
            [beforeDate]
        );

        return {
            deletedCount: countResult.rows[0].deletedCount,
            preservedCount: preservedCountResult.rows[0].preservedCount,
        };
    }

    async countMessagesWithAlerts(beforeDate: string): Promise<number> {
        const result = await this.db.query<{ count: number }>(
            `SELECT COUNT(DISTINCT m.messageId) as count
             FROM messages m
             WHERE m.createdAt < ? AND EXISTS (
                 SELECT 1 FROM alerts a WHERE a.messageId = m.messageId
             )`,
            [beforeDate]
        );

        return result.rows[0].count;
    }
}
