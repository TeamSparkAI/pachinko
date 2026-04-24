import { NextRequest } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { MessageFilterService } from '@/lib/services/messageFilter';
import { validateJsonRpcMessage } from '@/lib/jsonrpc';
import { JsonResponse } from '@/lib/jsonResponse';
import { logger } from '@/lib/logging/server';
import { ModelFactory } from '@/lib/models';
import { MessageFilterContext } from '@/lib/types/messageFilterContext';

export type McpWebhookDirection = 'client' | 'server';

export interface McpWebhookRequestBody {
  sessionId?: string;
  message: unknown;
  /** Optional; when present and `message.method` is `tools/call`, must equal `message.params.name`. */
  toolName?: string;
  /** Ignored for routing; if sent, must match the endpoint direction. */
  origin?: string;
  /** Session and user context; `serverToken` must match the server registered for `serverId`. */
  context?: unknown;
}

function bearerMatchesConfiguredSecret(authHeader: string | null, secret: string): boolean {
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(authHeader ?? '', 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

function timingSafeStringEq(a: string, b: string): boolean {
  const x = Buffer.from(a, 'utf8');
  const y = Buffer.from(b, 'utf8');
  if (x.length !== y.length) {
    return false;
  }
  return timingSafeEqual(x, y);
}

function parseMessageFilterContext(raw: unknown): MessageFilterContext | Response {
  if (raw === undefined || raw === null || typeof raw !== 'object') {
    return JsonResponse.errorResponse(400, 'Missing or invalid context object in body');
  }
  const c = raw as Record<string, unknown>;

  if (typeof c.serverId !== 'number' || !Number.isInteger(c.serverId)) {
    return JsonResponse.errorResponse(400, 'context.serverId must be an integer');
  }
  if (typeof c.serverToken !== 'string' || !c.serverToken.trim()) {
    return JsonResponse.errorResponse(400, 'context.serverToken must be a non-empty string');
  }
  if (typeof c.user !== 'string') {
    return JsonResponse.errorResponse(400, 'context.user must be a string');
  }
  if (typeof c.sourceIp !== 'string') {
    return JsonResponse.errorResponse(400, 'context.sourceIp must be a string');
  }
  if (typeof c.serverName !== 'string') {
    return JsonResponse.errorResponse(400, 'context.serverName must be a string');
  }

  let clientId: number | null;
  if (c.clientId === null || c.clientId === undefined) {
    clientId = null;
  } else if (typeof c.clientId === 'number' && Number.isInteger(c.clientId)) {
    clientId = c.clientId;
  } else {
    return JsonResponse.errorResponse(400, 'context.clientId must be an integer or null');
  }

  return {
    serverId: c.serverId,
    serverToken: c.serverToken.trim(),
    user: c.user,
    sourceIp: c.sourceIp,
    serverName: c.serverName,
    clientId
  };
}

/**
 * Shared handler for MCP policy webhooks: `pre` = client→server, `post` = server→client.
 *
 * **Optional API secret:** When `filterApiBearerToken` is set, require `Authorization: Bearer <token>`.
 * When it is empty, the endpoint does not require that header.
 *
 * **Identity:** JSON `context` (user, sourceIp, serverId, serverToken, serverName, clientId) is required;
 * `serverToken` must match the stored token for `serverId`, and `serverName` must match the registered name.
 */
export async function handleMcpWebhookFilter(
  request: NextRequest,
  direction: McpWebhookDirection
): Promise<Response> {
  try {
    let body: McpWebhookRequestBody;
    try {
      body = (await request.json()) as McpWebhookRequestBody;
    } catch {
      return JsonResponse.errorResponse(400, 'Invalid JSON body');
    }

    const appSettingsModel = await ModelFactory.getInstance().getAppSettingsModel();
    const appSettings = await appSettingsModel.get();
    const configuredSecret = appSettings.filterApiBearerToken?.trim() ?? '';

    const authHeader = request.headers.get('authorization');

    if (configuredSecret) {
      if (!bearerMatchesConfiguredSecret(authHeader, configuredSecret)) {
        return JsonResponse.errorResponse(401, 'Unauthorized');
      }
    }

    const parsed = parseMessageFilterContext(body.context);
    if (parsed instanceof Response) {
      return parsed;
    }
    const ctx = parsed;

    const serverModel = await ModelFactory.getInstance().getServerModel();
    const server = await serverModel.findById(ctx.serverId);
    if (!server) {
      return JsonResponse.errorResponse(400, 'Unknown server');
    }
    if (!server.enabled) {
      return JsonResponse.errorResponse(403, `Server ${server.name} is disabled`);
    }
    if (!timingSafeStringEq(server.token, ctx.serverToken)) {
      return JsonResponse.errorResponse(401, 'Invalid server token');
    }
    if (!timingSafeStringEq(server.name, ctx.serverName)) {
      return JsonResponse.errorResponse(400, 'context.serverName does not match registered server name');
    }

    const payload: MessageFilterContext = {
      user: ctx.user,
      sourceIp: ctx.sourceIp,
      serverToken: server.token,
      serverName: server.name,
      serverId: server.serverId,
      clientId: ctx.clientId
    };

    const { message, toolName } = body;
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';

    if (message === undefined || message === null) {
      return JsonResponse.errorResponse(400, 'Missing message');
    }

    if (body.origin !== undefined && body.origin !== direction) {
      return JsonResponse.errorResponse(
        400,
        `Body origin must match this endpoint (${direction} for ${direction === 'client' ? 'pre' : 'post'}), or be omitted`
      );
    }

    if (toolName !== undefined) {
      if (typeof toolName !== 'string') {
        return JsonResponse.errorResponse(400, 'toolName must be a string when provided');
      }
      const msg = message as Record<string, unknown>;
      if (msg.method === 'tools/call') {
        const params = msg.params as Record<string, unknown> | undefined;
        const name = params?.name;
        if (typeof name !== 'string' || name !== toolName) {
          return JsonResponse.errorResponse(400, 'toolName must match message.params.name for tools/call');
        }
      }
    }

    const validatedMessage = validateJsonRpcMessage(direction, message);
    const result = await MessageFilterService.processMessage(payload, sessionId, validatedMessage);

    if (result.success) {
      return JsonResponse.payloadResponse('message', result.message);
    }
    return JsonResponse.errorResponse(400, result.error);
  } catch (error) {
    logger.error('Error in MCP webhook filter:', error);
    return JsonResponse.errorResponse(500, 'Internal server error');
  }
}
