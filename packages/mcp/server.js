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

const docsRoot = path.join(repoRoot, 'docs');

// Cache for the icon manifest
let manifestCache = null;

async function loadManifest() {
  if (!manifestCache) {
    const manifestPath = path.join(__dirname, 'icon-manifest.json');
    manifestCache = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  }
  return manifestCache;
}

async function listLocalDocsWithLlmsTxt() {
  try {
    const entries = await fs.readdir(docsRoot, { withFileTypes: true });
    const docNames = entries
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort((a, b) => a.localeCompare(b));

    const results = [];
    for (const name of docNames) {
      const llmsPath = path.join(docsRoot, name, 'llms.txt');
      try {
        await fs.access(llmsPath);
        results.push({ name, llmsPath });
      } catch {
        // ignore folders without llms.txt
      }
    }

    return results;
  } catch {
    return [];
  }
}

function assertSafeDocName(doc) {
  if (!doc || typeof doc !== 'string') throw new Error('doc is required');
  if (!/^[A-Za-z0-9._-]+$/.test(doc)) {
    throw new Error('Invalid doc name. Use only letters, numbers, dot, underscore, or dash.');
  }
}

// Create the MCP server
const server = new McpServer({
  name: 'corates-mcp',
  version: '1.3.0',
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

server.tool(
  'docs_list',
  'List local documentation sources available under the repo /docs folder (only those with an llms.txt).',
  {},
  async () => {
    const available = await listLocalDocsWithLlmsTxt();

    if (available.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No local docs with llms.txt found under /docs.',
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text:
            'Available local docs (llms.txt):\n\n' +
            available.map(d => `- ${d.name}`).join('\n') +
            '\n\nUse docs_get_llms_txt with one of these names.',
        },
      ],
    };
  },
);

server.tool(
  'docs_get_llms_txt',
  'Return the contents of docs/<doc>/llms.txt from this repository (local-only docs).',
  {
    doc: z.string().describe('Docs folder name under /docs (e.g. "better-auth", "zag")'),
  },
  async ({ doc }) => {
    assertSafeDocName(doc);
    const llmsPath = path.join(docsRoot, doc, 'llms.txt');

    const available = await listLocalDocsWithLlmsTxt();
    const isAllowed = available.some(d => d.name === doc);
    if (!isAllowed) {
      const suggestion =
        available.length ? `\n\nAvailable: ${available.map(d => d.name).join(', ')}` : '';
      return {
        content: [
          {
            type: 'text',
            text: `Unknown doc "${doc}" or missing llms.txt.${suggestion}`,
          },
        ],
      };
    }

    const text = await fs.readFile(llmsPath, 'utf8');
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

// Better Auth documentation base URL
const BETTER_AUTH_BASE_URL = 'https://www.better-auth.com';

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
      // Build the URL - if no path provided, fetch the index
      const url =
        docPath ?
          `${BETTER_AUTH_BASE_URL}/llms.txt/${docPath}`
        : `${BETTER_AUTH_BASE_URL}/llms.txt`;

      const response = await fetch(url);

      if (!response.ok) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to fetch Better Auth docs: ${response.status} ${response.statusText}\nURL: ${url}. Try fetching the index first to see available docs.`,
            },
          ],
        };
      }

      const text = await response.text();

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
        content: [
          {
            type: 'text',
            text: `Error fetching Better Auth docs: ${error.message}`,
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

server.resource('local-docs', 'docs://llms', async () => {
  const available = await listLocalDocsWithLlmsTxt();
  return {
    contents: [
      {
        uri: 'docs://llms',
        mimeType: 'application/json',
        text: JSON.stringify(
          available.map(d => ({ name: d.name })),
          null,
          2,
        ),
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
