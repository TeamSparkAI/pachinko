import type { NextRequest } from 'next/server';
import { resolveRequestContext } from './resolveRequestContext';

export async function requireSessionTenantId(request: NextRequest): Promise<number | null> {
  const ctx = await resolveRequestContext(request);
  if (ctx.authMode === 'session') {
    return ctx.tenantId;
  }
  return null;
}
