import { NextRequest } from 'next/server';
import { handleMcpWebhookFilter } from '@/lib/webhooks/mcpWebhookFilter';

export const dynamic = 'force-dynamic';

/** Server → client JSON-RPC (e.g. tool result / error). */
export async function POST(request: NextRequest) {
  return handleMcpWebhookFilter(request, 'server');
}
