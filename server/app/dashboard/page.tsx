'use client';

import { useState, useEffect } from 'react';
import { useLayout } from '@/app/contexts/LayoutContext';
import { DashboardChart } from '@/app/components/dashboard/DashboardChart';
import { NewAlertsSummary } from '@/app/components/alerts/NewAlertsSummary';
import { useDimensions } from '@/app/hooks/useDimensions';
import { useRouter } from 'next/navigation';
import { useAlerts } from '@/app/contexts/AlertsContext';

interface DashboardStats {
  servers: {
    total: number;
    active: number;
  };
  clients: {
    total: number;
    disabled: number;
  };
  policies: {
    total: number;
    alerts: number;
  };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    servers: { total: 0, active: 0 },
    clients: { total: 0, disabled: 0 },
    policies: { total: 0, alerts: 0 }
  });
  const { setHeaderTitle } = useLayout();
  const { dimensions } = useDimensions({
    dimensions: ['serverName', 'policyId']
  });
  const router = useRouter();
  const { unseenAlerts } = useAlerts();

  const AlertsStatus = () => {
    const totalUnseen = Object.values(unseenAlerts.bySeverity).reduce((sum, count) => sum + count, 0);

    if (totalUnseen === 0) {
      return (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div className="flex-1">
              <span className="text-sm font-medium text-gray-900">No unresolved alerts</span>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  useEffect(() => {
    setHeaderTitle('Dashboard');
    return () => setHeaderTitle(undefined);
  }, [setHeaderTitle]);

  useEffect(() => {
    async function fetchStats() {
      try {
        const serversRes = await fetch('/api/v1/servers?managed=true');
        const serversData = await serversRes.json();
        const servers = serversData.servers || [];
        const totalServers = servers.length;
        const activeServers = servers.filter((s: { enabled?: boolean }) => s.enabled).length;

        const clientsRes = await fetch('/api/v1/clients');
        const clientsData = await clientsRes.json();
        const clients = clientsData.clients || [];
        const activeClients = clients.filter((c: { enabled?: boolean }) => c.enabled).length;
        const totalClients = clients.length;
        const disabledClients = totalClients - activeClients;

        let totalPolicies = 0;
        let totalAlerts = 0;
        try {
          const policiesRes = await fetch('/api/v1/policies');
          if (policiesRes.status === 404) {
            totalPolicies = 0;
            totalAlerts = 0;
          } else {
            const policiesData = await policiesRes.json();
            const policies = policiesData.policies || [];
            totalPolicies = policies.length;
            totalAlerts = policies.reduce(
              (sum: number, p: { status?: { unseenAlerts?: number } }) => sum + (p.status?.unseenAlerts || 0),
              0
            );
          }
        } catch {
          totalPolicies = 0;
          totalAlerts = 0;
        }

        setStats({
          servers: { total: totalServers, active: activeServers },
          clients: { total: activeClients, disabled: disabledClients },
          policies: { total: totalPolicies, alerts: totalAlerts }
        });
      } catch {
        setStats({
          servers: { total: 0, active: 0 },
          clients: { total: 0, disabled: 0 },
          policies: { total: 0, alerts: 0 }
        });
      }
    }
    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      <NewAlertsSummary showSeparator={false} showReviewLink={true} />

      <AlertsStatus />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => router.push('/servers')}
        >
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold text-gray-900 flex-1">Servers</h3>
            <a
              href="/servers"
              className="text-blue-500 text-sm hover:underline ml-2"
              onClick={(e) => e.stopPropagation()}
            >
              Manage
            </a>
          </div>
          <div className="mt-2">
            <div className="flex flex-col items-start">
              <span className="text-3xl font-semibold text-gray-900">{stats.servers.active}</span>
              <span className="text-sm text-gray-500">Active</span>
              {stats.servers.total > stats.servers.active && (
                <span className="text-xs text-gray-400 mt-1">{stats.servers.total - stats.servers.active} disabled</span>
              )}
            </div>
          </div>
        </div>
        <div
          className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => router.push('/clients')}
        >
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold text-gray-900 flex-1">Clients</h3>
            <a
              href="/clients"
              className="text-blue-500 text-sm hover:underline ml-2"
              onClick={(e) => e.stopPropagation()}
            >
              Manage
            </a>
          </div>
          <div className="mt-2">
            <div className="flex flex-col items-start">
              <span className="text-3xl font-semibold text-gray-900">{stats.clients.total}</span>
              <span className="text-sm text-gray-500">Active</span>
              {stats.clients.disabled > 0 && (
                <span className="text-xs text-gray-400 mt-1">{stats.clients.disabled} disabled</span>
              )}
            </div>
          </div>
        </div>
        <div
          className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => router.push('/policies')}
        >
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold text-gray-900 flex-1">Policies</h3>
            <a
              href="/policies"
              className="text-blue-500 text-sm hover:underline ml-2"
              onClick={(e) => e.stopPropagation()}
            >
              Manage
            </a>
          </div>
          <div className="mt-2">
            <div className="flex flex-col items-start">
              <span className="text-3xl font-semibold text-gray-900">{stats.policies.total}</span>
              <span className="text-sm text-gray-500">Active</span>
              {stats.policies.alerts > 0 && (
                <span className="text-xs text-red-500 mt-1">{stats.policies.alerts} unread alerts</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <DashboardChart dimension="serverName" timeRange="7days" dimensions={dimensions} />
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <DashboardChart dimension="policyId" timeRange="7days" dimensions={dimensions} />
        </div>
      </div>
    </div>
  );
}
