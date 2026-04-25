import { MessageActionModel } from '../messageAction';
import { DatabaseClient } from '../sqlite/database';
import { MessageActionData, MessageActionsData } from '../types/messageAction';
import { MessageOrigin } from '@/lib/jsonrpc';

export class SqliteMessageActionModel extends MessageActionModel {
    private db: DatabaseClient;
    private readonly tenantId: number;

    constructor(db: DatabaseClient, tenantId: number) {
        super();
        this.db = db;
        this.tenantId = tenantId;
    }

    async findById(messageActionId: number): Promise<MessageActionData | null> {
        const result = await this.db.queryOne<MessageActionData & { action: string; actionEvents: string }>(
            'SELECT messageActionId, messageId, policyId, origin, severity, action, actionEvents, timestamp, createdAt FROM message_actions WHERE messageActionId = ? AND tenantId = ?',
            [messageActionId, this.tenantId]
        );

        if (!result) {
            return null;
        }

        return {
            ...result,
            tenantId: this.tenantId,
            action: result.action ? JSON.parse(result.action as string) : null,
            actionEvents: result.actionEvents ? JSON.parse(result.actionEvents as string) : [],
        };
    }

    async findByMessageId(messageId: number): Promise<MessageActionsData | null> {
        const result = await this.db.query<MessageActionData & { action: string; actionEvents: string }>(
            'SELECT messageActionId, messageId, policyId, origin, severity, action, actionEvents, timestamp, createdAt FROM message_actions WHERE messageId = ? AND tenantId = ?',
            [messageId, this.tenantId]
        );
        
        if (result.rows.length === 0) {
            return null;
        }

        const actions = result.rows.map((row) => ({
            tenantId: this.tenantId,
            messageActionId: row.messageActionId,
            messageId: row.messageId,
            policyId: row.policyId,
            origin: row.origin as MessageOrigin,
            severity: row.severity,
            action: row.action ? JSON.parse(row.action as string) : null,
            actionEvents: row.actionEvents ? JSON.parse(row.actionEvents as string) : [],
            timestamp: row.timestamp,
            createdAt: row.createdAt,
        }));

        return {
            messageId,
            actions
        };
    }

    async findByMessageIdAndOrigin(messageId: number, origin: MessageOrigin): Promise<MessageActionData[]> {
        const result = await this.db.query<MessageActionData & { action: string; actionEvents: string }>(
            'SELECT messageActionId, messageId, policyId, origin, severity, action, actionEvents, timestamp, createdAt FROM message_actions WHERE messageId = ? AND origin = ? AND tenantId = ?',
            [messageId, origin, this.tenantId]
        );
        
        return result.rows.map(row => ({
            tenantId: this.tenantId,
            messageActionId: row.messageActionId,
            messageId: row.messageId,
            policyId: row.policyId,
            origin: row.origin as MessageOrigin,
            severity: row.severity,
            action: row.action ? JSON.parse(row.action) : null,
            actionEvents: row.actionEvents ? JSON.parse(row.actionEvents) : [],
            timestamp: row.timestamp,
            createdAt: row.createdAt
        }));
    }

    async findByAlertId(alertId: number): Promise<MessageActionData[]> {
        const result = await this.db.query<MessageActionData & { action: string; actionEvents: string }>(
            'SELECT messageActionId, messageId, policyId, origin, severity, action, actionEvents, timestamp, createdAt FROM message_actions WHERE actionEvents LIKE ? AND tenantId = ?',
            [`%${alertId}%`, this.tenantId]
        );
        
        return result.rows.map(row => ({
            tenantId: this.tenantId,
            messageActionId: row.messageActionId,
            messageId: row.messageId,
            policyId: row.policyId,
            origin: row.origin as MessageOrigin,
            severity: row.severity,
            action: row.action ? JSON.parse(row.action) : null,
            actionEvents: row.actionEvents ? JSON.parse(row.actionEvents) : [],
            timestamp: row.timestamp,
            createdAt: row.createdAt
        }));
    }

    async create(data: Omit<MessageActionData, "createdAt" | "messageActionId" | "tenantId">): Promise<MessageActionData> {
        const actionJson = JSON.stringify(data.action);
        const actionEventsJson = JSON.stringify(data.actionEvents);
        const result = await this.db.execute(
            'INSERT INTO message_actions (tenantId, messageId, policyId, origin, severity, action, actionEvents, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [this.tenantId, data.messageId, data.policyId, data.origin, data.severity, actionJson, actionEventsJson, data.timestamp]
        );

        // Get the last inserted ID
        const messageActionId = result.lastID;
        if (typeof messageActionId !== 'number') {
            throw new Error('Failed to get last inserted ID');
        }

        // After creating, fetch the full record
        const createdRecord = await this.findById(messageActionId);
        if (!createdRecord) {
            throw new Error(`Failed to retrieve created message action with ID ${messageActionId}`);
        }
        return createdRecord;
    }
}