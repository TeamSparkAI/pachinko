'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLayout } from '@/app/contexts/LayoutContext';
import { DashboardChart } from '@/app/components/dashboard/DashboardChart';
import { NewAlertsSummary } from '@/app/components/alerts/NewAlertsSummary';
import { useDimensions } from '@/app/hooks/useDimensions';
import { useRouter } from 'next/navigation';
import { useAlerts } from '@/app/contexts/AlertsContext';
import type { AppSettingsApiResponse } from '@/lib/models/types/appSettings';

const ARCADE_PRE_PATH = '/api/v1/webhooks/arcade/pre';
const ARCADE_POST_PATH = '/api/v1/webhooks/arcade/post';

interface DashboardStats {
  policies: {
    total: number;
    alerts: number;
  };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    policies: { total: 0, alerts: 0 },
  });
  const [appSettings, setAppSettings] = useState<AppSettingsApiResponse | null>(null);
  const { setHeaderTitle } = useLayout();
  const { dimensions } = useDimensions({
    dimensions: ['payloadToolkit', 'policyId']
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
      let totalPolicies = 0;
      let totalAlerts = 0;
      try {
        const policiesRes = await fetch('/api/v1/policies', { credentials: 'include' });
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
        setStats({
          policies: { total: totalPolicies, alerts: totalAlerts },
        });
      } catch {
        setStats({
          policies: { total: 0, alerts: 0 },
        });
      }
    }

    async function fetchAppSettings() {
      try {
        const res = await fetch('/api/v1/appSettings', { credentials: 'include' });
        if (res.ok) {
          setAppSettings((await res.json()) as AppSettingsApiResponse);
        }
      } catch {
        setAppSettings(null);
      }
    }

    fetchStats();
    fetchAppSettings();
  }, []);

  return (
    <div className="space-y-6">
      <NewAlertsSummary showSeparator={false} showReviewLink={true} />

      <AlertsStatus />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xl font-semibold text-gray-900 flex-1">Arcade Webhooks</h3>
            <Link href="/settings" className="text-blue-500 text-sm hover:underline ml-2 shrink-0">
              Settings
            </Link>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            Pre- and post-execution URLs for Arcade Engine. Configure under Settings.
          </p>
          <div className="space-y-2">
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pre-hook</div>
              <code className="mt-0.5 block text-xs font-mono bg-gray-100 rounded p-2 break-all text-gray-900">
                {appSettings?.resolvedPublicBaseUrl
                  ? `${appSettings.resolvedPublicBaseUrl}${ARCADE_PRE_PATH}`
                  : '—'}
              </code>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Post-hook</div>
              <code className="mt-0.5 block text-xs font-mono bg-gray-100 rounded p-2 break-all text-gray-900">
                {appSettings?.resolvedPublicBaseUrl
                  ? `${appSettings.resolvedPublicBaseUrl}${ARCADE_POST_PATH}`
                  : '—'}
              </code>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <DashboardChart dimension="payloadToolkit" timeRange="7days" dimensions={dimensions} />
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <DashboardChart dimension="policyId" timeRange="7days" dimensions={dimensions} />
        </div>
      </div>
    </div>
  );
}
