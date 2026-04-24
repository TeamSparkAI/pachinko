import { NextRequest } from 'next/server';
import { handleArcadeFilterWebhook } from '@/lib/webhooks/mcpWebhookFilter';

export const dynamic = 'force-dynamic';

/** Arcade.dev Engine post-hook; see OpenAPI `/webhooks/arcade/post`. */
export async function POST(request: NextRequest) {
  return handleArcadeFilterWebhook(request, 'server');
}
