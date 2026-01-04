import { z } from 'zod';
import { CACHE_TTL } from '../constants.js';
import type { McpServerType } from '../types.js';

const STRIPE_BASE_URL = 'https://docs.stripe.com';

// Cache for fetched docs
const stripeCache = new Map<string, string>();
let cacheTime = 0;

async function fetchWithCache(url: string): Promise<string> {
  const now = Date.now();

  // Clear cache if TTL expired
  if (now - cacheTime > CACHE_TTL) {
    stripeCache.clear();
    cacheTime = now;
  }

  if (stripeCache.has(url)) {
    return stripeCache.get(url)!;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  stripeCache.set(url, text);
  return text;
}

export function registerStripeTools(server: McpServerType): void {
  server.tool(
    'stripe_docs',
    'Fetch Stripe documentation from the official website. Use this to get detailed docs on API endpoints, products, payments, subscriptions, webhooks, etc. Fetch the index to get a summary of all available docs.',
    {
      path: z
        .string()
        .describe(
          'The documentation path to fetch (e.g. "api/products", "payments/checkout", "webhooks"). Omit to get the index.',
        )
        .optional(),
    },
    async ({ path: docPath }): Promise<{ content: Array<{ type: 'text'; text: string }> }> => {
      try {
        const url = docPath ? `${STRIPE_BASE_URL}/${docPath}.md` : `${STRIPE_BASE_URL}/llms.txt`;

        const text = await fetchWithCache(url);

        return {
          content: [
            {
              type: 'text',
              text:
                docPath ?
                  `# Stripe Documentation: ${docPath}\n\n${text}`
                : `# Stripe Documentation Index\n\n${text}\n\n---\nUse the path from the index (e.g. "api/products", "payments/checkout") to fetch specific documentation.`,
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error fetching Stripe docs: ${errorMessage}` }],
        };
      }
    },
  );
}
