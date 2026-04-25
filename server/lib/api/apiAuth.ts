import { NextRequest, NextResponse } from 'next/server';
import { resolveRequestContext, isAuthorizedTenant } from '@/lib/auth/resolveRequestContext';
import { JsonResponse } from '@/lib/jsonResponse';

export type ApiTenantAuth =
  | { ok: true; tenantId: number; userId: number | null }
  | { ok: false; response: NextResponse };

export type ApiSessionAuth = { ok: true; tenantId: number; userId: number } | { ok: false; response: NextResponse };

/**
 * For `/api/v1/*`: require session cookie or `Authorization: Bearer keyLookupId.secret`.
 */
export async function getApiTenantOr401(request: NextRequest): Promise<ApiTenantAuth> {
  const ctx = await resolveRequestContext(request);
  if (!isAuthorizedTenant(ctx)) {
    return { ok: false, response: JsonResponse.errorResponse(401, 'Unauthorized') };
  }
  return {
    ok: true,
    tenantId: ctx.tenantId,
    userId: ctx.authMode === 'session' ? ctx.userId : null,
  };
}

/**
 * For sensitive account operations (e.g. API key management): session login only, not tenant Bearer.
 */
export async function getApiSessionOr403(request: NextRequest): Promise<ApiSessionAuth> {
  const a = await getApiTenantOr401(request);
  if (!a.ok) {
    return a;
  }
  if (a.userId == null) {
    return { ok: false, response: JsonResponse.errorResponse(403, 'Session required') };
  }
  return { ok: true, tenantId: a.tenantId, userId: a.userId };
}
