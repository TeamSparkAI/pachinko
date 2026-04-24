import { NextRequest, NextResponse } from 'next/server';
import { ModelFactory } from '@/lib/models';
import { logger } from '@/lib/logging/server';
import type { AppSettingsApiResponse, AppSettingsData } from '@/lib/models/types/appSettings';
import { normalizeExternalBaseUrl, resolvePublicBaseUrlFromRequest } from '@/lib/utils/publicBaseUrl';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const appSettingsModel = await ModelFactory.getInstance().getAppSettingsModel();
    const settings = await appSettingsModel.get();
    const configured = normalizeExternalBaseUrl(settings.externalBaseUrl);
    const resolvedPublicBaseUrl = configured || resolvePublicBaseUrlFromRequest(request);
    const body: AppSettingsApiResponse = { ...settings, resolvedPublicBaseUrl };
    return NextResponse.json(body);
  } catch (error) {
    logger.error('Error getting app settings:', error);
    return NextResponse.json(
      { error: 'Failed to get app settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const appSettingsModel = await ModelFactory.getInstance().getAppSettingsModel();
    const raw = await request.json();
    const data: AppSettingsData = {
      filterApiBearerToken: typeof raw.filterApiBearerToken === 'string' ? raw.filterApiBearerToken : '',
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
    return NextResponse.json(
      { error: 'Failed to update app settings' },
      { status: 500 }
    );
  }
} 