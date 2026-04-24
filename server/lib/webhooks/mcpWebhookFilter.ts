import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { MessageFilterService } from '@/lib/services/messageFilter';
import { JsonRpcValidationError, validateJsonRpcMessage } from '@/lib/jsonrpc';
import { JsonResponse } from '@/lib/jsonResponse';
import { logger } from '@/lib/logging/server';
import { ModelFactory } from '@/lib/models';
import { MessageFilterContext } from '@/lib/types/messageFilterContext';
import {
  isPlainJsonObject,
  isArcadeEnginePrePayload,
  isArcadeEnginePostPayload,
  isArcadeEnginePostPayloadWithoutInputs,
  arcadePreToJsonRpcRequest,
  arcadePostFailureToJsonRpc,
  arcadePostOutputToResultShape,
  arcadePostSuccessToJsonRpc,
  mapProcessedJsonRpcToArcadePreResult,
  mapProcessedJsonRpcToArcadePostResult,
} from '@/lib/types/arcadeWebhook';
import type { ArcadePostHookRequest, ArcadePreHookRequest } from '@/lib/types/arcadeWebhook';

export type ArcadeWebhookDirection = 'client' | 'server';

function syntheticMessageFilterContextForArcade(
  body: ArcadePreHookRequest | ArcadePostHookRequest
): MessageFilterContext {
  const arcadeContext = body.context;
  const user =
    typeof arcadeContext.user_id === 'string' && arcadeContext.user_id.trim().length > 0
      ? arcadeContext.user_id.trim()
      : 'unknown';
  const tool = body.tool;
  return {
    user,
    source: 'arcade',
    payloadToolkit: typeof tool?.toolkit === 'string' ? tool.toolkit : '',
    payloadToolVersion: typeof tool?.version === 'string' ? tool.version : '',
  };
}

/** Log + return JSON error (never silent 4xx/5xx). */
function jsonErrorResponse(hookLabel: string, status: number, message: string, extra?: string): Response {
  const suffix = extra ? ` ${extra}` : '';
  console.warn('[Arcade webhook]', hookLabel, 'response', status, message + suffix);
  return JsonResponse.errorResponse(status, message);
}

