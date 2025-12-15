import { z } from 'zod';
import { CACHE_TTL } from '../constants.js';

const DRIZZLE_DOCS_URL = 'https://orm.drizzle.team/llms-full.txt';

// Cache for parsed Drizzle docs
let drizzleDocsCache = null;
let drizzleCacheTime = 0;

/**
 * Fetch and parse Drizzle docs from remote URL
 * Parses into sections by "Source:" markers
 */
async function fetchDrizzleDocs() {
  const now = Date.now();
  if (drizzleDocsCache && now - drizzleCacheTime < CACHE_TTL) {
    return drizzleDocsCache;
  }

  const response = await fetch(DRIZZLE_DOCS_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch Drizzle docs: ${response.status} ${response.statusText}`);
  }

  const content = await response.text();
  const lines = content.split('\n');

  // Find header (before first Source:)
  let headerEnd = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('Source: https://orm.drizzle.team/docs/')) {
      headerEnd = i;
      break;
    }
  }
  const header = lines.slice(0, headerEnd).join('\n').trim();

  // Parse sections by Source: markers
  const sections = new Map();
  let currentPath = null;
  let currentLines = [];

  for (let i = headerEnd; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('Source: https://orm.drizzle.team/docs/')) {
      if (currentPath) {
        sections.set(currentPath, currentLines.join('\n').trim());
      }
      const url = line.replace('Source: ', '');
      currentPath = url.replace('https://orm.drizzle.team/docs/', '');
      currentLines = [line];
    } else if (currentPath) {
      currentLines.push(line);
    }
  }

  if (currentPath) {
    sections.set(currentPath, currentLines.join('\n').trim());
  }

  drizzleDocsCache = { header, sections };
  drizzleCacheTime = now;
  return drizzleDocsCache;
}

/**
 * Generate an index of all Drizzle doc sections grouped by category
 */
function generateDrizzleIndex(header, sections) {
  const groups = new Map();

  for (const docPath of sections.keys()) {
    const firstSegment = docPath.split('/')[0];
    if (!groups.has(firstSegment)) {
      groups.set(firstSegment, []);
    }
    groups.get(firstSegment).push(docPath);
  }

  const sortedGroups = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  let index = `# Drizzle ORM Documentation Index\n\n`;
  index += `${header}\n\n`;
  index += `## Available Documentation (${sections.size} topics)\n\n`;

  for (const [group, paths] of sortedGroups) {
    index += `### ${group}\n\n`;
    for (const p of paths.sort()) {
      index += `- [${p}](${p})\n`;
    }
    index += '\n';
  }

  index += `---\n\nUse the path (e.g. "select", "insert", "connect-cloudflare-d1", "drizzle-kit-migrate", "relations") to fetch specific documentation.`;

  return index;
}

export function registerDrizzleTools(server) {
  server.tool(
    'drizzle_docs',
    'Fetch Drizzle ORM documentation. Returns an index of all topics when no path is provided, or specific documentation when a path is given. Use this for schema definitions, queries, migrations, connections, and all Drizzle ORM features.',
    {
      path: z
        .string()
        .describe(
          'The documentation path to fetch (e.g. "select", "insert", "connect-cloudflare-d1", "drizzle-kit-migrate", "relations"). Omit to get the index of all available docs.',
        )
        .optional(),
    },
    async ({ path: docPath }) => {
      try {
        const { header, sections } = await fetchDrizzleDocs();

        if (!docPath) {
          const index = generateDrizzleIndex(header, sections);
          return { content: [{ type: 'text', text: index }] };
        }

        // Exact match
        if (sections.has(docPath)) {
          return {
            content: [
              { type: 'text', text: `# Drizzle ORM: ${docPath}\n\n${sections.get(docPath)}` },
            ],
          };
        }

        // Partial match
        const matches = [...sections.keys()].filter(
          p => p.includes(docPath) || p.startsWith(docPath),
        );

        if (matches.length === 1) {
          return {
            content: [
              { type: 'text', text: `# Drizzle ORM: ${matches[0]}\n\n${sections.get(matches[0])}` },
            ],
          };
        }

        if (matches.length > 1) {
          return {
            content: [
              {
                type: 'text',
                text: `Multiple matches found for "${docPath}":\n\n${matches.map(m => `- ${m}`).join('\n')}\n\nPlease specify the exact path.`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `No documentation found for "${docPath}". Try fetching the index (omit the path parameter) to see all available topics.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error fetching Drizzle docs: ${error.message}` }],
        };
      }
    },
  );
}
