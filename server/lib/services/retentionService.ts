import { ModelFactory } from '../models';

export interface RetentionStats {
    messagesDeleted: number;
    alertsDeleted: number;
    messagesPreserved: number;
    alertsPreserved: number;
    errors: string[];
}

export class RetentionService {
    private static instance: RetentionService;

    private constructor() {}

    static getInstance(): RetentionService {
        if (!RetentionService.instance) {
            RetentionService.instance = new RetentionService();
        }
        return RetentionService.instance;
    }

    /**
     * Enforce retention policies for both alerts and messages
     * 
     * Process order:
     * 1. Delete old alerts first (respecting alert retention period)
     * 2. Delete old messages that don't have any remaining alerts
     * 
     * This ensures that messages with alerts are preserved until the alert retention period expires
     */
    async enforceRetention(tenantId: number): Promise<RetentionStats> {
        const stats: RetentionStats = {
            messagesDeleted: 0,
            alertsDeleted: 0,
            messagesPreserved: 0,
            alertsPreserved: 0,
            errors: []
        };

        try {
            const appSettings = await ModelFactory.getInstance().getAppSettingsModel(tenantId);
            const settings = await appSettings.get();
            
            const alertModel = await ModelFactory.getInstance().getAlertModel(tenantId);
            const messageModel = await ModelFactory.getInstance().getMessageModel(tenantId);

            // Step 1: Delete old alerts
            const alertRetentionDate = new Date();
            alertRetentionDate.setDate(alertRetentionDate.getDate() - settings.alertRetentionDays);
            
            const alertDeletionResult = await alertModel.deleteOldAlerts(alertRetentionDate.toISOString());
            stats.alertsDeleted = alertDeletionResult.deletedCount;

            // Step 2: Delete old messages that don't have any alerts
            const messageRetentionDate = new Date();
            messageRetentionDate.setDate(messageRetentionDate.getDate() - settings.messageRetentionDays);

            const messageDeletionResult = await messageModel.deleteOldMessagesWithoutAlerts(messageRetentionDate.toISOString());
            stats.messagesDeleted = messageDeletionResult.deletedCount;
            stats.messagesPreserved = messageDeletionResult.preservedCount;

        } catch (error) {
            stats.errors.push(`Retention enforcement failed: ${error}`);
        }

        return stats;
    }

    /**
     * Get retention statistics without performing cleanup
     */
    async getRetentionStats(tenantId: number): Promise<{
        totalMessages: number;
        totalAlerts: number;
        oldMessages: number;
        oldAlerts: number;
        messagesWithAlerts: number;
    }> {
        try {
            const appSettings = await ModelFactory.getInstance().getAppSettingsModel(tenantId);
            const settings = await appSettings.get();
            
            const alertModel = await ModelFactory.getInstance().getAlertModel(tenantId);
            const messageModel = await ModelFactory.getInstance().getMessageModel(tenantId);

            const alertRetentionDate = new Date();
            alertRetentionDate.setDate(alertRetentionDate.getDate() - settings.alertRetentionDays);
            
            const messageRetentionDate = new Date();
            messageRetentionDate.setDate(messageRetentionDate.getDate() - settings.messageRetentionDays);

            // Get counts using efficient queries
            const totalAlerts = await alertModel.list({}, { sort: 'desc', limit: 1, cursor: undefined });
            const totalMessages = await messageModel.list({}, { sort: 'desc', limit: 1, cursor: undefined });
            
            const oldAlerts = await alertModel.list(
                { endTime: alertRetentionDate.toISOString() },
                { sort: 'desc', limit: 1, cursor: undefined }
            );
            
            const oldMessages = await messageModel.list(
                { endTime: messageRetentionDate.toISOString() },
                { sort: 'desc', limit: 1, cursor: undefined }
            );

            // Count messages with alerts using efficient query
            const messagesWithAlertsCount = await messageModel.countMessagesWithAlerts(messageRetentionDate.toISOString());

            return {
                totalMessages: totalMessages.pagination.total,
                totalAlerts: totalAlerts.pagination.total,
                oldMessages: oldMessages.pagination.total,
                oldAlerts: oldAlerts.pagination.total,
                messagesWithAlerts: messagesWithAlertsCount
            };
        } catch (error) {
            throw new Error(`Failed to get retention stats: ${error}`);
        }
    }
} 