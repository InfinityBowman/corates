import { z } from 'zod';
import { CACHE_TTL } from '../constants.js';

const BETTER_AUTH_BASE_URL = 'https://www.better-auth.com';

// Cache for fetched docs
const betterAuthCache = new Map();
let cacheTime = 0;

async function fetchWithCache(url) {
  const now = Date.now();

  // Clear cache if TTL expired
  if (now - cacheTime > CACHE_TTL) {
    betterAuthCache.clear();
    cacheTime = now;
  }

  if (betterAuthCache.has(url)) {
    return betterAuthCache.get(url);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  betterAuthCache.set(url, text);
  return text;
}

export function registerBetterAuthTools(server) {
  server.tool(
    'better_auth_docs',
    'Fetch Better Auth documentation from the official website. Use this to get detailed docs on specific topics like plugins, integrations, authentication providers, etc. Fetch the index to get a summary of all available docs.',
    {
      path: z
        .string()
        .describe(
          'The documentation path to fetch (e.g. "docs/plugins/organization.md", "docs/integrations/hono.md", "docs/concepts/session-management.md"). Omit to get the index.',
        )
        .optional(),
    },
    async ({ path: docPath }) => {
      try {
        const url =
          docPath ?
            `${BETTER_AUTH_BASE_URL}/llms.txt/${docPath}`
          : `${BETTER_AUTH_BASE_URL}/llms.txt`;

        const text = await fetchWithCache(url);

        return {
          content: [
            {
              type: 'text',
              text:
                docPath ?
                  `# Better Auth Documentation: ${docPath}\n\n${text}`
                : `# Better Auth Documentation Index\n\n${text}\n\n---\nUse the path from the index (e.g. "docs/plugins/organization.md") to fetch specific documentation.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error fetching Better Auth docs: ${error.message}` }],
        };
      }
    },
  );
}
