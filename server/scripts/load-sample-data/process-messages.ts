import { MessageFilterService } from "@/lib/services/messageFilter";
import { MessageOrigin, validateJsonRpcMessage } from "@/lib/jsonrpc";
import { MessageFilterContext } from "@/lib/types/messageFilterContext";

/** Deep-clone payload and prefix JSON-RPC `id` so each replay batch has unique `payloadMessageId`s. */
function payloadWithReplayScopedIds(payload: unknown, replayBatchSeq: number): unknown {
    const cloned = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
    if (!cloned || typeof cloned !== "object") {
        return cloned;
    }
    if (!("id" in cloned) || cloned.id === undefined || cloned.id === null) {
        return cloned;
    }
    const id = cloned.id;
    if (typeof id !== "string" && typeof id !== "number") {
        return cloned;
    }
    cloned.id = `${replayBatchSeq}.${id}`;
    return cloned;
}

export async function processMessages(
    filterContext: MessageFilterContext,
    messages: unknown[],
    timestamp: Date,
    replayBatchSeq: number
) {
    let messageCount = 0;
    for (const message of messages) {
        const row = message as { origin: MessageOrigin; payload: unknown };
        timestamp = new Date(timestamp.getTime() + (Math.random() * 990) + 10);
        const payload = payloadWithReplayScopedIds(row.payload, replayBatchSeq);
        await MessageFilterService.processMessage(
            filterContext,
            validateJsonRpcMessage(row.origin, payload),
            timestamp
        );
        messageCount++;
    }
    return messageCount;
}
