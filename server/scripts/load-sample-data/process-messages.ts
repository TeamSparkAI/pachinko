import { MessageFilterService } from '@/lib/services/messageFilter';
import { validateJsonRpcMessage } from '@/lib/jsonrpc';
import { MessageFilterContext } from '@/lib/types/messageFilterContext';

export async function processMessages(
  filterContext: MessageFilterContext,
  serverName: string,
  messages: any[],
  timestamp: Date
) {
    const sessionName = `test-${Date.now()}`;
    let messageCount = 0;
    for (const message of messages) {
        // Bump timestamp by a very small increment (10 to 1000ms per message)
        timestamp = new Date(timestamp.getTime() + (Math.random() * 990) + 10);
        await MessageFilterService.processMessage(
            filterContext,
            sessionName,
            validateJsonRpcMessage(message.origin, message.payload),
            timestamp
        );
        messageCount++;
    }
    return messageCount;
} 