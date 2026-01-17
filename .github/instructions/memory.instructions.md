---
applyTo: '**'
description: 'Agent memory system for persistent knowledge across sessions'
---

# Agent Memory System

This repository has a persistent memory system (`@corates/mcp-memory`) that stores durable knowledge across sessions. Memory is stored in `.mcp/memory.db` and shared via git.

## When to Search Memory

**Always search memory before:**

- Starting complex or multi-step tasks
- Making architectural decisions
- Working in unfamiliar areas of the codebase
- Implementing patterns that might already exist

**Example searches:**

```
search_memory({ query: "authentication patterns" })
search_memory({ query: "error handling", types: ["pattern", "decision"] })
search_memory({ query: "database migrations" })
search_memory({ query: "SolidJS props" })
```

## When to Write Memory

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

## When to Update Memory

**Use `propose_memory_update` when:**

- Existing knowledge is outdated or incorrect
- You have additional context to add
- A decision has changed with new rationale
- A procedure needs correction

**Update Actions:**

- `refine` - Update in-place, keeps same ID, increments version
- `supersede` - Create new entry, mark old as replaced (use for major changes)

## Knowledge Types

| Type        | When to Use                          |
| ----------- | ------------------------------------ |
| `fact`      | Objective, verifiable information    |
| `decision`  | Choice with rationale (why X over Y) |
| `procedure` | Step-by-step instructions            |
| `pattern`   | Repeated structure to follow         |

## Memory Tool Reference

### search_memory

Search for relevant knowledge before starting a task.

```json
{
  "query": "authentication patterns",
  "types": ["pattern", "decision"],
  "tags": ["auth"],
  "limit": 10,
  "min_confidence": 0.3
}
```

### propose_memory_write

Submit new durable knowledge.

```json
{
  "type": "decision",
  "title": "Use Better-Auth over Lucia",
  "content": "Better-Auth was chosen because it has native Cloudflare Workers support...",
  "tags": ["auth", "architecture"],
  "source": {
    "type": "discussion",
    "reference": "PR #142"
  }
}
```

### propose_memory_update

Update or replace existing knowledge.

For refinements (minor updates):

```json
{
  "target_id": "uuid-from-search-results",
  "action": "refine",
  "content": "Updated content with new information",
  "justification": "Added details about v2 API changes"
}
```

For supersession (major changes):

```json
{
  "target_id": "uuid-from-search-results",
  "action": "supersede",
  "title": "New Title (v2)",
  "content": "Completely rewritten guidance",
  "justification": "Original approach deprecated in v2"
}
```

## Best Practices

1. **Search before writing** - Check if similar knowledge exists
2. **Be specific** - Titles should be clear and searchable
3. **Include rationale** - Explain why, not just what
4. **Use tags consistently** - Common: `auth`, `database`, `frontend`, `backend`, `architecture`, `patterns`
5. **Update, don't duplicate** - Use `propose_memory_update` for changes
6. **Cite sources** - Include file paths, PR numbers, or discussion references
