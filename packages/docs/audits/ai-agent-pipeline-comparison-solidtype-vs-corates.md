# AI Agent Assistance Pipeline Analysis: SolidType vs CoRATES

**Date:** 2026-01-15
**Purpose:** Comprehensive comparison of AI agent development workflows, tools, and documentation strategies

---

## Executive Summary

Both SolidType and CoRATES are SolidJS-based web applications that have invested significantly in AI agent assistance infrastructure. However, they take fundamentally different approaches:

| Aspect                  | SolidType                                   | CoRATES                                               |
| ----------------------- | ------------------------------------------- | ----------------------------------------------------- |
| **Primary Focus**       | AI-assisted CAD modeling (end-user feature) | AI-assisted development (developer tooling)           |
| **Documentation Style** | Hierarchical, spec-driven                   | Modular, context-scoped                               |
| **Planning Approach**   | Phase-based roadmap                         | Feature-scoped plans                                  |
| **MCP Usage**           | None (uses custom AI integration)           | Extensive (custom MCP server)                         |
| **Agent Instructions**  | Single comprehensive AGENTS.md              | Split: copilot-instructions.md + .cursor/rules/\*.mdc |

---

## 1. Documentation Architecture

### SolidType Approach

SolidType uses a **hierarchical documentation pyramid** with clear reading order:

```
AGENTS.md (Entry Point)
    |
    +-- docs/OVERVIEW.md (Vision & Goals)
    +-- docs/ARCHITECTURE.md (Package Structure)
    +-- docs/STATUS.md (Current State)
    +-- /plan/* (27 Phases)
        |
        +-- Appendices (Testing, Naming, Solver)
    +-- docs/AI-INTEGRATION.md (AI System Spec)
    +-- docs/DOCUMENT-MODEL.md (Yjs Schema)
    +-- docs/TOPOLOGICAL-NAMING.md (Algorithm Design)
    +-- refs/ (Reference Implementations)
```

**Strengths:**

- Clear reading order with explicit dependencies
- "Docs are source of truth" philosophy - code must match docs
- Separate STATUS.md tracks implementation progress vs plan
- Reference implementations directory with download scripts
- Pinned decisions prevent schema drift

**Weaknesses:**

- Single AGENTS.md can be overwhelming (369 lines)
- No context-scoping for different file types
- All rules apply globally regardless of what you're editing

### CoRATES Approach

CoRATES uses a **modular, context-scoped documentation** system:

```
.github/copilot-instructions.md (GitHub Copilot - Always Applied)
    |
.cursor/rules/*.mdc (14 Rule Files)
    |
    +-- corates.mdc (Always Applied - Core Rules)
    +-- api-routes.mdc (Glob: packages/workers/**)
    +-- solidjs.mdc (Glob: packages/web/**, packages/landing/**)
    +-- workers.mdc (Glob: packages/workers/**)
    +-- ui-components.mdc
    +-- error-handling.mdc
    +-- [Domain-specific: yjs-sync, pdf-handling, etc.]
    |
packages/docs/guides/* (14 Comprehensive Guides)
packages/docs/plans/* (Feature Plans)
packages/docs/audits/* (Analysis Documents)
```

**Strengths:**

- Context-aware rules via glob patterns (only relevant rules apply)
- Separation between quick-reference rules and comprehensive guides
- Supports multiple AI tools (Copilot + Cursor)
- Guides can be viewed via docs site (`pnpm docs`)
- Domain-specific rules for complex areas

**Weaknesses:**

- No explicit reading order for new agents
- Rules split across multiple locations can be harder to discover
- No centralized status tracking document

---

## 2. Planning Systems

### SolidType: Phase-Based Roadmap

SolidType uses a **27-phase incremental plan** with clear dependencies:

```
plan/
  00-overview.md          # Architecture philosophy
  01-document-model.md    # Yjs schema
  02-kernel-viewer-wiring.md
  ...
  23-ai-core-infrastructure.md  # 3572 lines!
  24-ai-dashboard.md
  25-ai-sketch.md
  26-ai-modeling.md
  27-user-system-persistence.md
  appendix/
    testing-strategy.md
    naming-strategy.md
    solver-roadmap.md
```

**Plan Structure:**

- Each phase has status indicator (Complete, In Progress, Planned)
- Prerequisites clearly stated
- Goals, implementation details, code examples
- Success criteria defined
- Related documents linked

**Key Pattern - Plan Document Structure:**

```markdown
# Phase N: Feature Name

> **Status:** [Complete|In Progress|Planned]

## Prerequisites

- Phase X: Dependency

## Goals

- Numbered list of deliverables

## Implementation

[Detailed code examples and architecture]

## Success Criteria

1. Functionality works
2. Tests pass
3. No regressions
4. Documentation updated
```

### CoRATES: Feature-Scoped Plans

CoRATES uses **feature-scoped planning documents**:

