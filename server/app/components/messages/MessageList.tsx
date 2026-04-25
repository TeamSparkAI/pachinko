import { MessageListItemData, MessageFilter } from "@/lib/models/types/message";
import { useRouter } from "next/navigation";

interface MessageListProps {
    messages: MessageListItemData[];
    isLoading: boolean;
    hasMore: boolean;
    onLoadMore: () => void;
    initialFilters?: Partial<MessageFilter>;
}

/** Hide a list column only when this dimension is actively filtered (non-empty). Keys present with `undefined` do not hide. */
function isPinnedFilter(filters: Partial<MessageFilter>, key: keyof MessageFilter): boolean {
    const v = filters[key];
    return v !== undefined && v !== null && v !== "";
}

export function MessageList({
    messages,
    isLoading,
    hasMore,
    onLoadMore,
    initialFilters = {},
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

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        {!isPinnedFilter(initialFilters, "userId") && (
                            <th
                                scope="col"
                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                                User ID
                            </th>
                        )}
                        {!isPinnedFilter(initialFilters, "payloadToolkit") && (
                            <th
                                scope="col"
                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                                Toolkit
                            </th>
                        )}
                        {!isPinnedFilter(initialFilters, "payloadToolName") && (
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
                            {!isPinnedFilter(initialFilters, "userId") && (
                                <td className="px-4 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                                    {message.userId || "—"}
                                </td>
                            )}
                            {!isPinnedFilter(initialFilters, "payloadToolkit") && (
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {message.payloadToolkit || "—"}
                                </td>
                            )}
                            {!isPinnedFilter(initialFilters, "payloadToolName") && (
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                    <div className="flex items-center space-x-2">
                                        {message.hasError && (
                                            <svg
                                                className="h-4 w-4 text-red-500 flex-shrink-0"
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
                                        <span>{message.payloadToolName || "-"}</span>
                                    </div>
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
