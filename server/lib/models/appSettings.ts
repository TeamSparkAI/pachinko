import { SettingsModel } from './sqlite/settings';
import { logger } from '@/lib/logging/server';
import { AppSettingsData } from './types/appSettings';

export abstract class AppSettingsModel {
    protected constructor(protected settings: SettingsModel) {}

    protected static readonly CATEGORY = 'app';
    protected static readonly DEFAULT_CONFIG: AppSettingsData = {
        filterApiBearerToken: '',
        messageRetentionDays: 90,
        alertRetentionDays: 90
    };

    /**
     * Get the current app settings configuration
     */
    async get(): Promise<AppSettingsData> {
        const settings = await this.settings.findByCategory(AppSettingsModel.CATEGORY);
        if (!settings) {
            return AppSettingsModel.DEFAULT_CONFIG;
        }

        const config = settings.config;
        const normalized = this.normalizeStoredConfig(config);
        if (!normalized) {
            logger.error('Invalid app settings data shape:', config);
            return AppSettingsModel.DEFAULT_CONFIG;
        }

        return normalized;
    }

    /**
     * Normalize persisted JSON (supports legacy requireClientToken / strictServerAccess keys).
     */
    private normalizeStoredConfig(config: unknown): AppSettingsData | null {
        if (!config || typeof config !== 'object') return null;
        const data = config as Record<string, unknown>;
        if (typeof data.messageRetentionDays !== 'number' || typeof data.alertRetentionDays !== 'number') {
            return null;
        }
        const filterApiBearerToken =
            typeof data.filterApiBearerToken === 'string' ? data.filterApiBearerToken : '';
        return {
            filterApiBearerToken,
            messageRetentionDays: data.messageRetentionDays,
            alertRetentionDays: data.alertRetentionDays,
        };
    }

    /**
     * Set the app settings configuration
     */
    async set(config: AppSettingsData): Promise<void> {
        this.validate(config);
        const settings = await this.settings.findByCategory(AppSettingsModel.CATEGORY);
        
        if (settings) {
            await this.settings.update(AppSettingsModel.CATEGORY, {
                config,
                description: 'Application settings configuration'
            });
        } else {
            await this.settings.create({
                category: AppSettingsModel.CATEGORY,
                config,
                description: 'Application settings configuration'
            });
        }
    }

    /**
     * Validate app settings configuration
     */
    protected validate(config: AppSettingsData): void {
        if (!this.isValidAppSettingsData(config)) {
            throw new Error('Invalid app settings configuration shape');
        }
        if (typeof config.filterApiBearerToken !== 'string') {
            throw new Error('filterApiBearerToken must be a string');
        }
        if (typeof config.messageRetentionDays !== 'number' || config.messageRetentionDays < 1) {
            throw new Error('messageRetentionDays must be a positive number');
        }
        if (typeof config.alertRetentionDays !== 'number' || config.alertRetentionDays < 1) {
            throw new Error('alertRetentionDays must be a positive number');
        }
    }

    /**
     * Check if the config matches the AppSettingsData shape
     */
    private isValidAppSettingsData(config: unknown): config is AppSettingsData {
        if (!config || typeof config !== 'object') return false;
        const data = config as Record<string, unknown>;
        return (
            typeof data.filterApiBearerToken === 'string' &&
            typeof data.messageRetentionDays === 'number' &&
            typeof data.alertRetentionDays === 'number'
        );
    }
}
