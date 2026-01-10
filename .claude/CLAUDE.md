---
alwaysApply: true
---

# Agent Instructions

This file contains critical instructions for Agents. For detailed patterns, see specialized rule files in this directory.

This project is CoRATES (Collaborative Research Appraisal Tool for Evidence Synthesis), a SolidJS-based web application deployed on Cloudflare Workers.

## Package Structure

The project is split into multiple packages under the `packages/` directory:

- `/web`: Frontend application built with SolidJS
- `/workers`: Backend services, API endpoints, and database migrations
- `/landing`: Marketing and landing site
- `/ui`: Shared UI component library built with Ark UI
- `/shared`: Shared TypeScript utilities and error definitions
- `/mcp`: MCP server for development tools and documentation
- `/docs`: Vitepress docs site containing internal documentation

The web package is copied into the landing package during build and deployed as a single site on one worker.

Do not worry about migrations (client side or backend) unless specifically instructed. This project is not in production and has no users.

## Build Commands

```bash
# Development
pnpm dev:front              # Frontend web app (port 5173 and port 3010)
pnpm dev:workers      # Backend workers (port 8787)
pnpm --filter web build        # Main web SPA frontend
pnpm --filter landing build     # Landing site only

# Testing
pnpm test             # Run all tests
pnpm --filter web test          # Frontend tests only
pnpm --filter workers test              # Backend tests only
pnpm --filter web vitest run path/file  # Single test file

# Code Quality
pnpm lint             # ESLint check
pnpm lint:fix         # Auto-fix lint issues
pnpm format           # Prettier format
pnpm typecheck        # TypeScript check

# Database (workers package)
pnpm --filter workers db:generate    # Generate Drizzle migrations
pnpm --filter workers db:migrate     # Apply migrations locally

# Other
pnpm build            # Build all packages
pnpm docs             # View docs site (port 8080)
pnpm openapi          # Generate OpenAPI schema
pnpm logs             # View production worker logs
```

## Critical Rules

### Coding Standards

- **NEVER use emojis anywhere** - Not in code, comments, documentation, plan files, commit messages, or examples
- This includes unicode symbols, DO NOT USE unicode symbols or emojis anywhere
- For UI icons, use `solid-icons` library or SVGs only (never emojis)
- Prefer modern ES6+ syntax and features
- Use import aliases from jsconfig.json (see ui-components.mdc)
- Prefer config files over hardcoding values
- Place plans/audits in `packages/docs/audits/` directory
- Ensure browser compatibility (Safari is usually problematic)

### File Organization

- Keep files small, focused, and modular
- Extract large files into sub-modules or separate utilities
- Each file should handle one coherent responsibility
- Group related components in subdirectories with barrel exports

### Libraries (MUST USE)

- **Zod**: Schema and input validation (backend)
- **Drizzle ORM**: ALL database interactions and migrations
- **Better-Auth**: Authentication and user management
- **Ark UI**: UI components from `@corates/ui` package
- **solid-icons**: Icon library (e.g., `solid-icons/bi`, `solid-icons/fi`)

### Code Comments

Comments should not repeat what the code is saying. Instead, reserve comments for explaining **why** something is being done, or to provide context that is not obvious from the code itself.

```js
// Bad - narrates what the code does
retries += 1;

// Good - explains why
// Some APIs occasionally return 500s on valid requests. We retry up to 3 times
// before surfacing an error.
retries += 1;
```

**When to Comment:**

- To explain why a particular approach or workaround was chosen
- To clarify intent when the code could be misread or misunderstood
- To provide context from external systems, specs, or requirements
- To document assumptions, edge cases, or limitations

**When Not to Comment:**

- Don't narrate what the code is doing — the code already says that
- Don't duplicate function or variable names in plain English
- Don't leave stale comments that contradict the code
- Don't reference removed or obsolete code paths (e.g. "No longer uses X format")

### UI Components

**Ark UI components are in `@corates/ui` package, NOT in local components.**

```js
// CORRECT
import { Dialog, Select, Toast } from '@corates/ui';

// WRONG
import { Dialog } from '@/components/ark/Dialog.jsx';
```

See `ui-components.mdc` for detailed component usage patterns.

### Database Migrations

- Use DrizzleKit to generate new migrations when necessary
- Do NOT create separate migration files manually (0002_xxx.sql, etc.)
- You must use DrizzleKit, the workers package has a script to generate migrations

### SolidJS Critical Patterns

- **Do NOT prop-drill application state** - Import stores directly where needed
- **Do NOT destructure props** - Access `props.field` directly or wrap in function: `() => props.field`
- Shared state lives in external stores under `packages/web/src/stores/`
- Components should receive at most 1-5 props (local config only, not shared state)
- Use `createStore` for complex state objects
- Use `createMemo` for derived values
- Move business logic to stores, utilities, or primitives (not components)

See `solidjs.mdc` for detailed reactivity patterns and examples.

## Documentation

- **Primary source**: Comprehensive guides are in the docs site (`packages/docs/`) - run `pnpm docs` to view
- **ALWAYS use Corates MCP tools or other MCP** for Better-Auth, Drizzle, Icons, linting, and Ark UI documentation
- **For comprehensive documentation**, see the docs site guides:
  - [Testing Guide](/guides/testing) - Frontend and backend testing patterns, setup, and best practices
  - [Authentication Guide](/guides/authentication) - Setup, configuration, API endpoints, and usage patterns
  - [Database Guide](/guides/database) - Schema management, Drizzle ORM patterns, migrations, and test helpers
  - [State Management](/guides/state-management) - SolidJS store patterns
  - [Primitives](/guides/primitives) - Reusable hooks and primitives
  - [Components](/guides/components) - Component development patterns
  - [API Development](/guides/api-development) - Backend API route patterns
  - [Error Handling](/guides/error-handling) - Error handling patterns
  - [Style Guide](/guides/style-guide) - UI styling guidelines
  - [Configuration](/guides/configuration) - Configuration files and environment variables
  - [Development Workflow](/guides/development-workflow) - Getting started and common tasks

## Specialized Rule Files

For detailed patterns, see:

- `solidjs.mdc` - Reactivity patterns, props, stores, primitives
- `api-routes.mdc` - API route patterns, validation, database operations
- `error-handling.mdc` - Error handling patterns (frontend + backend)
- `ui-components.mdc` - UI component imports and usage
- `workers.mdc` - Workers package specific patterns

### Complex Area Rules

For specific complex areas, see:

- `yjs-sync.mdc` - Yjs synchronization, connection management, sync operations
- `reconciliation.mdc` - Checklist reconciliation, multi-part questions, comparison logic
- `pdf-handling.mdc` - PDF upload, caching, Google Drive integration
- `form-state.mdc` - Form state persistence across OAuth redirects
- `durable-objects.mdc` - Durable Objects patterns for Yjs and WebSocket handling
- `checklist-operations.mdc` - Checklist-specific patterns (AMSTAR2, ROBINS-I)

## Additional Notes

- Cloudflare Pages is NOT used; only Cloudflare Workers
- Packages are under `packages/` directory with their own dependencies
- Path aliases are defined in `packages/web/jsconfig.json`
- Adjust documentation if your changes would affect any existing documentation
