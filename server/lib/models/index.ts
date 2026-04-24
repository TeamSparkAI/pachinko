import { DatabaseClient } from './sqlite/database';
import { SqliteMessageModel } from './sqlite/message';
import { SqlitePolicyModel } from './sqlite/policy';
import { SqliteAlertModel } from './sqlite/alert';
import { SqlitePolicyElementModel } from './sqlite/policyElement';
import { SqliteMessageActionModel } from './sqlite/messageAction';
import { initializeDatabase } from './sqlite/init';
import { DB_CONFIG } from './sqlite/config';
import { HostModel } from './host';
import { SqliteHostModel } from './sqlite/host';
import { SettingsModel } from './sqlite/settings';
import { AppSettingsModel } from './appSettings';
import { SqliteAppSettingsModel } from './sqlite/appSettings';
import { MessageModel } from './message';
import { PolicyModel } from './policy';
import { AlertModel } from './alert';
import { PolicyElementModel } from './policyElement';
import { MessageActionModel } from './messageAction';
import path from 'path';
import fs from 'fs/promises';
import { logger } from '@/lib/logging/server';
import { findStaticDir } from '@/lib/utils/static';
import { generateBase32Id } from '@/lib/utils/id';

declare global {
  var modelFactoryInstance: ModelFactory | null;
}

if (!global.modelFactoryInstance) {
  global.modelFactoryInstance = null;
}

export class ModelFactory {
    private db: DatabaseClient | null = null;
    private initialized = false;
    private messageModel: SqliteMessageModel | null = null;
    private policyModel: SqlitePolicyModel | null = null;
    private alertModel: SqliteAlertModel | null = null;
    private policyElementModel: SqlitePolicyElementModel | null = null;
    private messageActionModel: SqliteMessageActionModel | null = null;
    private hostModel: HostModel | null = null;
    private appSettingsModel: AppSettingsModel | null = null;

    private constructor() {}

    public static getInstance(): ModelFactory {
        if (!global.modelFactoryInstance) {
            logger.debug('Creating ModelFactory instance');
            global.modelFactoryInstance = new ModelFactory();
        }
        return global.modelFactoryInstance;
    }

    public async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        logger.debug('Initializing database...');
        try {
            const dbWasCreated = await initializeDatabase();
            this.db = await DatabaseClient.create(DB_CONFIG.getPath());
            this.messageModel = new SqliteMessageModel(this.db);
            this.policyModel = new SqlitePolicyModel(this.db);
            this.alertModel = new SqliteAlertModel(this.db);
            this.policyElementModel = new SqlitePolicyElementModel(this.db);
            this.messageActionModel = new SqliteMessageActionModel(this.db);
            if (dbWasCreated) {
                await this.onDatabaseCreated();
            }
            this.initialized = true;
            logger.debug('Database initialized');
        } catch (error) {
            logger.error('Error initializing ModelFactory:', error);
            throw error;
        }
    }

    public async getMessageModel(): Promise<MessageModel> {
        if (!this.initialized) {
            await this.initialize();
        }
        if (!this.messageModel) {
            throw new Error('Message model not initialized');
        }
        return this.messageModel;
    }

    public async getPolicyModel(): Promise<PolicyModel> {
        if (!this.initialized) {
            await this.initialize();
        }
        if (!this.policyModel) {
            throw new Error('Policy model not initialized');
        }
        return this.policyModel;
    }

    public async getAlertModel(): Promise<AlertModel> {
        if (!this.initialized) {
            await this.initialize();
        }
        if (!this.alertModel) {
            throw new Error('Alert model not initialized');
        }
        return this.alertModel;
    }

    public async getPolicyElementModel(): Promise<PolicyElementModel> {
        if (!this.initialized) {
            await this.initialize();
        }
        if (!this.policyElementModel) {
            throw new Error('Policy element model not initialized');
        }
        return this.policyElementModel;
    }

    public async getMessageActionModel(): Promise<MessageActionModel> {
        if (!this.initialized) {
            await this.initialize();
        }
        if (!this.messageActionModel) {
            throw new Error('Message action model not initialized');
        }
        return this.messageActionModel;
    }

    public async getHostModel(): Promise<HostModel> {
        if (!this.initialized) {
            await this.initialize();
        }
        if (!this.hostModel) {
            const settings = new SettingsModel(this.db!);
            this.hostModel = new SqliteHostModel(settings);
        }
        return this.hostModel;
    }

    public async getAppSettingsModel(): Promise<AppSettingsModel> {
        if (!this.initialized) {
            await this.initialize();
        }
        if (!this.appSettingsModel) {
            const settings = new SettingsModel(this.db!);
            this.appSettingsModel = new SqliteAppSettingsModel(settings);
        }
        if (!this.appSettingsModel) {
            throw new Error('App settings model not initialized');
        }
        return this.appSettingsModel;
    }

    public async analyze(): Promise<void> {
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        await this.db.analyze();
    }

    private async onDatabaseCreated() {
        const policyModel = await this.getPolicyModel();
        const policyElementModel = await this.getPolicyElementModel();
        const dataDir = findStaticDir('data');
        const policiesPath = path.join(dataDir, 'policies.json');
        const json = await fs.readFile(policiesPath, 'utf-8');
        const policies = JSON.parse(json);

        const elements = await policyElementModel.list();
        const elementMap = new Map<string, number>();
        elements.forEach((element) => {
            elementMap.set(element.className, element.configId);
        });

        for (const policy of policies) {
            const conditions =
                policy.conditions?.map((condition: { class: string; instanceId?: string; name: string; notes?: string; params?: unknown }) => {
                    const configId = elementMap.get(condition.class);
                    if (!configId) {
                        throw new Error(`Unknown condition class: ${condition.class}`);
                    }
                    return {
                        elementClassName: condition.class,
                        elementConfigId: configId,
                        instanceId: generateBase32Id(),
                        name: condition.name,
                        notes: condition.notes,
                        params: condition.params,
                    };
                }) || [];

            const actions =
                policy.actions?.map((action: { class: string; instanceId?: string; params?: unknown }) => {
                    const configId = elementMap.get(action.class);
                    if (!configId) {
                        throw new Error(`Unknown action class: ${action.class}`);
                    }
                    return {
                        elementClassName: action.class,
                        elementConfigId: configId,
                        instanceId: generateBase32Id(),
                        params: action.params,
                    };
                }) || [];

            await policyModel.create({
                name: policy.name,
                description: policy.description,
                severity: policy.severity,
                origin: policy.origin,
                methods: policy.methods,
                conditions,
                actions,
                enabled: policy.enabled,
            });
        }
        logger.debug('Default policies imported.');
    }
}
