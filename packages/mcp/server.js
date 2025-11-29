#!/usr/bin/env node
/**
 * Corates MCP Server
 * Provides tools for searching solid-icons and Zag.js documentation
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  searchComponents,
  getComponent,
  getComponentDocs,
  listAllComponents,
  getInstallCommand,
} from './zagSearch.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache for the icon manifest
let manifestCache = null;

async function loadManifest() {
  if (!manifestCache) {
    const manifestPath = path.join(__dirname, 'icon-manifest.json');
    manifestCache = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  }
  return manifestCache;
}

// Create the MCP server
const server = new McpServer({
  name: 'corates-mcp',
  version: '1.1.0',
});

// Register the search_icons tool
server.tool(
  'search_icons',
  'Search for icons in solid-icons library by name. Returns matching icon names with their library prefix.',
  {
    query: z.string().describe('Search query to match against icon names (case-insensitive)'),
    limit: z.number().optional().default(20).describe('Maximum number of results to return'),
  },
  async ({ query, limit = 20 }) => {
    const manifest = await loadManifest();
    const q = query.toLowerCase();
    const results = [];

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
        content: [
          {
            type: 'text',
            text: `No icons found matching "${query}"`,
          },
        ],
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

// Register the search_zag_components tool
server.tool(
  'search_zag_docs',
  'Search Zag.js component documentation by name. Returns component info, package name, and documentation URL for Solid.js.',
  {
    query: z.string().describe('Search query to match against component names'),
    limit: z.number().optional().default(10).describe('Maximum number of results to return'),
  },
  async ({ query, limit = 10 }) => {
    const results = await searchComponents(query, limit);

    if (results.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No Zag components found matching "${query}"`,
          },
        ],
      };
    }

    const formatted = results
      .map(r => {
        return `## ${r.name}

**Package:** \`${r.package}\`
**Install:** \`${getInstallCommand(r.package)}\`
**Docs:** ${r.url}`;
      })
      .join('\n\n---\n\n');

    return {
      content: [
        {
          type: 'text',
          text: `Found ${results.length} Zag components matching "${query}":\n\n${formatted}\n\nUse \`get_zag_component\` to get full documentation for a specific component.`,
        },
      ],
    };
  },
);

// Register the get_zag_component tool for detailed info
server.tool(
  'get_zag_component',
  'Get complete Zag.js documentation for a specific component including anatomy, machine context, API methods, data attributes, and usage examples for Solid.js.',
  {
    component: z
      .string()
      .describe('Component name or key (e.g., "accordion", "date-picker", "dialog", "switch")'),
  },
  async ({ component }) => {
    const comp = await getComponent(component);

    if (!comp) {
      // Try to find similar components
      const similar = await searchComponents(component, 3);
      const suggestions = similar.map(s => s.name).join(', ');

      return {
        content: [
          {
            type: 'text',
            text: `Component "${component}" not found. Did you mean: ${suggestions || 'No suggestions available'}`,
          },
        ],
      };
    }

    // Get the full documentation content
    const docs = await getComponentDocs(component);

    if (!docs) {
      return {
        content: [
          {
            type: 'text',
            text: `## ${comp.name}

**Package:** \`${comp.package}\`
**Install:** \`${getInstallCommand(comp.package)}\`
**Documentation:** ${comp.url}

Documentation not found locally. Run \`node scrape-zag.js\` to download docs, or visit the URL above.`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: docs,
        },
      ],
    };
  },
);

// Register the list_zag_components tool
server.tool(
  'list_zag_components',
  'List all available Zag.js components with their package names.',
  {},
  async () => {
    const components = await listAllComponents();

    let text = `# Zag.js Components (${components.length} total)\n\n`;
    text += components.map(c => `- **${c.name}** (\`${c.package}\`)`).join('\n');
    text += '\n\nUse `get_zag_component` with a component name to get full documentation.';

    return {
      content: [
        {
          type: 'text',
          text,
        },
      ],
    };
  },
);

// Register a resource to list all available icon libraries
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

// Register a resource for Zag components
server.resource('zag-components', 'zag://components', async () => {
  const components = await listAllComponents();

  return {
    contents: [
      {
        uri: 'zag://components',
        mimeType: 'application/json',
        text: JSON.stringify(components, null, 2),
      },
    ],
  };
});

// Start the server with stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Corates MCP Server started');
}

main().catch(err => {
  console.error('Failed to start MCP server:', err);
  process.exit(1);
});
