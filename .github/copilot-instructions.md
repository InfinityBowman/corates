# Agent Instructions

This file contains critical instructions for Agents. For detailed patterns, see specialized rule files in this directory.

This project is CoRATES (Collaborative Research Appraisal Tool for Evidence Synthesis), a React/TanStack Start web application deployed on Cloudflare Workers.

## Reading Order

Before making changes, read these documents in order:

1. **This file** - Core coding standards and critical rules
2. **STATUS.md** (packages/docs/STATUS.md) - Current implementation state and known gaps
3. **AGENTS.md** (root) - Quick orientation and success criteria
4. **Relevant guide** from `packages/docs/guides/` for your task

**Source of Truth Policy**: Documentation is authoritative. If code conflicts with documentation, either fix the code or update the documentation - never leave them out of sync.

## Package Structure

The project is split into multiple packages under the `packages/` directory:

- `/landing`: Frontend application built with React, TanStack Start, TanStack Router (deployed on Cloudflare Workers)
- `/workers`: Backend services, API endpoints, and database migrations
- `/shared`: Shared TypeScript utilities and error definitions
- `/mcp`: MCP server for development tools and documentation
- `/docs`: Vitepress docs site containing internal documentation

The landing package is the main frontend. It is deployed as a single Cloudflare Worker.

Do not worry about migrations (client side or backend) unless specifically instructed. This project is not in production and has no users.

## Build Commands

```bash
# Development
pnpm dev:front              # Frontend (port 3010)
pnpm dev:workers            # Backend workers (port 8787)
pnpm --filter landing build # Build frontend

# Testing
pnpm --filter landing test              # Frontend unit tests
pnpm --filter workers test              # Backend tests only
pnpm --filter landing test:browser      # Browser integration tests

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
- For UI icons, use `lucide-react` library or SVGs only (never emojis)
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
- **shadcn/ui**: UI components (Radix-based, in `@/components/ui/`)
- **lucide-react**: Icon library
- **TanStack Router**: File-based routing (`createFileRoute`)
- **TanStack Query**: Server state management (`useQuery`, `useMutation`)
- **Zustand**: Client state management (stores in `@/stores/`)
- **Recharts**: Data visualization (admin charts)

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

### Database Migrations

- Use DrizzleKit to generate new migrations when necessary
- Do NOT create separate migration files manually (0002_xxx.sql, etc.)
- You must use DrizzleKit, the workers package has a script to generate migrations

### React Patterns

- **Import stores directly** - Use Zustand stores from `@/stores/` instead of prop-drilling shared state
- Shared state lives in Zustand stores under `packages/landing/src/stores/`
- Use `useMemo` for derived values, `useCallback` for stable callbacks
- Use `useEffect` with explicit dependency arrays (never omit deps)
- Use `useLayoutEffect` for DOM measurements before paint
- Use `useSyncExternalStore` for external store subscriptions (e.g., Yjs awareness)
- Use `useId()` for unique IDs on form elements (radio buttons, checkboxes)
- Move business logic to stores, hooks, or utilities (not components)
- Path aliases: `@/` maps to `packages/landing/src/`

## Documentation

- **Primary source**: Comprehensive guides are in the docs site (`packages/docs/`) - run `pnpm docs` to view
- **ALWAYS use Corates MCP tools or other MCP** for Better-Auth, Drizzle, Icons, linting, and Ark UI documentation
- **For comprehensive documentation**, see the docs site guides in `packages/docs/guides/`:
  - testing.md - Frontend and backend testing patterns, setup, and best practices
  - authentication.md - Setup, configuration, API endpoints, and usage patterns
  - database.md - Schema management, Drizzle ORM patterns, migrations, and test helpers
  - state-management.md - Zustand store patterns
  - primitives.md - Reusable hooks and primitives
  - components.md - Component development patterns
  - api-development.md - Backend API route patterns
  - error-handling.md - Error handling patterns
  - style-guide.md - UI styling guidelines
  - configuration.md - Configuration files and environment variables
  - development-workflow.md - Getting started and common tasks

## Specialized Rule Files

For detailed patterns, see:

- `api-routes.mdc` - API route patterns, validation, database operations
- `error-handling.mdc` - Error handling patterns (frontend + backend)
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
- Path aliases: `@/` maps to `packages/landing/src/` (defined in tsconfig.json)
- Adjust documentation if your changes would affect any existing documentation

## Anti-Patterns (Never Do These)

1. **Never use emojis or unicode symbols** - Not in code, comments, docs, or commits
2. **Never bypass Drizzle** for database access
3. **Never manually create migration files** - Use DrizzleKit only
4. **Never prop-drill shared state** - Import Zustand stores directly
5. **Never leave code that conflicts with documentation** - Update docs or fix code

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

## Browser Automation

Use `agent-browser` for web automation. Run `agent-browser --help` for all commands.

Core workflow:

1. `agent-browser open <url>` - Navigate to page
2. `agent-browser snapshot -i` - Get interactive elements with refs (@e1, @e2)
3. `agent-browser click @e1` / `fill @e2 "text"` - Interact using refs
4. Re-snapshot after page changes

