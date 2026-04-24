/**
 * Context passed into the message filter / policy pipeline (e.g. Arcade Engine webhooks).
 */
export interface MessageFilterContext {
    user: string;
    /** Ingest source label stored on `messages.source` (e.g. `arcade`). */
    source?: string;
    /** Arcade `tool.toolkit` (or empty for non-Arcade replay). */
    payloadToolkit?: string;
    /** Arcade `tool.version` (or empty). */
    payloadToolVersion?: string;
}
