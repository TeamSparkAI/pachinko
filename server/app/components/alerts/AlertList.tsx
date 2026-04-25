import React from "react";
import { AlertReadData, AlertFilter } from "@/lib/models/types/alert";
import { Dimensions, Dimension } from "@/app/hooks/useDimensions";
import { getSeverityLevel } from "@/lib/severity";
import { useRouter } from "next/navigation";

interface AlertListProps {
    alerts: AlertReadData[];
    isLoading: boolean;
    hasMore: boolean;
    onLoadMore: () => void;
    initialFilters?: Partial<AlertFilter>;
    dimensions: Dimensions;
}

export function AlertList({
    alerts,
    isLoading,
    hasMore,
    onLoadMore,
    initialFilters = {},
    dimensions,
}: AlertListProps) {
    const router = useRouter();

    if (isLoading && alerts.length === 0) {
        return <p className="text-gray-500">Loading alerts...</p>;
    }

    if (!alerts || alerts.length === 0) {
        return <p className="text-gray-500">No alerts found</p>;
    }

    const navigateToMessage = (messageId: number, alertId: number) => {
        router.push(`/messages/${messageId}?alert=${alertId}`);
    };

    const getDimensionLabel = (dimension: string, value: string) => {
        return dimensions.getLabel(dimension as Dimension, value) || value;
    };

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th
                            scope="col"
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                            Status
                        </th>
                        <th
                            scope="col"
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                            Severity
                        </th>
                        {!("policyId" in initialFilters) && (
                            <th
                                scope="col"
                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                                Policy
                            </th>
                        )}
                        {!("conditionName" in initialFilters) && (
                            <th
                                scope="col"
                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                                Condition
                            </th>
                        )}
                        {!("payloadToolkit" in initialFilters) && (
                            <th
                                scope="col"
                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                                Toolkit
                            </th>
                        )}
                        {!("payloadToolName" in initialFilters) && (
                            <th
                                scope="col"
                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                                Tool
                            </th>
                        )}
                        <th
                            scope="col"
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                            Created
                        </th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {alerts.map((alert) => (
                        <React.Fragment key={alert.alertId}>
                            <tr
                                onClick={() => navigateToMessage(alert.messageId, alert.alertId)}
                                className="hover:bg-gray-50 cursor-pointer"
                            >
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {!alert.seenAt ? (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                            New
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                            Seen
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                    <div className="flex items-center space-x-2">
                                        {getSeverityLevel(alert.policySeverity).icon}
                                        <span className="font-medium">{alert.policySeverity}</span>
                                        <span>-</span>
                                        <span>{getSeverityLevel(alert.policySeverity).name}</span>
                                    </div>
                                </td>
                                {!("policyId" in initialFilters) && (
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {getDimensionLabel("policyId", String(alert.policyId))}
                                    </td>
                                )}
                                {!("conditionName" in initialFilters) && (
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {alert.condition.name}
                                    </td>
                                )}
                                {!("payloadToolkit" in initialFilters) && (
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {alert.payloadToolkit || "—"}
                                    </td>
                                )}
                                {!("payloadToolName" in initialFilters) && (
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {alert.payloadToolName || "—"}
                                    </td>
                                )}
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {new Date(alert.createdAt).toLocaleString()}
                                </td>
                            </tr>
                        </React.Fragment>
                    ))}
                </tbody>
            </table>

            {isLoading && alerts.length > 0 && (
                <div className="text-center py-4">
                    <p className="text-gray-500">Loading more alerts...</p>
                </div>
            )}
            {hasMore && (
                <div className="mt-4 text-center">
                    <button
                        onClick={onLoadMore}
                        disabled={isLoading}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                    >
                        {isLoading ? "Loading..." : "Load More"}
                    </button>
                </div>
            )}
        </div>
    );
}
