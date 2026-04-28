'use client';

import { useState, useEffect, useCallback } from 'react';
import { JsonResponseFetch } from '@/lib/jsonResponse';
import { useModal } from '@/app/contexts/ModalContext';
import { useDialog } from '@/app/hooks/useDialog';
import { CopyButton } from '@/app/components/common/CopyButton';

type ApiKeyRow = {
  keyId: number;
  keyLookupId: string;
  name: string | null;
  createdAt: string;
  revokedAt: string | null;
};

type CreatedKey = ApiKeyRow & { bearerToken: string };

function ApiKeyCreatedModal({
  displayName,
  bearerToken,
  onDismiss,
}: {
  displayName: string;
  bearerToken: string;
  onDismiss: () => void;
}) {
  return (
    <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 space-y-4">
      <h2 className="text-xl font-bold text-gray-900">API key created</h2>
      <p className="text-sm text-gray-700">
        <span className="font-medium text-gray-900">Name: </span>
        {displayName}
      </p>
      <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-md p-3">
        Copy this token now and store it somewhere safe. You will not be able to see the secret again.
      </p>
      <code className="block text-xs sm:text-sm font-mono break-all bg-gray-50 border border-gray-200 rounded-md p-3 text-gray-900">
        {bearerToken}
      </code>
      <div className="flex flex-wrap gap-2 justify-end pt-2">
        <CopyButton text={bearerToken} />
        <button
          type="button"
          onClick={onDismiss}
          className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Done
        </button>
      </div>
    </div>
  );
}

export function ApiKeysSection() {
  const { setModalContent } = useModal();
  const { confirm } = useDialog();
  const [rows, setRows] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/v1/apiKeys', { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 403) {
          setError('API key management requires a browser session (log in with email and password).');
        } else {
          setError('Failed to load API keys');
        }
        setRows([]);
        return;
      }
      const json = await res.json();
      const parsed = new JsonResponseFetch<ApiKeyRow[]>(json, 'apiKeys');
      setRows(parsed.payload ?? []);
    } catch {
      setError('Failed to load API keys');
      setRows([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const create = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/apiKeys', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || undefined }),
      });
      if (!res.ok) {
        throw new Error('Could not create key');
      }
      const json = await res.json();
      const wrap = new JsonResponseFetch<CreatedKey>(json, 'created');
      const created = wrap.payload;
      setName('');
      await load();
      setModalContent(
        <ApiKeyCreatedModal
          displayName={created.name?.trim() || 'API key'}
          bearerToken={created.bearerToken}
          onDismiss={() => setModalContent(null)}
        />
      );
    } catch {
      setError('Could not create key');
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (keyId: number) => {
    const ok = await confirm(
      'Arcade and API clients using this key will stop working until you configure a new key.',
      'Revoke this API key?'
    );
    if (!ok) return;
    setError(null);
    const res = await fetch(`/api/v1/apiKeys/${keyId}/revoke`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      setError('Could not revoke key');
      return;
    }
    await load();
  };

  const remove = async (keyId: number) => {
    const ok = await confirm(
      'This cannot be undone. Any clients still using this key will need a new one.',
      'Delete this API key?'
    );
    if (!ok) return;
    setError(null);
    const res = await fetch(`/api/v1/apiKeys/${keyId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      setError('Could not delete key');
      return;
    }
    await load();
  };

  if (loading) {
    return <div className="text-sm text-gray-500">Loading API keys…</div>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1 min-w-0">
          <label htmlFor="api-key-name" className="block text-sm text-gray-600 mb-1">
            Name (optional)
          </label>
          <input
            id="api-key-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Arcade production"
            className="w-full max-w-md border border-gray-300 rounded-md px-3 py-2 text-sm"
            maxLength={120}
          />
        </div>
        <button
          type="button"
          onClick={create}
          disabled={creating}
          className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {creating ? 'Creating…' : 'Create key'}
        </button>
      </div>

      <p className="text-sm text-gray-600">
        Use the full token as <code className="text-xs bg-gray-100 px-1 rounded">Authorization: Bearer</code> for
        webhooks and the REST API. The bearer token value (secret) is only shown once—when you create a key.
      </p>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">No API keys yet. Create one to use Arcade pre/post hooks and authenticated APIs.</p>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Created</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.keyId} className="bg-white">
                  <td className="px-3 py-2 text-gray-900">{r.name || '—'}</td>
                  <td className="px-3 py-2">
                    {r.revokedAt ? (
                      <span className="text-amber-800 bg-amber-100 px-2 py-0.5 rounded text-xs">Revoked</span>
                    ) : (
                      <span className="text-green-800 bg-green-100 px-2 py-0.5 rounded text-xs">Active</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                    {!r.revokedAt && (
                      <button
                        type="button"
                        onClick={() => void revoke(r.keyId)}
                        className="text-amber-800 hover:underline text-xs font-medium"
                      >
                        Revoke
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void remove(r.keyId)}
                      className="text-red-700 hover:underline text-xs font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