```
packages/docs/plans/
  frontend-testing-plan.md
  org-billing-implementation.md
  ownership-billing-multitenancy.md
  presence.md
  pricing-model.md
  yjs-awareness.md
  ...
```

**Strengths:**

- Plans are self-contained and discoverable
- Can work on multiple features independently
- Audits separate from plans (audits/ vs plans/)

**Weaknesses:**

- No clear phase ordering or dependencies
- No centralized status tracking
- No explicit success criteria format

---

## 3. MCP Server Implementation

### SolidType

SolidType does **NOT use MCP** for development assistance. Instead, it has a comprehensive in-app AI system for end-users:

- TanStack AI integration for chat
- Durable Streams for persistence
- SharedWorker architecture for isolation
- Tool definitions for CAD operations (sketch, modeling)
- System prompts for different contexts

### CoRATES

CoRATES has a **dedicated MCP server** (`packages/mcp/`) for development assistance:

```typescript
// Server structure
server.ts
tools/
  icons.ts          # Search solid-icons library
  lint.ts           # Run pnpm lint
  local-docs.ts     # Access local docs with llms.txt
  better-auth.ts    # Fetch Better-Auth documentation
  stripe.ts         # Fetch Stripe documentation
  drizzle.ts        # Fetch Drizzle ORM documentation
  code-review.ts    # Structured code review with project criteria
  tanstack-query.ts # TanStack Query docs
  tanstack-router.ts
  tanstack-start.ts
```

**Key MCP Tools:**

| Tool               | Purpose                                 |
| ------------------ | --------------------------------------- |
| `search_icons`     | Find icons in solid-icons by name       |
| `run_lint`         | Run linter with optional autofix        |
| `docs_list`        | List local docs with llms.txt           |
| `better_auth_docs` | Fetch Better-Auth documentation         |
| `drizzle_docs`     | Fetch Drizzle ORM documentation         |
| `code_review`      | Project-specific structured code review |

**code_review Tool - Standout Feature:**

The code review tool provides project-specific review criteria with severity levels:

```typescript
// Severity definitions embedded in prompt
CRITICAL: Data corruption, security vulnerabilities, crashes
MODERATE: Architectural debt, maintenance burden, performance
LOW: Clarity, consistency, future maintainability

// Focus areas
- Data & Validation (Zod schemas)
- Database & State (Drizzle patterns)
- Async & Failure Modes
- Security & Trust Boundaries
- Architecture & Design
- Performance & Resource Safety
```

---

## 4. Agent Instruction Patterns

### SolidType AGENTS.md Structure

```markdown
# Welcome, agent

# Reading order (explicit)

# Reference implementations

## 1. Your Responsibilities

## 2. Package & Layer Rules

## 3. Preferred Libraries & Tooling

## 4. Coding Style Guide

## 5. Testing Expectations

## 6. How to Work With the Plan

## 7. Things You Should Not Do

## 8. Summary
```

**Notable Patterns:**

- "If docs conflict with code, docs win"
- `// TODO(agent): ...` comment convention
- Explicit "Things You Should Not Do" section
- Library approval process documented

### CoRATES copilot-instructions.md Structure

```markdown
# Agent Instructions

## Package Structure

## Critical Rules

### Coding Standards

### File Organization

### Libraries (MUST USE)

### Code Comments

### UI Components

### Database Migrations

### SolidJS Critical Patterns

## Documentation

## Specialized Rule Files

## Complex Area Rules

## Additional Notes
```

**Notable Patterns:**

- "NEVER use emojis anywhere" (strict rule)
- References to specialized .mdc files
- Links to comprehensive guides
- MCP tools explicitly mentioned as documentation sources

---

## 5. Reference Material Strategy

### SolidType: Downloaded Source Code

SolidType provides **actual source code** from production CAD systems:

```
refs/
  download-refs.sh
  README.md
    |
    +-- OCCT (Open CASCADE)
    +-- CGAL (Computational Geometry)
    +-- FreeCAD (Topological Naming)
    +-- Fornjot (Rust B-Rep)
```

Each reference has:

- Download script
- Key directories to study
- When to reference
- Key files for specific algorithms

**Advantage:** Agents can study actual implementations of complex algorithms.

### CoRATES: External Documentation Fetching

CoRATES uses **MCP tools to fetch documentation** on-demand:

- better_auth_docs
- drizzle_docs
- tanstack\_\*\_docs
- Local docs with llms.txt format

**Advantage:** Always up-to-date, no repository bloat, contextual fetching.

---

## 6. Testing Documentation

### SolidType

Testing documented in AGENTS.md with clear structure:

```markdown
## 5. Testing Expectations

- TDD-oriented
- tests/ directory alongside src/
- Vitest unit tests
- Guidelines:
  - Fast and deterministic
  - Clear, example-based
  - Use architecture namespacing
```

Also has `appendix/testing-strategy.md` with minimum requirements.

