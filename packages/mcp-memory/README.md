# @corates/mcp-memory

Persistent, repository-scoped long-term memory for agentic workloads.

## Overview

This MCP server provides a persistent knowledge base where agents can:

- Search memory before tasks to retrieve relevant context
- Propose durable knowledge after tasks for future reference
- The server validates, deduplicates, and versions all knowledge

Memory is stored in `.mcp/memory.db` and committed to git, so knowledge is shared across all contributors.

## Knowledge Types

| Type          | Description                        | Example                                   |
| ------------- | ---------------------------------- | ----------------------------------------- |
| **Fact**      | Objective, verifiable information  | "The web package uses SolidJS 1.8"        |
| **Decision**  | Intentional choice with rationale  | "We use Zod over Yup for Workers compat"  |
| **Procedure** | Step-by-step operational knowledge | "To add an API route: 1) Create file..."  |
| **Pattern**   | Repeated structure or practice     | "All stores use createStore with actions" |

## Tools

### search_memory

Search for relevant knowledge before starting a task.

```json
{
  "query": "authentication patterns",
  "types": ["pattern", "decision"],
  "limit": 10
}
```

### propose_memory_write

Submit new knowledge for validation and storage.

```json
{
  "type": "decision",
  "title": "Use Better-Auth over Lucia",
  "content": "Better-Auth was chosen because it has native Cloudflare Workers support and built-in organization features.",
  "tags": ["auth", "architecture"],
  "source": {
    "type": "discussion",
    "reference": "PR #142"
  }
}
```

### propose_memory_update

Refine or supersede existing knowledge.

```json
{
  "target_id": "abc-123",
  "action": "supersede",
  "title": "Use Better-Auth over Lucia (v2)",
  "content": "Updated guidance for Better-Auth v2...",
  "justification": "Better-Auth v2 released with breaking changes"
}
```

## Setup

### 1. Build the package

```bash
pnpm --filter @corates/mcp-memory build
```

### 2. Configure your MCP client

#### Claude Code / Cursor

Add to your MCP settings (usually `~/.config/claude/mcp.json` or similar):

```json
{
  "mcpServers": {
    "corates-memory": {
      "command": "node",
      "args": ["/path/to/corates/packages/mcp-memory/dist/server.js"],
      "env": {
        "MCP_MEMORY_REPO_ROOT": "/path/to/corates"
      }
    }
  }
}
```

#### VS Code with Copilot

Add to your workspace `.vscode/mcp.json`:

```json
{
  "servers": {
    "corates-memory": {
      "command": "node",
      "args": ["${workspaceFolder}/packages/mcp-memory/dist/server.js"],
      "env": {
        "MCP_MEMORY_REPO_ROOT": "${workspaceFolder}"
      }
    }
  }
}
```

### 3. First run

The first run will:

1. Create `.mcp/memory.db` if it does not exist
2. Download the embedding model (~50MB, cached locally)

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm --filter @corates/mcp-memory build

# Run tests
pnpm --filter @corates/mcp-memory test

# Watch mode
pnpm --filter @corates/mcp-memory dev
```

## Architecture

```
MCP Server (stdio)
    |
    +-- Tools
    |     +-- search_memory
    |     +-- propose_memory_write
    |     +-- propose_memory_update
    |
    +-- Embedding Service (local, @xenova/transformers)
    |     +-- all-MiniLM-L6-v2 (384 dimensions)
    |
    +-- Storage (SQLite via better-sqlite3)
          +-- .mcp/memory.db
```

## Server Responsibilities

The server handles (agents do not):

- Schema validation
- Duplicate detection (embedding similarity)
- Confidence scoring
- Version management
- Embedding generation

## Environment Variables

| Variable               | Description          | Default                            |
| ---------------------- | -------------------- | ---------------------------------- |
| `MCP_MEMORY_REPO_ROOT` | Repository root path | Auto-detected from server location |
