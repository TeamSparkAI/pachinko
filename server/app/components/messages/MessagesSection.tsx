import { useState, useEffect } from "react";
import { MessageListItemData, MessageFilter } from "@/lib/models/types/message";
import { MessageFilters } from "./MessageFilters";
import { MessageList } from "./MessageList";
import { useDimensions, Dimensions } from "@/app/hooks/useDimensions";
import { log } from "@/lib/logging/console";

interface MessagesSectionProps {
    initialFilters?: Partial<MessageFilter>;
    dimensions?: Dimensions;
}

export function MessagesSection({
    initialFilters = {},
    dimensions: providedDimensions,
}: MessagesSectionProps) {
    const [filters, setFilters] = useState<MessageFilter>({
        ...initialFilters,
    });
    const [pendingFilters, setPendingFilters] = useState<MessageFilter>(filters);
    const [showFilters, setShowFilters] = useState(false);
    const [hasPendingChanges, setHasPendingChanges] = useState(false);
    const [messages, setMessages] = useState<MessageListItemData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [cursor, setCursor] = useState<number | undefined>();
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
    const [totalMessages, setTotalMessages] = useState<number>(0);

    const fetchedDimensions = useDimensions({
        dimensions: ["source", "payloadToolkit", "payloadMethod", "payloadToolName"],
        autoFetch: true,
        filters: {
            source: initialFilters.source,
            payloadToolkit: initialFilters.payloadToolkit,
            payloadMethod: initialFilters.payloadMethod,
            payloadToolName: initialFilters.payloadToolName,
        },
    }).dimensions;
    const dimensions = providedDimensions ?? fetchedDimensions;

    const loadMessages = async (
        currentCursor?: number,
        sort: "asc" | "desc" = sortDirection,
        useFilters = pendingFilters
    ) => {
        try {
            log.debug("Loading messages with filters:", useFilters);
            setLoading(true);
            const queryParams = new URLSearchParams();
            Object.entries(useFilters).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== "") {
                    queryParams.append(key, value.toString());
                }
            });
            if (currentCursor) {
                queryParams.append("cursor", currentCursor.toString());
            }
            queryParams.append("sort", sort);

            const url = `/api/v1/messages?${queryParams.toString()}`;
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error("Failed to load messages");
            }
            const data = await response.json();

            if (currentCursor) {
                setMessages((prev) => [...prev, ...data.messages]);
            } else {
                setMessages(data.messages);
            }
            setHasMore(data.pagination.hasMore);
            setCursor(data.pagination.nextCursor);
            setTotalMessages(data.pagination.total);
        } catch (err) {
            log.error("Error loading messages:", err);
            setError(err instanceof Error ? err.message : "Failed to load messages");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMessages();
    }, []);

    const handleFilterChange = (field: keyof MessageFilter, value: string | number | undefined) => {
        const isDropdownChange = [
            "source",
            "payloadToolkit",
            "payloadMethod",
            "payloadToolName",
        ].includes(field);

        const newPendingFilters = { ...pendingFilters, [field]: value };

        if (isDropdownChange) {
            const hasOtherPendingChanges = Object.entries(newPendingFilters).some(
                ([k, v]) => k !== field && v !== filters[k as keyof MessageFilter]
            );
            if (!hasOtherPendingChanges) {
                setPendingFilters(newPendingFilters);
                setFilters(newPendingFilters);
                loadMessages(undefined, sortDirection, newPendingFilters);
                return;
            }
        }

        setPendingFilters(newPendingFilters);
        setHasPendingChanges(true);
    };

    const handleSearch = () => {
        setFilters(pendingFilters);
        setHasPendingChanges(false);
        setCursor(undefined);
        loadMessages(undefined, sortDirection, pendingFilters);
    };

    const handleClear = () => {
        const emptyFilters: MessageFilter = {
            ...initialFilters,
        };
        setPendingFilters(emptyFilters);
        setFilters(emptyFilters);
        setHasPendingChanges(false);
        setCursor(undefined);
        loadMessages(undefined, sortDirection, emptyFilters);
        setShowFilters(false);
    };

    const handleLoadMore = () => {
        loadMessages(cursor);
    };

    const handleSortDirectionChange = () => {
        const newDirection = sortDirection === "desc" ? "asc" : "desc";
        setSortDirection(newDirection);
        setCursor(undefined);
        loadMessages(undefined, newDirection);
    };

    const toggleFilters = () => {
        if (showFilters) {
            handleClear();
        } else {
            setShowFilters(true);
        }
    };

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="text-red-800">Error: {error}</div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">Messages</h2>
                    <button
                        onClick={toggleFilters}
                        className="text-sm text-blue-500 hover:text-blue-700"
                    >
                        {showFilters ? "Clear Filters" : "Filter"}
                    </button>
                </div>
                <div className="flex items-center space-x-4">
                    <button
                        onClick={handleSortDirectionChange}
                        className="text-sm text-blue-500 hover:text-blue-700"
                    >
                        Sort {sortDirection === "asc" ? "↑" : "↓"}
                    </button>
                    <span className="text-sm text-gray-500">
                        {messages.length === 0
                            ? "0 messages"
                            : `${messages.length} of ${totalMessages || "N/A"} messages`}
                    </span>
                </div>
            </div>

            <MessageFilters
                filters={filters}
                onFilterChange={handleFilterChange}
                onSearch={handleSearch}
                onClear={handleClear}
                hasPendingChanges={hasPendingChanges}
                showFilters={showFilters}
                dimensions={dimensions}
                initialFilters={initialFilters}
            />

            <MessageList
                messages={messages}
                isLoading={loading}
                hasMore={hasMore}
                onLoadMore={handleLoadMore}
                dimensions={dimensions}
                initialFilters={initialFilters}
            />
        </div>
    );
}