### CoRATES

Comprehensive testing guide at `packages/docs/guides/testing.md` (445 lines):

- Testing philosophy (behavior-driven)
- AAA pattern
- Frontend testing (SolidJS testing library)
- Backend testing (Workers, D1)
- Test fixtures and mocking
- Coverage expectations

---

## 7. Lessons Learned / Recommendations for CoRATES

### Adopt from SolidType

| Feature                | Recommendation                                                                        | Priority |
| ---------------------- | ------------------------------------------------------------------------------------- | -------- |
| **STATUS.md**          | Create a centralized status tracking document showing implementation progress vs plan | High     |
| **Reading Order**      | Add explicit reading order in copilot-instructions.md with numbered list              | Medium   |
| **"Docs win" Policy**  | Explicitly state that documentation is source of truth in instructions                | Medium   |
| **Success Criteria**   | Add success criteria checklist to plan documents                                      | Medium   |
| **TODO Convention**    | Standardize `// TODO(agent): ...` pattern for agent-inserted comments                 | Low      |
| **"Don't Do" Section** | Add explicit anti-patterns section to main instructions                               | Medium   |
| **Phase Dependencies** | If plans have dependencies, make them explicit                                        | Low      |

### Keep CoRATES Strengths

| Feature                  | Why Keep                                                                  |
| ------------------------ | ------------------------------------------------------------------------- |
| **Context-scoped Rules** | Glob patterns prevent irrelevant rules from cluttering context            |
| **MCP Server**           | Dynamic documentation fetching is superior to static copies               |
| **code_review Tool**     | Project-specific review criteria is excellent                             |
| **Separate Guides**      | Comprehensive guides in docs site enable both agent and human consumption |
| **Audit Documents**      | Separation of audits from plans is cleaner                                |

### New Ideas to Implement

1. **Reference Implementations Directory**

   Consider adding a `reference/` directory with curated examples of:
   - Yjs sync patterns from other projects
   - Better-Auth integration examples
   - Cloudflare Workers patterns

2. **Plan Template**

   Create a standardized plan template with:

   ```markdown
   # Plan: [Feature Name]

   **Status:** [Draft|In Progress|Complete]
   **Prerequisites:** [List dependencies]

   ## Goals

   ## Implementation

   ## Success Criteria

   - [ ] Functionality works
   - [ ] Tests pass
   - [ ] Documentation updated

   ## Related Documents
   ```

3. **Agent Onboarding Document**

   Create a short AGENTS.md that provides:
   - 30-second orientation
   - Key reading order
   - Quick "do/don't" reference
   - Links to comprehensive docs

---

## 8. Comparison Matrix

| Category                   | SolidType                           | CoRATES                | Winner             |
| -------------------------- | ----------------------------------- | ---------------------- | ------------------ |
| **Initial Orientation**    | Single AGENTS.md with reading order | Scattered across files | SolidType          |
| **Context Relevance**      | All rules always apply              | Glob-scoped rules      | CoRATES            |
| **Status Tracking**        | Dedicated STATUS.md                 | None                   | SolidType          |
| **Documentation Currency** | Static (can drift)                  | MCP fetches live docs  | CoRATES            |
| **Planning Structure**     | 27 sequential phases                | Feature-scoped plans   | Depends on project |
| **Reference Material**     | Downloadable source code            | External doc fetching  | Both valid         |
| **Code Review**            | Manual                              | MCP tool with criteria | CoRATES            |
| **Multi-Tool Support**     | Single approach                     | Copilot + Cursor       | CoRATES            |
| **Complex Domain Rules**   | Inline in main doc                  | Separate .mdc files    | CoRATES            |
| **Success Criteria**       | Explicit in plans                   | Not standardized       | SolidType          |

---

## 9. Conclusion

Both projects demonstrate mature thinking about AI-assisted development, but optimize for different scenarios:

**SolidType** excels at:

- Onboarding new agents to a complex domain (CAD)
- Maintaining architectural integrity through phases
- Providing reference implementations for complex algorithms

**CoRATES** excels at:

- Context-aware assistance (only relevant rules apply)
- Dynamic documentation access (always current)
- Structured code review with project-specific criteria
- Supporting multiple AI tools simultaneously

### Recommended Actions for CoRATES

1. **Immediate:** Create `packages/docs/STATUS.md` tracking implementation progress
2. **Short-term:** Add reading order to copilot-instructions.md
3. **Short-term:** Standardize plan template with success criteria
4. **Medium-term:** Create brief AGENTS.md as orientation document
5. **Consider:** Add "Things You Should Not Do" section to core instructions
6. **Consider:** Document `// TODO(agent):` convention for agent-inserted comments

The combination of CoRATES's dynamic tooling (MCP server, code review) with SolidType's structured onboarding (reading order, status tracking, explicit policies) would create an optimal AI agent assistance pipeline.
