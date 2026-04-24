export interface AppSettingsData {
    /** When non-empty, MCP filter webhooks require Authorization: Bearer <this value>. */
    filterApiBearerToken: string;
    messageRetentionDays: number;
    alertRetentionDays: number;
    /**
     * Public base URL for this server (e.g. https://pachinko.example.com).
     * Used to show Arcade webhook URLs in Settings. Empty = infer from the current HTTP request (host/port).
     */
    externalBaseUrl: string;
}

/** GET /api/v1/appSettings — persisted settings plus inferred public base for display. */
export interface AppSettingsApiResponse extends AppSettingsData {
    resolvedPublicBaseUrl: string;
}
