#!/usr/bin/env node
/**
 * Corates MCP Server
 * Provides tools for searching solid-icons
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec as execCallback } from 'child_process';
import util from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const exec = util.promisify(execCallback);

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

// Run project lint (pnpm run lint) from repo root
server.tool(
  'run_lint',
  'Run pnpm lint from the repository root. Set fix=true to apply autofixes.',
  {
    fix: z.boolean().optional().default(false).describe('Whether to run lint with --fix'),
  },
  async ({ fix = false }) => {
    const command = `pnpm run lint${fix ? ' -- --fix' : ''}`;

    try {
      const { stdout, stderr } = await exec(command, { cwd: repoRoot, maxBuffer: 4 * 1024 * 1024 });
      const output =
        [stdout, stderr].filter(Boolean).join('\n').trim() || 'Lint completed with no output';
      return {
        content: [
          {
            type: 'text',
            text: `Command: ${command}\n\n${output}`,
          },
        ],
      };
    } catch (error) {
      const stdout = error.stdout || '';
      const stderr = error.stderr || error.message || '';
      const output =
        [stdout, stderr].filter(Boolean).join('\n').trim() || 'Lint failed with no output';
      return {
        content: [
          {
            type: 'text',
            text: `Command: ${command}\nExit code: ${error.code ?? 'unknown'}\n\n${output}`,
          },
        ],
      };
    }
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
