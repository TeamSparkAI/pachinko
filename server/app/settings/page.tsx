'use client';

import { useState, useEffect } from 'react';
import { AppSettingsData } from '@/lib/models/types/appSettings';
import EditAppSettingsModal from '@/app/components/EditAppSettingsModal';
import { useModal } from '@/app/contexts/ModalContext';

function maskToken(token: string | undefined): string {
  const t = token?.trim() ?? '';
  if (!t) return 'Not set';
  if (t.length <= 8) return '••••••••';
  return `${t.slice(0, 4)}…${t.slice(-4)}`;
}

export default function SettingsPage() {
  const [appSettings, setAppSettings] = useState<AppSettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setModalContent } = useModal();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const appResponse = await fetch('/api/v1/appSettings');

      if (!appResponse.ok) {
        throw new Error('Failed to fetch settings');
      }

      const appData = await appResponse.json();
      setAppSettings(appData);
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error('Failed to save app settings');
      }

      setAppSettings(settings);
      setModalContent(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save app settings');
    }
  };

  const showAppModal = () => {
    setModalContent(
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">
        <EditAppSettingsModal
          settings={appSettings}
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
            <h2 className="text-lg font-medium text-gray-900">Application Settings</h2>
            <button
              onClick={showAppModal}
              className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Edit
            </button>
          </div>
          <div className="overflow-x-auto">
            <div className="grid grid-cols-[max-content,max-content,minmax(1rem,8rem),max-content,max-content] gap-x-4 gap-y-2">
              <div className="col-span-2 text-xs font-semibold text-gray-700 uppercase tracking-wide pb-2">Filter webhooks</div>
              <div></div>
              <div className="col-span-2 text-xs font-semibold text-gray-700 uppercase tracking-wide pb-2">Retention</div>

              <div className="text-sm text-gray-600 flex items-center whitespace-normal">API bearer token</div>
              <div className="flex items-center">
                <span className="text-base text-gray-900 font-mono px-2 py-1 bg-gray-100 rounded">
                  {maskToken(appSettings?.filterApiBearerToken)}
                </span>
              </div>
              <div></div>
              <div className="text-sm text-gray-600 flex items-center whitespace-normal">Message Retention (days)</div>
              <div className="flex items-center">
                <span className="text-base text-gray-900 font-mono px-2 py-1 bg-gray-100 rounded">
                  {appSettings?.messageRetentionDays ?? 'Not set'}
                </span>
              </div>

              <div className="text-sm text-gray-600 flex items-center whitespace-normal">Token enforced</div>
              <div className="flex items-center">
                <span
                  className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                    appSettings?.filterApiBearerToken?.trim() ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {appSettings?.filterApiBearerToken?.trim() ? 'Yes' : 'No'}
                </span>
              </div>
              <div></div>
              <div className="text-sm text-gray-600 flex items-center whitespace-normal">Alert Retention (days)</div>
              <div className="flex items-center">
                <span className="text-base text-gray-900 font-mono px-2 py-1 bg-gray-100 rounded">
                  {appSettings?.alertRetentionDays ?? 'Not set'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
