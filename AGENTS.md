# CoRATES Agent Guide

Welcome, agent. This document provides quick orientation for working in the CoRATES codebase.

---

## Quick Start Reading Order

Read these documents in order before making changes:

1. **This file** - Quick orientation and key rules
2. **[STATUS.md](packages/docs/STATUS.md)** - Current implementation state
3. **[copilot-instructions.md](.github/copilot-instructions.md)** - Detailed coding standards
4. **Relevant guide** from `packages/docs/guides/` for your task
5. **Specialized rules** in `.cursor/rules/*.mdc` (Cursor) or `.github/instructions/*.instructions.md` (VS Code)

---

## What is CoRATES?

CoRATES (Collaborative Research Appraisal Tool for Evidence Synthesis) is a web application for researchers conducting systematic reviews. It enables real-time collaboration on quality appraisals with PDF annotation support.

**Tech Stack:** SolidJS, Cloudflare Workers, D1 (SQLite), R2 (storage), Yjs (CRDT sync), Better-Auth

---

## Package Structure

```
packages/
  web/       # SolidJS frontend application
  workers/   # Cloudflare Workers backend (API, database)
  landing/   # Marketing site (includes web app in build)
  shared/    # Shared TypeScript utilities (@corates/shared)
  mcp/       # MCP server for dev tools (@corates/mcp)
  mcp-memory/ # Persistent agent memory (@corates/mcp-memory)
  docs/      # VitePress documentation site
```

---

## Critical Rules (Do These)

1. **Search memory first** - Call `search_memory` before complex tasks
2. **Use required libraries**: Zod (validation), Drizzle (database), Better-Auth (auth), Ark UI (components)
3. **Import stores directly** - Never prop-drill application state
4. **Never destructure props** - Use `props.field` or `() => props.field`
5. **Use MCP tools** for documentation: `better_auth_docs`, `drizzle_docs`, `search_icons`
6. **Keep files small** - Extract large files into sub-modules
7. **Update docs** if your changes affect documented behavior

---

## Anti-Patterns (Never Do These)

1. **Never use emojis or unicode symbols** - Not in code, comments, docs, or commits
2. **Never bypass Drizzle** for database access
3. **Never manually create migration files** - Use DrizzleKit
4. **Never destructure SolidJS props** - Breaks reactivity
5. **Never prop-drill shared state** - Import stores directly
6. **Never leave code that conflicts with documentation** - Update docs or fix code

---

## Agent TODO Convention

When you need to leave incomplete work or flag something for future attention:

```js
// TODO(agent): Brief description of what needs to be done
// Reference relevant doc section if applicable
```

Use this pattern for:

- Incomplete implementations that need follow-up
- Areas that need human review or decision
- Known limitations in your implementation
- References to documentation sections

---

## Agent Memory System

This repository has a persistent memory system (`@corates/mcp-memory`) that stores durable knowledge across sessions. Memory is stored in `.mcp/memory.db` and shared via git.

### When to Search Memory

**Always search memory before:**

- Starting complex or multi-step tasks
- Making architectural decisions
- Working in unfamiliar areas of the codebase
- Implementing patterns that might already exist

**Example searches:**

- "authentication patterns" before working on auth
- "error handling" before adding try/catch blocks
- "database migrations" before schema changes
- "SolidJS props" before creating components

### When to Write Memory

**Propose memory writes when you discover:**

- A non-obvious fact about the codebase
- The rationale behind an architectural decision
- A multi-step procedure that will be repeated
- A pattern that should be followed consistently

**Do NOT write:**

- Task-specific context (what you're currently working on)
- Temporary workarounds or debugging notes
- Information already in documentation
- Opinions without decisions

### When to Update Memory

**Use `propose_memory_update` when:**

- Existing knowledge is outdated or incorrect
- You have additional context to add
- A decision has changed with new rationale
- A procedure needs correction

**Actions:**

- `refine` - Update in-place, keeps same ID, increments version
- `supersede` - Create new entry, mark old as replaced (use for major changes)

### Knowledge Types

| Type        | When to Use                          |
| ----------- | ------------------------------------ |
| `fact`      | Objective, verifiable information    |
| `decision`  | Choice with rationale (why X over Y) |
| `procedure` | Step-by-step instructions            |
| `pattern`   | Repeated structure to follow         |

### Memory Tool Usage

```
# Before starting work
search_memory({ query: "relevant topic" })

# After discovering durable knowledge
propose_memory_write({
  type: "decision",
  title: "Concise title",
  content: "Detailed explanation with rationale",
  tags: ["relevant", "tags"]
})

# To update existing knowledge
propose_memory_update({
  target_id: "uuid-from-search",
  action: "refine",
  content: "Updated content with corrections",
  justification: "Why this update is needed"
})
```

---

## Documentation Sources

| Source                                   | Purpose                          | Access                    |
| ---------------------------------------- | -------------------------------- | ------------------------- |
| `packages/docs/guides/`                  | Comprehensive development guides | `pnpm docs` or read files |
| `.cursor/rules/*.mdc`                    | Context-scoped rules (Cursor)    | Auto-applied by glob      |
| `.github/instructions/*.instructions.md` | Context-scoped rules (VS Code)   | Auto-applied by applyTo   |
| `packages/docs/STATUS.md`                | Implementation progress          | Read file                 |
| MCP tools                                | External library docs            | Call tool functions       |

---

## Key Documentation

### Always Relevant

- STATUS.md (packages/docs/STATUS.md) - What's implemented, what's planned
- copilot-instructions.md (.github/copilot-instructions.md) - Coding standards

### By Task Type

- **Frontend work**: State Management guide, Components guide, `solidjs.mdc` / `solidjs.instructions.md`
- **Backend work**: API Development guide, Database guide, `api-routes.mdc` / `api-routes.instructions.md`
- **Auth work**: Authentication guide, MCP `better_auth_docs`
- **Org/Project work**: Organizations guide, `organizations.mdc`
- **Yjs/Sync work**: Yjs Sync guide, `yjs-sync.mdc`, `durable-objects.mdc`
- **Testing**: Testing guide, `workers-testing.mdc`

---

## Success Criteria

Before considering work complete:

- [ ] Code follows patterns in relevant `.mdc` rules
- [ ] Required libraries used (Zod, Drizzle, Better-Auth, Ark UI)
- [ ] No emojis or unicode symbols anywhere
- [ ] Tests added for new functionality (when applicable)
- [ ] Documentation updated if behavior changed
- [ ] No prop-drilling of shared state
- [ ] SolidJS reactivity preserved (no prop destructuring)

---

## Getting Help

1. **MCP Tools**: Use for Better-Auth, Drizzle, TanStack, Stripe, icon search
2. **Docs Site**: Run `pnpm docs` to browse comprehensive guides
3. **Code Review Tool**: Use `code_review` MCP tool for structured feedback
4. **Specialized Rules**: Check `.cursor/rules/` for domain-specific patterns
