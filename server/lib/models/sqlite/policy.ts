import { DatabaseClient } from './database';
import { PolicyModel } from '../policy';
import { PolicyData } from '../types/policy';

type PolicyRow = PolicyData & { conditions: string; actions: string };

function rowToPolicy(policy: PolicyRow): PolicyData {
    return {
        ...policy,
        matchToolkit: policy.matchToolkit ?? undefined,
        matchTool: policy.matchTool ?? undefined,
        conditions: policy.conditions ? JSON.parse(policy.conditions) : [],
        actions: policy.actions ? JSON.parse(policy.actions) : [],
    };
}

export class SqlitePolicyModel extends PolicyModel {
    private db: DatabaseClient;
    private readonly tenantId: number;

    constructor(db: DatabaseClient, tenantId: number) {
        super();
        this.db = db;
        this.tenantId = tenantId;
    }

    async findById(policyId: number): Promise<PolicyData | null> {
        const result = await this.db.query<PolicyRow>(
            'SELECT * FROM policies WHERE policyId = ? AND tenantId = ?',
            [policyId, this.tenantId]
        );
        if (!result.rows[0]) return null;

        return rowToPolicy(result.rows[0]);
    }

    async list(): Promise<PolicyData[]> {
        const result = await this.db.query<PolicyRow>(
            'SELECT * FROM policies WHERE tenantId = ? ORDER BY name',
            [this.tenantId]
        );

        return result.rows.map((policy) => rowToPolicy(policy));
    }

    async getByIds(policyIds: number[]): Promise<PolicyData[]> {
        if (policyIds.length === 0) return [];

        const placeholders = policyIds.map(() => '?').join(',');
        const result = await this.db.query<PolicyRow>(
            `SELECT * FROM policies WHERE tenantId = ? AND policyId IN (${placeholders}) ORDER BY name`,
            [this.tenantId, ...policyIds]
        );

        return result.rows.map((policy) => rowToPolicy(policy));
    }

    async create(data: Omit<PolicyData, 'policyId' | 'createdAt' | 'updatedAt' | 'tenantId'>): Promise<PolicyData> {
        await this.db.execute(
            `INSERT INTO policies (
                tenantId, name, description, severity, origin, matchToolkit, matchTool, conditions, actions, enabled
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                this.tenantId,
                data.name,
                data.description || null,
                data.severity,
                data.origin,
                data.matchToolkit?.trim() || null,
                data.matchTool?.trim() || null,
                data.conditions ? JSON.stringify(data.conditions) : null,
                data.actions ? JSON.stringify(data.actions) : null,
                data.enabled ? 1 : 0,
            ]
        );

        const result = await this.db.query<{ policyId: number }>('SELECT last_insert_rowid() as policyId');
        if (!result.rows[0]) {
            throw new Error('Failed to get last insert ID');
        }

        return this.findById(result.rows[0].policyId) as Promise<PolicyData>;
    }

    async update(policyId: number, data: Partial<PolicyData>): Promise<PolicyData> {
        const updates: string[] = [];
        const params: any[] = [];

        Object.entries(data).forEach(([key, value]) => {
            if (key === 'policyId' || key === 'createdAt' || key === 'updatedAt') return;
            if (key === 'conditions') {
                updates.push(`${key} = ?`);
                params.push(value ? JSON.stringify(value) : null);
            } else if (key === 'actions') {
                updates.push(`${key} = ?`);
                params.push(value ? JSON.stringify(value) : null);
            } else if (key === 'enabled') {
                updates.push(`${key} = ?`);
                params.push(value ? 1 : 0);
            } else if (key === 'matchToolkit' || key === 'matchTool') {
                updates.push(`${key} = ?`);
                const s = typeof value === 'string' ? value.trim() : '';
                params.push(s || null);
            } else {
                updates.push(`${key} = ?`);
                params.push(value);
            }
        });

        if (updates.length === 0) {
            return this.findById(policyId) as Promise<PolicyData>;
        }

        await this.db.execute(
            `UPDATE policies SET ${updates.join(', ')} WHERE policyId = ? AND tenantId = ?`,
            [...params, policyId, this.tenantId]
        );

        return this.findById(policyId) as Promise<PolicyData>;
    }

    async delete(policyId: number): Promise<boolean> {
        const result = await this.db.execute('DELETE FROM policies WHERE policyId = ? AND tenantId = ?', [
            policyId,
            this.tenantId,
        ]);
        return result.changes > 0;
    }
}
