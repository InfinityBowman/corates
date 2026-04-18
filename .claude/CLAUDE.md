# Agent Instructions

NEVER commit anything, the user will decide what and when to commit, you may request the user commit if you have a need for something to be committed

This file contains critical instructions for Agents. For detailed patterns, see specialized rule files in this directory.

This project is CoRATES (Collaborative Research Appraisal Tool for Evidence Synthesis), a React/TanStack Start web application deployed on Cloudflare Workers.

When making breaking changes inform the user so we can decide if migration/bridge code is necessary or not.

**Source of Truth Policy**: If code conflicts with documentation, inform the user and either fix the code or update the documentation - never leave them out of sync.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## Build Commands

NEVER START ANY DEV SERVERS

```bash
# Development
pnpm --filter web build # Build frontend

# Testing
pnpm --filter web test              # Frontend unit tests
pnpm --filter workers test              # Backend tests only
pnpm --filter web test:e2e      # e2e tests, ask user to make sure dev server is running first

# Code Quality
pnpm lint             # ESLint check
pnpm lint:fix         # Auto-fix lint issues
pnpm format           # Prettier format
pnpm typecheck        # TypeScript check
pnpm run deploy       # pnpm deploy is reserved so use 'run', always ask user before running a deploy command
```

## Critical Rules

### Coding Standards

- **NEVER use emojis anywhere** - Not in code, comments, documentation, plan files, commit messages, or examples
- This includes unicode symbols, DO NOT USE unicode symbols or emojis anywhere
- For UI icons, use `lucide-react` library or SVGs only (never emojis)
- Use import aliases from tsconfig.json
- Prefer config files over hardcoding values
- Place plans/audits in `packages/docs/audits/` directory
- Ensure browser compatibility (Safari is usually problematic)

- Keep files small, focused, and modular
- Extract large files into sub-modules or separate utilities
- Each file should handle one coherent responsibility
- Group related components
- CLoudflare recommend .env over .dev.vars

### Static Assets and Edge Configuration

Two files in `packages/web/public/` are consumed by Cloudflare Workers Static Assets at deploy time. They follow the Cloudflare Pages convention and are easy to miss because they are not TypeScript. See `docs/guides/seo.md` for more.

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

- Don't narrate what the code is doing - the code already says that
- Don't duplicate function or variable names in plain English
- Don't leave stale comments that contradict the code
- Don't reference removed or obsolete code paths (e.g. "No longer uses X format")

### React Patterns

- **Import stores directly** - Use Zustand stores from `@/stores/` instead of prop-drilling shared state
- Shared state lives in Zustand stores under `packages/web/src/stores/`
- Use `useMemo` for derived values, `useCallback` for stable callbacks
- Use `useEffect` with explicit dependency arrays (never omit deps)
- Use `useLayoutEffect` for DOM measurements before paint
- Use `useSyncExternalStore` for external store subscriptions (e.g., Yjs awareness)
- Use `useId()` for unique IDs on form elements (radio buttons, checkboxes)
- Move business logic to stores, hooks, or utilities (not components)
- Path aliases: `@/` maps to `packages/web/src/`

## Documentation

- **External library docs**: Prefer reading source from cloned upstream repos in the `reference/` directory over ad-hoc web fetches. If a library isn't there yet and you need its source, clone it in with `git clone --depth 20 https://github.com/owner/repo.git reference/repo`. This works better than MCP-style doc fetchers for deep questions.
- **TanStack documentation**: Use the TanStack CLI: `npx @tanstack/cli search-docs "<query>" --library <router|start|query> --framework react --json`
- **Hono documentation**: Use the `hono` CLI for Hono docs. Run `hono docs [path]` to view docs, `hono search <query>` to fuzzy search, or `hono --help` for all commands

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
