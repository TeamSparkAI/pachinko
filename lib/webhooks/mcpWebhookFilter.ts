import { NextRequest, NextResponse } from 'next/server';
import { MessageFilterService } from '@/lib/services/messageFilter';
import { resolveRequestContext, isAuthorizedTenant } from '@/lib/auth/resolveRequestContext';
import { JsonRpcValidationError, validateJsonRpcMessage } from '@/lib/jsonrpc';
import { JsonResponse } from '@/lib/jsonResponse';
import { logger } from '@/lib/logging/server';
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

function hookLabelString(direction: ArcadeWebhookDirection): 'pre' | 'post' {
  return direction === 'client' ? 'pre' : 'post';
}

function logHookSuccess(
  hook: 'pre' | 'post',
  httpStatus: number,
  tenantId: number,
  body: ArcadePreHookRequest | ArcadePostHookRequest
): void {
  const exec = typeof body.execution_id === 'string' ? body.execution_id : '';
  const t = body.tool;
  const toolName = isPlainJsonObject(t) && typeof t.name === 'string' ? t.name : '';
  const toolkit = isPlainJsonObject(t) && typeof t.toolkit === 'string' ? t.toolkit : '';
  const postNote =
    hook === 'post' && 'success' in body && typeof body.success === 'boolean'
      ? ` success=${body.success}`
      : '';
  logger.info(
    `[Arcade webhook] ${hook} ${httpStatus} tenant=${tenantId} execution_id=${exec} tool=${toolName || 'n/a'} toolkit=${toolkit || 'n/a'}${postNote}`
  );
}

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

/** Log + return JSON error (never silent 4xx/5xx). One warn line per request. */
function jsonErrorResponse(hookLabel: string, status: number, message: string, extra?: string): Response {
  const suffix = extra ? ` ${extra}` : '';
  logger.warn(`[Arcade webhook] ${hookLabel} response ${status} ${message}${suffix}`);
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
 * **Auth:** `Authorization: Bearer {keyLookupId}.{secret}` for a `tenant_api_keys` row (Bearer only; session cookies are not accepted).
 *
 * **Response:** Native Arcade `PreHookResult` / `PostHookResult` JSON (HTTP 200).
 */
export async function handleArcadeFilterWebhook(
  request: NextRequest,
  direction: ArcadeWebhookDirection
): Promise<Response> {
  const hookLabel = hookLabelString(direction);

  try {
    const rawText = await request.text();
    const maxRawLog = 8192;
    if (!rawText.trim()) {
      return jsonErrorResponse(
        hookLabel,
        400,
        'Empty request body. Arcade must POST JSON per docs/arcade/webhook.yaml.',
        '(rawBytes=0)'
      );
    }
    const rawForDebug =
      rawText.length > maxRawLog
        ? `${rawText.slice(0, maxRawLog)}… [truncated ${rawText.length - maxRawLog} chars]`
        : rawText;
    logger.debug(
      `[Arcade webhook] ${hookLabel} request raw JSON (may contain secrets; use debug only): ${rawForDebug}`
    );

    let body: unknown;
    try {
      body = JSON.parse(rawText) as unknown;
    } catch (e) {
      const hint = e instanceof Error ? e.message : String(e);
      return jsonErrorResponse(hookLabel, 400, 'Invalid JSON body', `(parse: ${hint})`);
    }

    logger.debug(`[Arcade webhook] ${hookLabel} parsed summary ${summarizeWebhookBody(body, rawText.length)}`);

    const ctx = await resolveRequestContext(request);
    if (!isAuthorizedTenant(ctx) || ctx.authMode !== 'bearer') {
      return jsonErrorResponse(
        hookLabel,
        401,
        'Unauthorized',
        '(require Authorization: Bearer keyLookupId.secret for tenant API key)'
      );
    }
    const tenantId = ctx.tenantId;

    if (direction === 'client') {
      if (isArcadeEnginePrePayload(body)) {
        const filterPayload = syntheticMessageFilterContextForArcade(body);
        logger.debug(
          `[Arcade webhook] ${hookLabel} MessageFilterContext ${JSON.stringify({
            user: filterPayload.user,
            source: filterPayload.source,
            payloadToolkit: filterPayload.payloadToolkit,
          })}`
        );
        const rpc = arcadePreToJsonRpcRequest(body);
        const validatedMessage = validateJsonRpcMessage('client', rpc);
        const result = await MessageFilterService.processMessage(
          filterPayload,
          validatedMessage,
          undefined,
          tenantId
        );
        if (!result.success) {
          return jsonErrorResponse(
            hookLabel,
            400,
            result.error ?? 'Policy processing failed',
            '(MessageFilterService.processMessage)'
          );
        }
        const preOut = mapProcessedJsonRpcToArcadePreResult(body.inputs, result.message);
        logHookSuccess(hookLabel, 200, tenantId, body);
        logger.debug(`[Arcade webhook] ${hookLabel} response body ${JSON.stringify(preOut)}`);
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
        logger.debug(
          `[Arcade webhook] ${hookLabel} MessageFilterContext ${JSON.stringify({
            user: filterPayload.user,
            source: filterPayload.source,
            payloadToolkit: filterPayload.payloadToolkit,
          })}`
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
        const result = await MessageFilterService.processMessage(
          filterPayload,
          validatedMessage,
          undefined,
          tenantId
        );
        if (!result.success) {
          return jsonErrorResponse(
            hookLabel,
            400,
            result.error ?? 'Policy processing failed',
            '(MessageFilterService.processMessage)'
          );
        }
        const postOut = mapProcessedJsonRpcToArcadePostResult(shape, result.message);
        logHookSuccess(hookLabel, 200, tenantId, body);
        logger.debug(`[Arcade webhook] ${hookLabel} response body ${JSON.stringify(postOut)}`);
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
