#!/usr/bin/env node
/**
 * Corates MCP Server
 * Provides tools for icons, linting, and documentation
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Tool registrations
import { registerIconTools } from './tools/icons.js';
import { registerLintTools } from './tools/lint.js';
import { registerLocalDocsTools } from './tools/local-docs.js';
import { registerBetterAuthTools } from './tools/better-auth.js';
import { registerDrizzleTools } from './tools/drizzle.js';
import { registerZagTools } from './tools/zag.js';
import { registerCodeReviewTools } from './tools/code-review.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const docsRoot = path.join(repoRoot, 'docs');

// Create the MCP server
const server = new McpServer({
  name: 'corates-mcp',
  version: '2.0.0',
});

// Register all tools
registerIconTools(server);
registerLintTools(server, repoRoot);
registerLocalDocsTools(server, docsRoot);
registerBetterAuthTools(server);
registerDrizzleTools(server);
registerZagTools(server);
registerCodeReviewTools(server, repoRoot);

// Start the server with stdio transport
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log('Corates MCP Server started');
}

main().catch((err: unknown) => {
  console.error('Failed to start MCP server:', err);
  process.exit(1);
});
