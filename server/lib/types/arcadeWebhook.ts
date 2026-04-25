import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types';

/** Arcade.dev `ToolInfo` (see docs/arcade/webhook.yaml). */
export interface ArcadeToolInfo {
  name: string;
  toolkit: string;
  version: string;
  metadata?: unknown;
}

/** Arcade.dev `ToolContext` — optional fields only. */
export interface ArcadeToolContext {
  user_id?: string;
  metadata?: Record<string, unknown>;
  secrets?: string[];
  authorization?: unknown[];
}

/** Arcade Engine pre-hook request body (`docs/arcade/webhook.yaml`). */
export interface ArcadePreHookRequest {
  execution_id: string;
  tool: ArcadeToolInfo;
  inputs: Record<string, unknown>;
  context: ArcadeToolContext;
}

/** Arcade Engine post-hook request body (`docs/arcade/webhook.yaml`). */
export interface ArcadePostHookRequest {
  execution_id: string;
  tool: ArcadeToolInfo;
  context: ArcadeToolContext;
  inputs?: Record<string, unknown>;
  success?: boolean;
  output?: unknown;
  execution_code?: string;
  execution_error?: string;
}

export type ArcadeResponseCode = 'OK' | 'CHECK_FAILED' | 'RATE_LIMIT_EXCEEDED';

export interface ArcadePreHookResult {
  code: ArcadeResponseCode;
  error_message?: string;
  override?: {
    inputs?: Record<string, unknown>;
    secrets?: Array<Record<string, string>>;
  };
}

export interface ArcadePostHookResult {
  code: ArcadeResponseCode;
  error_message?: string;
  override?: { output?: unknown };
}

/** How Arcade `output` was mapped into JSON-RPC `result` (must be an object for existing validation). */
export type ArcadePostResultShape =
  | { kind: 'object_result'; original: object }
  | { kind: 'wrapped_value'; original: unknown };

/** Plain JSON object (not array); narrows `unknown` from webhook bodies. */
export function isPlainJsonObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function recordJson(value: unknown): Record<string, unknown> | null {
  return isPlainJsonObject(value) ? value : null;
}

function isArcadeToolInfo(value: unknown): value is ArcadeToolInfo {
  const o = recordJson(value);
  if (!o) {
    return false;
  }
  return typeof o.name === 'string' && typeof o.toolkit === 'string' && typeof o.version === 'string';
}

function isArcadeToolContext(value: unknown): value is ArcadeToolContext {
  return recordJson(value) !== null;
}

/** Arcade pre-hook wire shape (`docs/arcade/webhook.yaml`). */
export function isArcadeEnginePrePayload(value: unknown): value is ArcadePreHookRequest {
  const o = recordJson(value);
  if (!o) {
    return false;
  }
  if ('message' in o && o.message !== undefined && o.message !== null) {
    return false;
  }
  if (!('execution_id' in o) || !('tool' in o) || !('inputs' in o) || !('context' in o)) {
    return false;
  }
  if (typeof o.execution_id !== 'string' || o.execution_id.length === 0) {
    return false;
  }
  if (!isArcadeToolInfo(o.tool) || !isArcadeToolContext(o.context)) {
    return false;
  }
  const inputs = o.inputs;
  if (inputs === null || typeof inputs !== 'object' || Array.isArray(inputs)) {
    return false;
  }
  return true;
}

/** True when the body looks like a post-hook (post-only fields) but not a valid pre-hook (no `inputs`). */
export function isArcadeEnginePostPayloadWithoutInputs(value: unknown): boolean {
  const o = recordJson(value);
  if (!o) {
    return false;
  }
  if (!('execution_id' in o) || !('tool' in o) || !('context' in o)) {
    return false;
  }
  if ('inputs' in o) {
    return false;
  }
  return isArcadeToolInfo(o.tool) && isArcadeToolContext(o.context) && typeof o.execution_id === 'string';
}

/** Arcade post-hook wire shape (`docs/arcade/webhook.yaml`). */
export function isArcadeEnginePostPayload(value: unknown): value is ArcadePostHookRequest {
  const o = recordJson(value);
  if (!o) {
    return false;
  }
  if ('message' in o && o.message !== undefined && o.message !== null) {
    return false;
  }
  if (!('execution_id' in o) || !('tool' in o) || !('context' in o)) {
    return false;
  }
  if (typeof o.execution_id !== 'string' || o.execution_id.length === 0) {
    return false;
  }
  if (!isArcadeToolInfo(o.tool) || !isArcadeToolContext(o.context)) {
    return false;
  }
  if ('inputs' in o && o.inputs !== undefined && o.inputs !== null) {
    const inputs = o.inputs;
    if (typeof inputs !== 'object' || Array.isArray(inputs)) {
      return false;
    }
  }
  return true;
}

export function arcadePreToJsonRpcRequest(req: Pick<ArcadePreHookRequest, 'execution_id' | 'tool' | 'inputs'>): JSONRPCMessage {
  return {
    jsonrpc: '2.0',
    id: req.execution_id,
    method: 'tools/call',
    params: {
      name: req.tool.name,
      arguments: req.inputs,
    },
  } as JSONRPCMessage;
}

