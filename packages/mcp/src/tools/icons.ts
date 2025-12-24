import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { McpServerType } from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface IconManifest {
  [library: string]: string[];
}

interface IconResult {
  lib: string;
  icon: string;
  import: string;
}

// Cache for the icon manifest
let manifestCache: IconManifest | null = null;

async function loadManifest(): Promise<IconManifest> {
  if (!manifestCache) {
    const manifestPath = path.join(__dirname, '..', '..', 'icon-manifest.json');
    const content = await fs.readFile(manifestPath, 'utf8');
    manifestCache = JSON.parse(content) as IconManifest;
  }
  return manifestCache;
}

export function registerIconTools(server: McpServerType): void {
  server.tool(
    'search_icons',
    'Search for icons in solid-icons library by name. Returns matching icon names with their library prefix.',
    {
      query: z.string().describe('Search query to match against icon names (case-insensitive)'),
      limit: z.number().optional().default(20).describe('Maximum number of results to return'),
    },
    async ({ query, limit = 20 }): Promise<{ content: Array<{ type: 'text'; text: string }> }> => {
      const manifest = await loadManifest();
      const q = query.toLowerCase();
      const results: IconResult[] = [];

      for (const [lib, icons] of Object.entries(manifest)) {
        for (const icon of icons) {
          if (icon.toLowerCase().includes(q)) {
            results.push({ lib, icon, import: `import { ${icon} } from 'solid-icons/${lib}';` });
            if (results.length >= limit) break;
          }
        }
        if (results.length >= limit) break;
      }

      if (results.length === 0) {
        return {
          content: [{ type: 'text', text: `No icons found matching "${query}"` }],
        };
      }

      const formatted = results.map(r => `${r.icon} (${r.lib})\n  ${r.import}`).join('\n\n');

      return {
        content: [
          {
            type: 'text',
            text: `Found ${results.length} icons matching "${query}":\n\n${formatted}`,
          },
        ],
      };
    },
  );

  // Resource to list all available icon libraries
  server.resource('icon-libraries', 'icon://libraries', async () => {
    const manifest = await loadManifest();
    const libraries = Object.entries(manifest).map(([abbr, icons]) => ({
      abbreviation: abbr,
      iconCount: icons.length,
    }));

    return {
      contents: [
        {
          uri: 'icon://libraries',
          mimeType: 'application/json',
          text: JSON.stringify(libraries, null, 2),
        },
      ],
    };
  });
}
