import { useState } from 'react';
import { useTimeSeriesData } from '../charts/useTimeSeriesData';
import { TimeSeriesChart } from '../charts/TimeSeriesChart';
import { TimeRange } from '@/app/lib/utils/timeSeries';
import { Dimensions } from '@/app/hooks/useDimensions';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toggleFilterInUrl } from '@/app/lib/utils/urlParams';

export type DashboardChartDimension = 'payloadToolkit' | 'policyId';

interface DashboardChartProps {
  dimension: DashboardChartDimension;
  timeRange: TimeRange;
  filters?: Record<string, string>;
  dimensions?: Dimensions;
}

export function DashboardChart({ dimension, timeRange: initialTimeRange, filters = {}, dimensions }: DashboardChartProps) {
  const router = useRouter();
  const [timeRange] = useState(initialTimeRange);
  
  const { data, isLoading, error } = useTimeSeriesData({
    dimension,
    timeRange,
    filters
  });

  const reviewLink = dimension === 'policyId' ? '/alerts' : '/messages';
  const title =
    dimension === 'policyId'
      ? `Alerts by Policy${timeRange === '7days' ? ' (Last 7 Days)' : timeRange === '30days' ? ' (Last 30 Days)' : ' (All Time)'}`
      : `Messages by Toolkit${timeRange === '7days' ? ' (Last 7 Days)' : timeRange === '30days' ? ' (Last 30 Days)' : ' (All Time)'}`;

  let chartBody: React.ReactNode;
  if (isLoading) {
    chartBody = (
      <div className="h-[300px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  } else if (error) {
    chartBody = (
      <div className="h-[300px] flex items-center justify-center text-red-500">Error: {error}</div>
    );
  } else if (!data.length) {
    chartBody = (
      <div className="h-[300px] flex items-center justify-center text-gray-500">
        No data available for the selected time period
      </div>
    );
  } else {
    chartBody = (
      <div className="h-[300px] relative">
        <TimeSeriesChart
          data={data}
          height={300}
          dimensions={dimensions}
          dimension={dimension}
          onLegendClick={(entry) => {
            if (dimension === 'policyId') {
              const dataKey = String(entry.dataKey);
              const policyId = dataKey.replace('counts.', '');
              const newURL = toggleFilterInUrl('policyId', policyId);
              router.push(`/alerts${newURL}`);
            } else if (dimension === 'payloadToolkit') {
              const dataKey = String(entry.dataKey);
              const toolkit = dataKey.replace('counts.', '');
              const newURL = toggleFilterInUrl('payloadToolkit', toolkit);
              router.push(`/messages${newURL}`);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">{title}</h2>
        <Link href={reviewLink} className="text-blue-500 hover:text-blue-700 text-sm font-medium">
          Review
        </Link>
      </div>
      {chartBody}
    </div>
  );
}
