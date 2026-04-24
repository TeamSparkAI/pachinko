export interface AppSettingsData {
    /** When non-empty, MCP filter webhooks require Authorization: Bearer <this value>. */
    filterApiBearerToken: string;
    messageRetentionDays: number;
    alertRetentionDays: number;
}
