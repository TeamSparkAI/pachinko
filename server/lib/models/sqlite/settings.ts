import { DatabaseClient } from './database';

interface SettingsRow {
    settingsId: number;
    tenantId: number;
    category: string;
    config: string;  // Stored as JSON string in DB
    description?: string;
    createdAt: string;
    updatedAt: string;
}

export interface SettingsData {
    settingsId: number;
    tenantId: number;
    category: string;
    config: Record<string, any>;
    description?: string;
    createdAt: string;
    updatedAt: string;
}

export class SettingsModel {
    constructor(
        private db: DatabaseClient,
        readonly tenantId: number
    ) {}

    async findByCategory(category: string): Promise<SettingsData | null> {
        const result = await this.db.query<SettingsRow>(
            'SELECT * FROM settings WHERE category = ? AND tenantId = ?',
            [category, this.tenantId]
        );
        if (!result.rows[0]) {
            return null;
        }
        const row = result.rows[0];
        return {
            ...row,
            config: JSON.parse(row.config)
        };
    }

    async create(data: Omit<SettingsData, 'settingsId' | 'createdAt' | 'updatedAt' | 'tenantId'>): Promise<SettingsData> {
        await this.db.execute(
            `INSERT INTO settings (tenantId, category, config, description)
             VALUES (?, ?, ?, ?)`,
            [this.tenantId, data.category, JSON.stringify(data.config), data.description || null]
        );

        const result = await this.db.query<{ settingsId: number }>('SELECT last_insert_rowid() as settingsId');
        if (!result.rows[0]) {
            throw new Error('Failed to get last insert ID');
        }

        return this.findByCategory(data.category) as Promise<SettingsData>;
    }

    async update(category: string, data: Partial<Omit<SettingsData, 'settingsId' | 'createdAt' | 'updatedAt'>>): Promise<SettingsData> {
        const updates: string[] = [];
        const params: any[] = [];

        Object.entries(data).forEach(([key, value]) => {
            if (key === 'config') {
                updates.push(`${key} = ?`);
                params.push(JSON.stringify(value));
            } else {
                updates.push(`${key} = ?`);
                params.push(value);
            }
        });

        if (updates.length === 0) {
            return this.findByCategory(category) as Promise<SettingsData>;
        }

        await this.db.execute(
            `UPDATE settings SET ${updates.join(', ')} WHERE category = ? AND tenantId = ?`,
            [...params, category, this.tenantId]
        );

        return this.findByCategory(category) as Promise<SettingsData>;
    }

    async delete(category: string): Promise<void> {
        await this.db.execute('DELETE FROM settings WHERE category = ? AND tenantId = ?', [category, this.tenantId]);
    }

    async list(): Promise<SettingsData[]> {
        const result = await this.db.query<SettingsData>(
            'SELECT * FROM settings WHERE tenantId = ? ORDER BY category',
            [this.tenantId]
        );
        return result.rows;
    }
} 