import { DatabaseClient } from './database';
import { SqliteMessageModel } from './message';
import { SqlitePolicyModel } from './policy';
import { SqliteAlertModel } from './alert';
import { SqlitePolicyElementModel } from './policyElement';
import { SqliteMessageActionModel } from './messageAction';
import { initializeDatabase } from './init';
import { DB_CONFIG } from './config';
import { SettingsModel } from './settings';
import { SqliteAppSettingsModel } from './appSettings';
import type { IModelFactory } from '../modelFactory';
import type { MessageModel } from '../message';
import type { PolicyModel } from '../policy';
import type { AlertModel } from '../alert';
import type { PolicyElementModel } from '../policyElement';
import type { MessageActionModel } from '../messageAction';
import type { AppSettingsModel } from '../appSettings';
import path from 'path';
import fs from 'fs/promises';
import { logger } from '@/lib/logging/server';
import { findStaticDir } from '@/lib/utils/static';
import { generateBase32Id } from '@/lib/utils/id';
import { DEFAULT_TENANT_ID } from '@/lib/auth/constants';

declare global {
  var sqliteModelFactoryInstance: SqliteModelFactory | null;
}

if (!global.sqliteModelFactoryInstance) {
  global.sqliteModelFactoryInstance = null;
}

export class SqliteModelFactory implements IModelFactory {
  private db: DatabaseClient | null = null;
  private initialized = false;

  private constructor() {}

  public static getInstance(): SqliteModelFactory {
    if (!global.sqliteModelFactoryInstance) {
      logger.debug('Creating SqliteModelFactory instance');
      global.sqliteModelFactoryInstance = new SqliteModelFactory();
    }
    return global.sqliteModelFactoryInstance;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    logger.debug('Initializing database...');
    try {
      const dbWasCreated = await initializeDatabase();
      this.db = await DatabaseClient.create(DB_CONFIG.getPath());
      if (dbWasCreated) {
        await this.onDatabaseCreated();
      }
      this.initialized = true;
      logger.debug('Database initialized');
    } catch (error) {
      logger.error('Error initializing SqliteModelFactory:', error);
      throw error;
    }
  }

  public async getMessageModel(tenantId: number = DEFAULT_TENANT_ID): Promise<MessageModel> {
    if (!this.initialized) {
      await this.initialize();
    }
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return new SqliteMessageModel(this.db, tenantId);
  }

  public async getPolicyModel(tenantId: number = DEFAULT_TENANT_ID): Promise<PolicyModel> {
    if (!this.initialized) {
      await this.initialize();
    }
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return new SqlitePolicyModel(this.db, tenantId);
  }

  public async getAlertModel(tenantId: number = DEFAULT_TENANT_ID): Promise<AlertModel> {
    if (!this.initialized) {
      await this.initialize();
    }
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return new SqliteAlertModel(this.db, tenantId);
  }

  public async getPolicyElementModel(tenantId: number = DEFAULT_TENANT_ID): Promise<PolicyElementModel> {
    if (!this.initialized) {
      await this.initialize();
    }
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return new SqlitePolicyElementModel(this.db, tenantId);
  }

  public async getMessageActionModel(tenantId: number = DEFAULT_TENANT_ID): Promise<MessageActionModel> {
    if (!this.initialized) {
      await this.initialize();
    }
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return new SqliteMessageActionModel(this.db, tenantId);
  }

  public async getAppSettingsModel(tenantId: number = DEFAULT_TENANT_ID): Promise<AppSettingsModel> {
    if (!this.initialized) {
      await this.initialize();
    }
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    const settings = new SettingsModel(this.db, tenantId);
    return new SqliteAppSettingsModel(settings);
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
        policy.conditions?.map(
          (condition: { class: string; instanceId?: string; name: string; notes?: string; params?: unknown }) => {
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
          }
        ) || [];

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
        matchToolkit: policy.matchToolkit,
        matchTool: policy.matchTool,
        conditions,
        actions,
        enabled: policy.enabled,
      });
    }
    logger.debug('Default policies imported.');
  }
}
