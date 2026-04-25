import { NextRequest } from 'next/server';
import { handleArcadeFilterWebhook } from '@/lib/webhooks/mcpWebhookFilter';

export const dynamic = 'force-dynamic';

/** Arcade.dev Engine pre-hook; see OpenAPI `/webhooks/arcade/pre`. */
export async function POST(request: NextRequest) {
  return handleArcadeFilterWebhook(request, 'client');
}