export function arcadePostFailureToJsonRpc(
  req: Pick<ArcadePostHookRequest, 'execution_id' | 'execution_error'>
): JSONRPCMessage {
  const message =
    typeof req.execution_error === 'string' && req.execution_error.trim().length > 0
      ? req.execution_error.trim()
      : 'Tool execution failed';
  return {
    jsonrpc: '2.0',
    id: req.execution_id,
    error: { code: -32000, message },
  } as JSONRPCMessage;
}

export function arcadePostOutputToResultShape(output: unknown): ArcadePostResultShape {
  if (output === undefined) {
    return { kind: 'object_result', original: {} };
  }
  if (output !== null && typeof output === 'object' && !Array.isArray(output)) {
    return { kind: 'object_result', original: output };
  }
  return { kind: 'wrapped_value', original: output };
}

export function arcadePostSuccessToJsonRpc(executionId: string, shape: ArcadePostResultShape): JSONRPCMessage {
  if (shape.kind === 'object_result') {
    return { jsonrpc: '2.0', id: executionId, result: shape.original } as JSONRPCMessage;
  }
  return {
    jsonrpc: '2.0',
    id: executionId,
    result: { value: shape.original },
  } as JSONRPCMessage;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value);
}

export function mapProcessedJsonRpcToArcadePreResult(
  originalInputs: Record<string, unknown>,
  processed: JSONRPCMessage
): ArcadePreHookResult {
  const raw: unknown = processed;
  if (!isPlainJsonObject(raw)) {
    return { code: 'CHECK_FAILED', error_message: 'Invalid policy response' };
  }
  const root = raw;
  if ('error' in root && root.error !== undefined && root.error !== null) {
    const err = recordJson(root.error);
    const msg = err && typeof err.message === 'string' ? err.message : 'Policy blocked request';
    return { code: 'CHECK_FAILED', error_message: msg };
  }
  let params: Record<string, unknown> | null = null;
  const rawParams = root.params;
  if (typeof rawParams === 'string') {
    try {
      const parsed: unknown = JSON.parse(rawParams);
      params = recordJson(parsed);
    } catch {
      return { code: 'CHECK_FAILED', error_message: 'Invalid policy response' };
    }
  } else {
    params = recordJson(rawParams);
  }
  if (!params) {
    return { code: 'CHECK_FAILED', error_message: 'Invalid policy response' };
  }
  const errNested = recordJson(params.error);
  if (errNested && typeof errNested.message === 'string') {
    return { code: 'CHECK_FAILED', error_message: errNested.message };
  }
  const args = params.arguments;
  const argsObj = recordJson(args);
  if (!argsObj) {
    return { code: 'OK' };
  }
  if (stableStringify(argsObj) === stableStringify(originalInputs)) {
    return { code: 'OK' };
  }
  return { code: 'OK', override: { inputs: argsObj } };
}

export function mapProcessedJsonRpcToArcadePostResult(
  shape: ArcadePostResultShape,
  processed: JSONRPCMessage
): ArcadePostHookResult {
  const raw: unknown = processed;
  if (!isPlainJsonObject(raw)) {
    return { code: 'CHECK_FAILED', error_message: 'Invalid policy response' };
  }
  const root = raw;
  if ('error' in root && root.error !== undefined && root.error !== null) {
    const err = recordJson(root.error);
    const msg = err && typeof err.message === 'string' ? err.message : 'Policy blocked request';
    return { code: 'CHECK_FAILED', error_message: msg };
  }
  const rawResult = root.result;
  let resultValue: unknown = rawResult;
  if (typeof rawResult === 'string') {
    try {
      resultValue = JSON.parse(rawResult);
    } catch {
      return { code: 'CHECK_FAILED', error_message: 'Invalid policy response' };
    }
  }

  /** Return Error action replaces `result` with `{ error: { message } }` (same pattern as pre `params`). */
  const resultObj = recordJson(resultValue);
  if (resultObj && 'error' in resultObj && resultObj.error !== undefined && resultObj.error !== null) {
    const nested = recordJson(resultObj.error);
    const msg =
      nested && typeof nested.message === 'string' ? nested.message : 'Policy blocked request';
    return { code: 'CHECK_FAILED', error_message: msg };
  }

  if (shape.kind === 'wrapped_value') {
    const obj = recordJson(resultValue);
    if (obj && Object.keys(obj).length === 1 && 'value' in obj) {
      const next = obj.value;
      if (stableStringify(next) === stableStringify(shape.original)) {
        return { code: 'OK' };
      }
      return { code: 'OK', override: { output: next } };
    }
    if (stableStringify(resultValue) === stableStringify(shape.original)) {
      return { code: 'OK' };
    }
    return { code: 'OK', override: { output: resultValue } };
  }
  const outObj = recordJson(resultValue);
  if (!outObj) {
    return { code: 'OK', override: { output: resultValue } };
  }
  if (stableStringify(outObj) === stableStringify(shape.original)) {
    return { code: 'OK' };
  }
  return { code: 'OK', override: { output: outObj } };
}
