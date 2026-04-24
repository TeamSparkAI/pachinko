import { MessageListItemData, MessageFilter } from "@/lib/models/types/message";
import { Dimensions, Dimension } from "@/app/hooks/useDimensions";
import { useRouter } from "next/navigation";

interface MessageListProps {
    messages: MessageListItemData[];
    isLoading: boolean;
    hasMore: boolean;
    onLoadMore: () => void;
    initialFilters?: Partial<MessageFilter>;
    dimensions: Dimensions;
}

export function MessageList({
    messages,
    isLoading,
    hasMore,
    onLoadMore,
    initialFilters = {},
    dimensions,
}: MessageListProps) {
    const router = useRouter();

    if (isLoading && messages.length === 0) {
        return <p className="text-gray-500">Loading messages...</p>;
    }

    if (!messages || messages.length === 0) {
        return <p className="text-gray-500">No messages found</p>;
    }

    const navigateToMessage = (messageId: number) => {
        router.push(`/messages/${messageId}`);
    };

    const sourceLabel = (source: string | null) => {
        if (!source) return "—";
        return dimensions.getLabel("source" as Dimension, source) || source;
    };

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        {!("source" in initialFilters) && (
                            <th
                                scope="col"
                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                                Source
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
                        {!("payloadMethod" in initialFilters) && (
                            <th
                                scope="col"
                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                                Method
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
                            Alert
                        </th>
                        <th
                            scope="col"
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                            Timestamp
                        </th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {messages.map((message) => (
                        <tr
                            key={message.messageId}
                            onClick={() => navigateToMessage(message.messageId)}
                            className="hover:bg-gray-50 cursor-pointer"
                        >
                            {!("source" in initialFilters) && (
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {sourceLabel(message.source)}
                                </td>
                            )}
                            {!("payloadToolkit" in initialFilters) && (
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {message.payloadToolkit || "—"}
                                </td>
                            )}
                            {!("payloadMethod" in initialFilters) && (
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                    <div className="flex items-center space-x-2">
                                        {message.hasError && (
                                            <svg
                                                className="h-4 w-4 text-red-500"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                                />
                                            </svg>
                                        )}
                                        <span>{message.payloadMethod || "-"}</span>
                                    </div>
                                </td>
                            )}
                            {!("payloadToolName" in initialFilters) && (
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {message.payloadToolName || "-"}
                                </td>
                            )}
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                {message.alerts ? (
                                    <svg
                                        className="h-5 w-5 text-red-500"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                                        />
                                    </svg>
                                ) : (
                                    "-"
                                )}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                {new Date(message.timestamp).toLocaleString()}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {isLoading && messages.length > 0 && (
                <div className="text-center py-4">
                    <p className="text-gray-500">Loading more messages...</p>
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
