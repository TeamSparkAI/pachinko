import { useState, useEffect } from 'react';
import type { AppSettingsData } from '@/lib/models/types/appSettings';

interface EditArcadeHostModalProps {
  settings: AppSettingsData | null;
  onSave: (externalBaseUrl: string) => void;
  onCancel: () => void;
}

export default function EditArcadeHostModal({ settings, onSave, onCancel }: EditArcadeHostModalProps) {
  const [externalBaseUrl, setExternalBaseUrl] = useState(settings?.externalBaseUrl ?? '');

  useEffect(() => {
    if (settings) {
      setExternalBaseUrl(settings.externalBaseUrl ?? '');
    }
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(externalBaseUrl.trim());
  };

  return (
    <>
      <h2 className="text-xl font-bold mb-4">Edit public host</h2>
      <p className="text-sm text-gray-600 mb-4">
        Base URL used to show full Arcade pre/post webhook URLs. Leave empty to use the same host as this page
        (e.g. <code className="text-xs bg-gray-100 px-1 rounded">http://localhost:3000</code>).
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="externalBaseUrl" className="block text-sm font-medium text-gray-700 mb-1">
            Public host URL
          </label>
          <input
            id="externalBaseUrl"
            type="url"
            value={externalBaseUrl}
            onChange={(e) => setExternalBaseUrl(e.target.value)}
            placeholder="https://your-host.example.com"
            className="w-full p-2 border rounded font-mono text-sm"
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
