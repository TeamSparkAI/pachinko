import { useState, useEffect } from 'react';
import { AppSettingsData } from '@/lib/models/types/appSettings';

interface EditAppSettingsModalProps {
  settings: AppSettingsData | null;
  onSave: (settings: AppSettingsData) => void;
  onCancel: () => void;
}

export default function EditAppSettingsModal({ settings, onSave, onCancel }: EditAppSettingsModalProps) {
  const [messageRetentionDays, setMessageRetentionDays] = useState(settings?.messageRetentionDays ?? 30);
  const [alertRetentionDays, setAlertRetentionDays] = useState(settings?.alertRetentionDays ?? 30);
  const [externalBaseUrl, setExternalBaseUrl] = useState(settings?.externalBaseUrl ?? '');

  useEffect(() => {
    if (settings) {
      setMessageRetentionDays(settings.messageRetentionDays);
      setAlertRetentionDays(settings.alertRetentionDays);
      setExternalBaseUrl(settings.externalBaseUrl ?? '');
    }
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      messageRetentionDays,
      alertRetentionDays,
      externalBaseUrl,
    });
  };

  return (
    <>
      <h2 className="text-xl font-bold mb-4">Edit Application Settings</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="externalBaseUrl" className="block text-sm font-medium text-gray-700 mb-1">
            Public server URL
          </label>
          <input
            id="externalBaseUrl"
            type="url"
            value={externalBaseUrl}
            onChange={(e) => setExternalBaseUrl(e.target.value)}
            placeholder="https://your-host.example.com (leave empty to use this page’s host and port)"
            className="w-full p-2 border rounded font-mono text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">
            Used on the Settings page to show full Arcade webhook URLs. Empty means the URL from your browser (e.g.{' '}
            <code className="text-xs bg-gray-100 px-1 rounded">http://localhost:3000</code>).
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Message Retention (days)</label>
          <input
            type="number"
            value={messageRetentionDays}
            onChange={(e) => setMessageRetentionDays(parseInt(e.target.value, 10) || 1)}
            min="1"
            className="w-full p-2 border rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Alert Retention (days)</label>
          <input
            type="number"
            value={alertRetentionDays}
            onChange={(e) => setAlertRetentionDays(parseInt(e.target.value, 10) || 1)}
            min="1"
            className="w-full p-2 border rounded"
          />
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-600 hover:text-gray-800">
            Cancel
          </button>
          <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            Save
          </button>
        </div>
      </form>
    </>
  );
}
