/**
 * Caller-supplied context for MCP filter webhooks (plain JSON, no proxy JWT).
 * The server token is verified against the registered server for `serverId`.
 */
export interface MessageFilterContext {
  user: string;
  sourceIp: string;
  serverToken: string;
  serverName: string;
  serverId: number;
  clientId: number | null;
}
