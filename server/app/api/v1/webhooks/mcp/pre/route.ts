import { NextRequest } from 'next/server';
import { handleMcpWebhookFilter } from '@/lib/webhooks/mcpWebhookFilter';

export const dynamic = 'force-dynamic';

/** Client → server JSON-RPC (e.g. outbound `tools/call`). Tool is identified in `message` / optional `toolName`. */
export async function POST(request: NextRequest) {
  return handleMcpWebhookFilter(request, 'client');
}
