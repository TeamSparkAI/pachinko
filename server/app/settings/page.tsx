'use client';

import { useState, useEffect } from 'react';
import { AppSettingsApiResponse, AppSettingsData } from '@/lib/models/types/appSettings';
import EditAppSettingsModal from '@/app/components/EditAppSettingsModal';
import { ApiKeysSection } from '@/app/components/ApiKeysSection';
import { useModal } from '@/app/contexts/ModalContext';

const ARCADE_PRE_PATH = '/api/v1/webhooks/arcade/pre';
const ARCADE_POST_PATH = '/api/v1/webhooks/arcade/post';

export default function SettingsPage() {
  const [appSettings, setAppSettings] = useState<AppSettingsApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setModalContent } = useModal();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const appResponse = await fetch('/api/v1/appSettings', { credentials: 'include' });

      if (!appResponse.ok) {
        throw new Error('Failed to fetch settings');
      }

      const appData = await appResponse.json();
      setAppSettings(appData as AppSettingsApiResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  };

  const handleAppSettingsSave = async (settings: AppSettingsData) => {
    try {
      const response = await fetch('/api/v1/appSettings', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error('Failed to save app settings');
      }

      const refresh = await fetch('/api/v1/appSettings', { credentials: 'include' });
      if (refresh.ok) {
        setAppSettings((await refresh.json()) as AppSettingsApiResponse);
      }
      setModalContent(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save app settings');
    }
  };

  const showAppModal = () => {
    setModalContent(
      <div className="bg-white rounded-lg shadow-xl max-w-xl w-full mx-4 p-6">
        <EditAppSettingsModal
          settings={appSettings ?? null}
          onSave={handleAppSettingsSave}
          onCancel={() => setModalContent(null)}
        />
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="h-full p-6 space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800">Error: {error}</div>
        </div>
      )}

      <div className="flex flex-col gap-6 w-full">
        <div className="bg-white rounded-lg shadow p-6 w-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-900">Application settings</h2>
            <button
              onClick={showAppModal}
              className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Edit
            </button>
          </div>
          <div className="overflow-x-auto">
            <div className="grid grid-cols-[max-content,1fr] gap-x-4 gap-y-2">
              <div className="text-sm text-gray-600">Message retention (days)</div>
              <div className="text-base text-gray-900 font-mono">{appSettings?.messageRetentionDays ?? '—'}</div>
              <div className="text-sm text-gray-600">Alert retention (days)</div>
              <div className="text-base text-gray-900 font-mono">{appSettings?.alertRetentionDays ?? '—'}</div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200 space-y-3">
            <div className="pb-1">
              <img
                src="/arcade-logo.png"
                alt="Arcade"
                className="h-9 w-auto max-w-[200px] object-contain object-left"
              />
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Arcade pre-hook</div>
              <code className="block text-sm font-mono bg-gray-100 rounded p-2 break-all text-gray-900">
                {appSettings?.resolvedPublicBaseUrl
                  ? `${appSettings.resolvedPublicBaseUrl}${ARCADE_PRE_PATH}`
                  : '—'}
              </code>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Arcade post-hook</div>
              <code className="block text-sm font-mono bg-gray-100 rounded p-2 break-all text-gray-900">
                {appSettings?.resolvedPublicBaseUrl
                  ? `${appSettings.resolvedPublicBaseUrl}${ARCADE_POST_PATH}`
                  : '—'}
              </code>
            </div>
            <p className="text-sm text-gray-600 pt-1">
              These webhooks require{' '}
              <code className="text-xs bg-gray-100 px-1 rounded">Authorization: Bearer</code> with an API key you
              create in the <span className="font-medium text-gray-800">API keys</span> section below.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 w-full">
          <h2 className="text-lg font-medium text-gray-900 mb-4">API keys</h2>
          <ApiKeysSection />
        </div>
      </div>
    </div>
  );
}
