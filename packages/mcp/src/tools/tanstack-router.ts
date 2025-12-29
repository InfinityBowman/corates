import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { CACHE_TTL } from '../constants.js';
import type { McpServerType } from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROUTER_BASE_URL = 'https://raw.githubusercontent.com/TanStack/router/main/docs/router/framework';
const ROUTER_START_BASE_URL = 'https://raw.githubusercontent.com/TanStack/router/main/docs/start/framework';

interface DocsManifest {
  [framework: string]: string[];
}

// Cache for fetched docs
const routerCache = new Map<string, string>();
let cacheTime = 0;

// Cache for manifest
let manifestCache: DocsManifest | null = null;

async function loadManifest(): Promise<DocsManifest> {
  if (!manifestCache) {
    const manifestPath = path.join(__dirname, '..', '..', 'tanstack-router-manifest.json');
    try {
      const content = await fs.readFile(manifestPath, 'utf8');
      manifestCache = JSON.parse(content) as DocsManifest;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load router manifest: ${errorMessage}`);
    }
  }
  return manifestCache;
}

async function fetchWithCache(url: string): Promise<string> {
  const now = Date.now();

  // Clear cache if TTL expired
  if (now - cacheTime > CACHE_TTL) {
    routerCache.clear();
    cacheTime = now;
  }

  if (routerCache.has(url)) {
    return routerCache.get(url)!;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  routerCache.set(url, text);
  return text;
}

function generateIndex(manifest: DocsManifest, framework: string): string {
  const paths = manifest[framework] || [];
  if (paths.length === 0) {
    return `No documentation found for framework "${framework}".`;
  }

  // Group paths by first segment (e.g., "api", "guide", "routing")
  const groups = new Map<string, string[]>();

  for (const docPath of paths) {
    const firstSegment = docPath.split('/')[0];
    if (!groups.has(firstSegment)) {
      groups.set(firstSegment, []);
    }
    groups.get(firstSegment)!.push(docPath);
  }

  const sortedGroups = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  let index = `# TanStack Router Documentation Index (${framework})\n\n`;
  index += `Available documentation (${paths.length} topics):\n\n`;

  for (const [group, groupPaths] of sortedGroups) {
    index += `## ${group}\n\n`;
    for (const p of groupPaths.sort()) {
      index += `- [${p}](${p})\n`;
    }
    index += '\n';
  }

  index += `---\n\nUse the path (e.g. "api/router", "guide/getting-started") to fetch specific documentation.`;

  return index;
}

export function registerTanStackRouterTools(server: McpServerType): void {
  server.tool(
    'tanstack_router_docs',
    'Fetch TanStack Router documentation from GitHub. Returns an index of all topics when no path is provided, or specific documentation when a path is given. Defaults to Solid framework.',
    {
      path: z
        .string()
        .describe(
          'The documentation path to fetch (e.g. "api/router", "guide/getting-started", "routing/file-based"). Omit to get the index of all available docs.',
        )
        .optional(),
      framework: z
        .enum(['solid'])
        .describe('Framework to use - "solid" (default)')
        .optional()
        .default('solid'),
    },
    async ({
      path: docPath,
      framework = 'solid',
    }): Promise<{ content: Array<{ type: 'text'; text: string }> }> => {
      try {
        const manifest = await loadManifest();

        if (!docPath) {
          const index = generateIndex(manifest, framework);
          return { content: [{ type: 'text', text: index }] };
        }

        // Check if path exists in manifest
        const frameworkPaths = manifest[framework] || [];
        let matchedPath: string | null = null;

        // Exact match
        if (frameworkPaths.includes(docPath)) {
          matchedPath = docPath;
        } else {
          // Partial match - find paths that include the search term
          const matches = frameworkPaths.filter(
            p => p.includes(docPath) || p.startsWith(docPath),
          );

          if (matches.length === 1) {
            matchedPath = matches[0];
          } else if (matches.length > 1) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Multiple matches found for "${docPath}":\n\n${matches.map(m => `- ${m}`).join('\n')}\n\nPlease specify the exact path.`,
                },
              ],
            };
          }
        }

        if (!matchedPath) {
          return {
            content: [
              {
                type: 'text',
                text: `No documentation found for "${docPath}" in ${framework} framework. Try fetching the index (omit the path parameter) to see all available topics.`,
              },
            ],
          };
        }

        // Check if this is a Start integration doc (prefixed with "start/")
        const isStartDoc = matchedPath.startsWith('start/');
        const baseUrl = isStartDoc ? ROUTER_START_BASE_URL : ROUTER_BASE_URL;
        // Remove "start/" prefix for the actual file path
        const filePath = isStartDoc ? matchedPath.replace('start/', '') : matchedPath;

        const url = `${baseUrl}/${framework}/${filePath}.md`;
        const text = await fetchWithCache(url);

        return {
          content: [
            {
              type: 'text',
              text: `# TanStack Router: ${matchedPath} (${framework})\n\n${text}`,
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error fetching TanStack Router docs: ${errorMessage}` }],
        };
      }
    },
  );
}
