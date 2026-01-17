#!/usr/bin/env node
/**
 * MCP Memory Server
 *
 * Persistent, repository-scoped long-term memory for agentic workloads.
 * Provides tools for agents to search, write, and update durable knowledge.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import path from 'path';
import { fileURLToPath } from 'url';

import { SqliteStorage } from './storage/index.js';
import { LocalEmbeddingService } from './embedding/index.js';
import { registerMemoryTools } from './tools/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve repository root (assumes server is in packages/mcp-memory/dist/)
// In production, this should be passed via environment or args
const repoRoot = process.env.MCP_MEMORY_REPO_ROOT ?? path.resolve(__dirname, '..', '..', '..');

// Create the MCP server
const server = new McpServer({
  name: 'corates-mcp-memory',
  version: '1.0.0',
  description: `Persistent memory for repository knowledge. 
Search before tasks to retrieve facts, decisions, procedures, and patterns.
Propose writes after tasks to preserve durable knowledge.
Server validates all writes - duplicates and low-quality entries are rejected. When making changes to the CoRATES codebase, record decisions and learnings for future reference.`,
});

// Initialize services
const storage = new SqliteStorage(repoRoot);
const embedding = new LocalEmbeddingService();

// Register memory tools
registerMemoryTools(server, { storage, embedding });

// Cleanup on exit
async function cleanup(): Promise<void> {
  await storage.close();
}

// Graceful shutdown with timeout
async function shutdown(signal: string): Promise<void> {
  console.error(`Received ${signal}, shutting down...`);

  const SHUTDOWN_TIMEOUT = 5000;
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Cleanup timed out')), SHUTDOWN_TIMEOUT),
  );

  try {
    await Promise.race([cleanup(), timeoutPromise]);
    console.error('Cleanup completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('Error during cleanup:', err);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

// Start the server
async function main(): Promise<void> {
  // Initialize storage and embedding
  console.error('Initializing storage...');
  await storage.initialize();

  console.error('Initializing embedding model (first run may download model)...');
  await embedding.initialize();

  console.error('Starting MCP Memory Server...');
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('MCP Memory Server started successfully');
  console.error(`Repository root: ${repoRoot}`);
}

main().catch((err: unknown) => {
  console.error('Failed to start MCP Memory Server:', err);
  process.exit(1);
});
