import { DatabaseClient } from './database';
import { PolicyElementModel } from '../policyElement';
import { PolicyElementData, PolicyElementCreateData, PolicyElementUpdateData, PolicyElementFilter } from '../types/policyElement';
import { logger } from '@/lib/logging/server';

export class SqlitePolicyElementModel extends PolicyElementModel {
    private db: DatabaseClient;
    private readonly tenantId: number;

    constructor(db: DatabaseClient, tenantId: number) {
        super();
        this.db = db;
        this.tenantId = tenantId;
    }

    async findById(configId: number): Promise<PolicyElementData | null> {
        const result = await this.db.queryOne<PolicyElementData & { config: string }>(
            'SELECT * FROM policy_elements WHERE configId = ? AND tenantId = ?',
            [configId, this.tenantId]
        );

        if (!result) {
            return null;
        }

        // Deserialize JSON fields
        return {
            ...result,
            config: result.config ? JSON.parse(result.config) : null
        };
    }

    async create(data: PolicyElementCreateData): Promise<PolicyElementData> {
        const configJson = data.config ? JSON.stringify(data.config) : null;
        const enabled = data.enabled ?? true;

        const result = await this.db.queryOne<PolicyElementData & { config: string }>(
            `INSERT INTO policy_elements (tenantId, className, elementType, label, config, enabled) 
             VALUES (?, ?, ?, ?, ?, ?) 
             RETURNING *`,
            [this.tenantId, data.className, data.elementType, data.label || null, configJson, enabled]
        );

        if (!result) {
            throw new Error('Failed to create policy element');
        }

        // Deserialize JSON fields
        return {
            ...result,
            config: result.config ? JSON.parse(result.config) : null
        };
    }

    async update(configId: number, data: PolicyElementUpdateData): Promise<PolicyElementData> {
        const updates: string[] = [];
        const params: any[] = [];

        if (data.label !== undefined) {
            updates.push('label = ?');
            params.push(data.label || null);
        }

        if (data.config !== undefined) {
            updates.push('config = ?');
            params.push(data.config ? JSON.stringify(data.config) : null);
        }

        if (data.enabled !== undefined) {
            updates.push('enabled = ?');
            params.push(data.enabled);
        }

        if (updates.length === 0) {
            throw new Error('No fields to update');
        }

        params.push(configId, this.tenantId);

        const result = await this.db.queryOne<PolicyElementData & { config: string }>(
            `UPDATE policy_elements 
             SET ${updates.join(', ')} 
             WHERE configId = ? AND tenantId = ?
             RETURNING *`,
            params
        );

        if (!result) {
            throw new Error(`Policy element with configId ${configId} not found`);
        }

        // Deserialize JSON fields
        return {
            ...result,
            config: result.config ? JSON.parse(result.config) : null
        };
    }

    async delete(configId: number): Promise<boolean> {
        const result = await this.db.execute('DELETE FROM policy_elements WHERE configId = ? AND tenantId = ?', [
            configId,
            this.tenantId,
        ]);

        return result.changes > 0;
    }

    async list(filter?: PolicyElementFilter): Promise<PolicyElementData[]> {
        let query = 'SELECT * FROM policy_elements';
        const params: any[] = [];
        const conditions: string[] = ['tenantId = ?'];
        params.push(this.tenantId);

        if (filter) {
            if (filter.elementType !== undefined) {
                conditions.push('elementType = ?');
                params.push(filter.elementType);
            }

            if (filter.enabled !== undefined) {
                conditions.push('enabled = ?');
                params.push(filter.enabled);
            }
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY className, elementType';

        const result = await this.db.query<PolicyElementData & { config: string }>(query, params);

        // Deserialize JSON fields
        return result.rows.map(row => ({
            ...row,
            config: row.config ? JSON.parse(row.config) : null
        }));
    }

    async findByClassName(className: string): Promise<PolicyElementData[]> {
        const result = await this.db.query<PolicyElementData & { config: string }>(
            'SELECT * FROM policy_elements WHERE className = ? AND tenantId = ? ORDER BY elementType',
            [className, this.tenantId]
        );

        // Deserialize JSON fields
        return result.rows.map(row => ({
            ...row,
            config: row.config ? JSON.parse(row.config) : null
        }));
    }
}
