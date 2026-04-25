import React from "react";
import { Dimensions } from "@/app/hooks/useDimensions";
import { MessageFilter } from "@/lib/models/types/message";

interface MessageFiltersProps {
    filters: MessageFilter;
    initialFilters?: Partial<MessageFilter>;
    onFilterChange: (field: keyof MessageFilter, value: string | number | undefined) => void;
    onSearch: () => void;
    onClear: () => void;
    hasPendingChanges: boolean;
    showFilters: boolean;
    dimensions: Dimensions;
}

export function MessageFilters({
    filters,
    initialFilters = {},
    onFilterChange,
    onSearch,
    onClear,
    hasPendingChanges,
    showFilters,
    dimensions,
}: MessageFiltersProps) {
    if (!showFilters) {
        return null;
    }

    return (
        <form onSubmit={(e) => e.preventDefault()} className="mb-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-end items-center mb-2">
                <button
                    type="button"
                    onClick={onSearch}
                    disabled={!hasPendingChanges}
                    className={`px-3 py-1 text-sm rounded ${
                        hasPendingChanges
                            ? "bg-blue-500 text-white hover:bg-blue-600"
                            : "bg-gray-200 text-gray-500 cursor-not-allowed"
                    }`}
                >
                    Search
                </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2">
                {!("userId" in initialFilters) && (
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">User ID</label>
                        <select
                            value={filters.userId || ""}
                            onChange={(e) => onFilterChange("userId", e.target.value || undefined)}
                            className="w-full px-1.5 py-1 text-sm border rounded"
                        >
                            <option value="">All users</option>
                            {dimensions
                                .getOptions("userId")
                                .sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()))
                                .map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                        </select>
                    </div>
                )}
                {!("payloadToolkit" in initialFilters) && (
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Toolkit</label>
                        <select
                            value={filters.payloadToolkit || ""}
                            onChange={(e) => onFilterChange("payloadToolkit", e.target.value || undefined)}
                            className="w-full px-1.5 py-1 text-sm border rounded"
                        >
                            <option value="">All toolkits</option>
                            {dimensions
                                .getOptions("payloadToolkit")
                                .sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()))
                                .map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                        </select>
                    </div>
                )}
                {!("payloadToolName" in initialFilters) && (
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Tool</label>
                        <select
                            value={filters.payloadToolName || ""}
                            onChange={(e) => onFilterChange("payloadToolName", e.target.value || undefined)}
                            className="w-full px-1.5 py-1 text-sm border rounded"
                        >
                            <option value="">All tools</option>
                            {dimensions
                                .getOptions("payloadToolName")
                                .sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()))
                                .map((tool) => (
                                    <option key={tool.value} value={tool.value}>
                                        {tool.label}
                                    </option>
                                ))}
                        </select>
                    </div>
                )}
            </div>
        </form>
    );
}
