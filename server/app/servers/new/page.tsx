'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ServerEditForm } from '@/app/components/server/ServerEditForm';
import { useLayout } from '@/app/contexts/LayoutContext';
import { McpServerConfig } from '@/lib/types/server';
import { Server } from '@/lib/types/server';
import { ServerSecurity } from '@/lib/types/server';

const getInitialServer = (): Omit<Server, 'serverId' | 'token'> => {
  // Return empty server by default
  return {
    name: '',
    description: '',
    config: {
      type: 'stdio' as const,
      command: '',
      args: [],
      env: {}
    },
    enabled: true,
    security: undefined,
    status: {
      serverInfo: null,
      lastSeen: null
    }
  };
};

export default function NewServerPage() {
  const router = useRouter();
  const { setHeaderTitle } = useLayout();
  const [error, setError] = useState<string | null>(null);
  const [initialServer, setInitialServer] = useState<Omit<Server, 'serverId' | 'token'>>(getInitialServer());

  // Set the header title
  useEffect(() => {
    setHeaderTitle('New Server');
    return () => setHeaderTitle(undefined);
  }, [setHeaderTitle]);

  const handleSaveServer = async (serverData: { serverId?: string; name: string; description?: string; config: McpServerConfig; security?: ServerSecurity; serverCatalogId?: string }) => {
    try {
      const response = await fetch('/api/v1/servers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(serverData),
      });

      if (!response.ok) {
        throw new Error('Failed to create server');
      }

      const json = await response.json();
      if (!json.serverId) {
        throw new Error('Invalid response: missing serverId');
      }
      
      // Navigate to the new server
      router.push(`/servers/${json.serverId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleCancel = () => {
    router.push('/servers');
  };

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="space-y-6">
      <ServerEditForm 
        server={initialServer}
        onEdit={handleSaveServer}
        onCancel={handleCancel}
        isNewServer={true}
      />
    </div>
  );
} 