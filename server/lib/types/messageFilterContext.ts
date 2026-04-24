/**
 * Context passed into the message filter / policy pipeline.
 *
 * Arcade Engine webhooks do not use MCP servers: the handler supplies a **synthetic** context
 * (`serverName` / `serverId` / `serverToken`) so persistence and policies keep working.
 */
export interface MessageFilterContext {
  user: string;
  sourceIp: string;
  serverToken: string;
  serverName: string;
  serverId: number;
  clientId: number | null;
}
