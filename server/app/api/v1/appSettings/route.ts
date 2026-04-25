import { NextRequest, NextResponse } from 'next/server';
import { ModelFactory } from '@/lib/models';
import { logger } from '@/lib/logging/server';
import type { AppSettingsApiResponse, AppSettingsData } from '@/lib/models/types/appSettings';
import { normalizeExternalBaseUrl, resolvePublicBaseUrlFromRequest } from '@/lib/utils/publicBaseUrl';
import { getApiTenantOr401 } from '@/lib/api/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await getApiTenantOr401(request);
    if (!auth.ok) return auth.response;
    const appSettingsModel = await ModelFactory.getInstance().getAppSettingsModel(auth.tenantId);
    const settings = await appSettingsModel.get();
    const configured = normalizeExternalBaseUrl(settings.externalBaseUrl);
    const resolvedPublicBaseUrl = configured || resolvePublicBaseUrlFromRequest(request);
    const body: AppSettingsApiResponse = { ...settings, resolvedPublicBaseUrl };
    return NextResponse.json(body);
  } catch (error) {
    logger.error('Error getting app settings:', error);
    return NextResponse.json({ error: 'Failed to get app settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await getApiTenantOr401(request);
    if (!auth.ok) return auth.response;
    const appSettingsModel = await ModelFactory.getInstance().getAppSettingsModel(auth.tenantId);
    const raw = (await request.json()) as Record<string, unknown>;
    const data: AppSettingsData = {
      messageRetentionDays:
        typeof raw.messageRetentionDays === 'number' && raw.messageRetentionDays >= 1
          ? raw.messageRetentionDays
          : 90,
      alertRetentionDays:
        typeof raw.alertRetentionDays === 'number' && raw.alertRetentionDays >= 1
          ? raw.alertRetentionDays
          : 90,
      externalBaseUrl: typeof raw.externalBaseUrl === 'string' ? raw.externalBaseUrl : '',
    };
    await appSettingsModel.set(data);
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error updating app settings:', error);
    return NextResponse.json({ error: 'Failed to update app settings' }, { status: 500 });
  }
}
