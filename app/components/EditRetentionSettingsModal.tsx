import { useState, useEffect } from 'react';
import type { AppSettingsData } from '@/lib/models/types/appSettings';

interface EditRetentionSettingsModalProps {
  settings: AppSettingsData | null;
  onSave: (messageRetentionDays: number, alertRetentionDays: number) => void;
  onCancel: () => void;
}

export default function EditRetentionSettingsModal({
  settings,
  onSave,
  onCancel,
}: EditRetentionSettingsModalProps) {
  const [messageRetentionDays, setMessageRetentionDays] = useState(settings?.messageRetentionDays ?? 30);
  const [alertRetentionDays, setAlertRetentionDays] = useState(settings?.alertRetentionDays ?? 30);

  useEffect(() => {
    if (settings) {
      setMessageRetentionDays(settings.messageRetentionDays);
      setAlertRetentionDays(settings.alertRetentionDays);
    }
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(messageRetentionDays, alertRetentionDays);
  };

  return (
    <>
      <h2 className="text-xl font-bold mb-4">Edit retention</h2>
      <p className="text-sm text-gray-600 mb-4">
        How long to keep messages and alerts before retention jobs may remove them.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Message retention (days)</label>
          <input
            type="number"
            value={messageRetentionDays}
            onChange={(e) => setMessageRetentionDays(parseInt(e.target.value, 10) || 1)}
            min={1}
            className="w-full p-2 border rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Alert retention (days)</label>
          <input
            type="number"
            value={alertRetentionDays}
            onChange={(e) => setAlertRetentionDays(parseInt(e.target.value, 10) || 1)}
            min={1}
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