/** Safe request summary (no tokens / no full payloads). */
function summarizeWebhookBody(body: unknown, rawByteLength: number): string {
  if (!isPlainJsonObject(body)) {
    return JSON.stringify({ rawBytes: rawByteLength, bodyType: typeof body });
  }
  const tool = body.tool;
  const toolName =
    isPlainJsonObject(tool) && typeof tool.name === 'string' ? tool.name : undefined;
  return JSON.stringify({
    rawBytes: rawByteLength,
    topLevelKeys: Object.keys(body),
    execution_id: typeof body.execution_id === 'string' ? body.execution_id : undefined,
    toolName,
    hasInputs: 'inputs' in body,
    success: typeof body.success === 'boolean' ? body.success : undefined,
  });
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

function looksLikeArcadePreOnlyOnPostUrl(body: Record<string, unknown>): boolean {
  return (
    'inputs' in body &&
    !('output' in body) &&
    !('success' in body) &&
    !('execution_code' in body) &&
    !('execution_error' in body)
  );
}

/**
 * Arcade.dev Engine policy webhooks (`/webhooks/arcade/pre` = pre, `/webhooks/arcade/post` = post).
 *
 * **Body:** Exactly the Arcade Engine JSON (`docs/arcade/webhook.yaml`). No Pachinko-only fields.
 *
 * **Optional API secret:** When `filterApiBearerToken` is set, require `Authorization: Bearer <token>`.
 *
 * **Response:** Native Arcade `PreHookResult` / `PostHookResult` JSON (HTTP 200).
 */
export async function handleArcadeFilterWebhook(
  request: NextRequest,
  direction: ArcadeWebhookDirection
): Promise<Response> {
  const hookLabel = direction === 'client' ? 'pre' : 'post';
  console.log('[Arcade webhook]', hookLabel, request.method, new URL(request.url).pathname);

  try {
    const rawText = await request.text();
    const maxRawLog = 8192;
    if (!rawText.trim()) {
      return jsonErrorResponse(
        hookLabel,
        400,
        'Empty request body. Arcade must POST JSON per docs/arcade/webhook.yaml.',
        `(rawBytes=0)`
      );
    }
    console.log(
      '[Arcade webhook]',
      hookLabel,
      'raw JSON (may include secrets; truncated):',
      rawText.length > maxRawLog ? `${rawText.slice(0, maxRawLog)}\n… [truncated ${rawText.length - maxRawLog} chars]` : rawText
    );

    let body: unknown;
    try {
      body = JSON.parse(rawText) as unknown;
    } catch (e) {
      const hint = e instanceof Error ? e.message : String(e);
      return jsonErrorResponse(hookLabel, 400, 'Invalid JSON body', `(parse: ${hint})`);
    }

    console.log('[Arcade webhook]', hookLabel, 'parsed summary', summarizeWebhookBody(body, rawText.length));

    const appSettingsModel = await ModelFactory.getInstance().getAppSettingsModel();
    const appSettings = await appSettingsModel.get();
    const configuredSecret = appSettings.filterApiBearerToken?.trim() ?? '';

    const authHeader = request.headers.get('authorization');

    if (configuredSecret) {
      if (!bearerMatchesConfiguredSecret(authHeader, configuredSecret)) {
        return jsonErrorResponse(hookLabel, 401, 'Unauthorized', '(bearer does not match filterApiBearerToken)');
      }
    }

    if (direction === 'client') {
      if (isArcadeEnginePrePayload(body)) {
        const filterPayload = syntheticMessageFilterContextForArcade(body);
        console.log(
          '[Arcade webhook]',
          hookLabel,
          'using MessageFilterContext',
          JSON.stringify({
            user: filterPayload.user,
            source: filterPayload.source,
            payloadToolkit: filterPayload.payloadToolkit,
          })
        );
        const rpc = arcadePreToJsonRpcRequest(body);
        const validatedMessage = validateJsonRpcMessage('client', rpc);
        const result = await MessageFilterService.processMessage(filterPayload, validatedMessage);
        if (!result.success) {
          return jsonErrorResponse(
            hookLabel,
            400,
            result.error ?? 'Policy processing failed',
            '(MessageFilterService.processMessage)'
          );
        }
        const preOut = mapProcessedJsonRpcToArcadePreResult(body.inputs, result.message);
        console.log('[Arcade webhook]', hookLabel, 'response', 200, JSON.stringify(preOut));
        return NextResponse.json(preOut);
      }
      if (isArcadeEnginePostPayloadWithoutInputs(body)) {
        return jsonErrorResponse(
          hookLabel,
          400,
          'This URL is for Arcade pre-hooks only (body must include `inputs`). Use POST /webhooks/arcade/post for post-hooks.',
          '(wrong hook shape for /pre)'
        );
      }
      return jsonErrorResponse(
        hookLabel,
        400,
        'Invalid Arcade pre-hook request body',
        '(expected execution_id, tool, inputs, context per docs/arcade/webhook.yaml)'
      );
    } else if (direction === 'server') {
      if (isPlainJsonObject(body) && looksLikeArcadePreOnlyOnPostUrl(body)) {
        return jsonErrorResponse(
          hookLabel,
          400,
          'This URL is for Arcade post-hooks only. Use POST /webhooks/arcade/pre for pre-hooks.',
          '(pre-only body on /post)'
        );
      }
      if (isArcadeEnginePostPayload(body)) {
        const filterPayload = syntheticMessageFilterContextForArcade(body);
        console.log(
          '[Arcade webhook]',
          hookLabel,
          'using MessageFilterContext',
          JSON.stringify({
            user: filterPayload.user,
            source: filterPayload.source,
            payloadToolkit: filterPayload.payloadToolkit,
          })
        );

        let shape;
        let rpc;
        if (body.success === false) {
          rpc = arcadePostFailureToJsonRpc(body);
          shape = arcadePostOutputToResultShape(undefined);
        } else {
          shape = arcadePostOutputToResultShape(body.output);
          rpc = arcadePostSuccessToJsonRpc(body.execution_id, shape);
        }
        const validatedMessage = validateJsonRpcMessage('server', rpc);
        const result = await MessageFilterService.processMessage(filterPayload, validatedMessage);
        if (!result.success) {
          return jsonErrorResponse(
            hookLabel,
            400,
            result.error ?? 'Policy processing failed',
            '(MessageFilterService.processMessage)'
          );
        }
        const postOut = mapProcessedJsonRpcToArcadePostResult(shape, result.message);
        console.log('[Arcade webhook]', hookLabel, 'response', 200, JSON.stringify(postOut));
        return NextResponse.json(postOut);
      }
      return jsonErrorResponse(
        hookLabel,
        400,
        'Invalid Arcade post-hook request body',
        '(expected execution_id, tool, context per docs/arcade/webhook.yaml)'
      );
    } else {
      const unreachable: never = direction;
      throw new Error(`Unhandled webhook direction: ${String(unreachable)}`);
    }
  } catch (error) {
    if (error instanceof JsonRpcValidationError) {
      return jsonErrorResponse(hookLabel, 400, error.message, '(JsonRpcValidationError)');
    }
    logger.error('Error in Arcade filter webhook:', error);
    const detail = error instanceof Error ? error.message : String(error);
    return jsonErrorResponse(hookLabel, 500, 'Internal server error', `(exception: ${detail})`);
  }
}
