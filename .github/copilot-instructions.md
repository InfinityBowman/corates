# GitHub Copilot Instructions

This file contains instructions for GitHub Copilot to follow when generating code for this project. Please adhere to these guidelines to ensure consistency and maintainability across the codebase. This project is CoRATES (Collaborative Research Appraisal Tool for Evidence Synthesis), a SolidJS-based web application deployed on Cloudflare Workers.

the /web package contains the frontend application built with SolidJS.
the /workers package contains backend services, including API endpoints and database migrations.
the /landing package contains the marketing and landing site.

The web package is copied into the landing package during the build process for deployment and all deployed as a single site on a single worker.

Do not worry about migrations either client side or backend unless specifically instructed to do so in the prompt. This project is not in production and has no users.

## Coding Standards

- Do not use emojis in code, comments, documentation, or commit messages.
- For UI icons, use the `solid-icons` library or SVGs only. Do not use emojis.
- Follow standard JavaScript/SolidJS/Cloudflare best practices.
- Prefer modern ES6+ syntax and features.
- Use aliases for imports when appropriate to improve readability.
- Use responsive design principles for UI components.
- Prefer using config files rather than hardcoding values.
- Place plans in the docs/plans/ directory.
- Ensure browser compatibility for all frontend code (Safari is usually problematic).

## File Size Guidelines

- **Keep files small, focused, and modular.** - If a file exceeds a high number of lines, consider refactoring:
  - Extract sub-modules into a folder (e.g., `ComponentName/` with `index.jsx` and helper components)
  - Move complex logic into separate utility files or primitives
  - Split large forms into section components (see `add-studies/` folder pattern)
- Each file should handle one coherent responsibility
- Group related components in subdirectories with an `index.js` barrel export

## Libraries

Use Zod for schema and input validation (backend).
Use Drizzle ORM for database interactions and migrations.
Use Better-Auth for authentication and user management.
Use Ark UI components from `@corates/ui` package (built with Ark UI and some remaining Zag.js components).

## Documentation Tool

PLEASE USE THE CORATES MCP tools to explore local documentation sources. Use this MCP for all Better-Auth, Drizzle, Icons, and Ark UI documentation. For comprehensive development guides, see the docs site (`packages/docs/`) - run `pnpm docs` to view. For linting, prefer using the MCP.

## UI Components

UI components are in `@corates/ui` package, built with Ark UI (and some remaining Zag.js components). NOT in local components.

```js
// CORRECT - Import from @corates/ui
import { Dialog, Select, Toast, showToast, Avatar } from '@corates/ui';

// WRONG - Don't import from local components
import { Dialog } from '@/components/zag/Dialog.jsx';
```

See `packages/ui/src/components/index.ts` for all available components. Most components have been migrated to Ark UI. Common ones include Dialog, Select, Toast, Avatar, Tabs, Checkbox, Switch, RadioGroup, Tooltip, Popover, Menu, FileUpload, PasswordInput, and more.

## Additional References

- The [Style Guide](/guides/style-guide) in the docs site contains additional style and formatting guidelines.
- See vite.config.js or jsconfig.json for path aliases and build configurations.
- See the [Testing Guide](/guides/testing) in the docs site for testing guidelines and best practices, do NOT add tests unless asked.
- Cloudflare Pages is not used in this project; only Cloudflare Workers is used for backend services and frontend deployments.
- This project is split into multiple packages under the `packages/` directory. Each package may have its own dependencies and configurations. The landing/marketing site, the main app, and the backend services.
- Use the Corates MCP for documentation.
- For comprehensive documentation, see the docs site (`packages/docs/`) - run `pnpm docs` to view guides.

## Database Migrations

- All migrations should go in a single file: `packages/workers/migrations/0001_init.sql`
- Do NOT create separate migration files (e.g., 0002_xxx.sql) since this project is not yet in production
- When adding new tables or schema changes, edit the existing 0001_init.sql file directly

## SolidJS Specific

### State Architecture (Very Important)

To keep the codebase maintainable and avoid prop drilling:

- Do NOT prop-drill application state.
- Shared or cross-feature state must live in external stores under packages/web/src/stores/ or relative to the component file.
- Import stores directly where needed instead of passing values through multiple components.
- Components should receive at most 1–5 props, and only for local configuration, not shared state.
- If a component would need more than 5 props, move the shared data into:
- an external store
- a primitive
- or Solid context (when scoped to a feature)
  ALWAYS prefer the CLEANEST solution.

### Destructuring props

With Solid, destructuring props is not recommended as it can break reactivity. Instead, you should access props directly from the props object, or wrap them in a function to ensure they are always up-to-date:

```js
function MyComponent(props) {
  const { name } = props; // ❌: breaks reactivity and will not update when the prop value changes
  const name = props.name; // ❌: another example of breaking reactivity
  const name = () => props.name; // ✓: by wrapping `props.name` into a function, `name()` always retrieves its current value

  // or
  return <div>{props.name}</div>; // ✓: directly accessing props maintains reactivity
}
```

### Using createMemo for derived values and stores for complex state

When you need to compute a value based on props or state, use `createMemo` to ensure it updates reactively
When you have complex state or state objects, use Solid's `createStore` for better performance and reactivity. Stores are great, use them!

### Primitives

You may create reusable logic in "primitives" (hooks) that can be shared across components. This keeps components clean and focused on rendering.

# Component Guidelines

- Components should be lean and focused.
- They should not implement business logic; move that into:
- stores
- utilities
- primitives
- Never have a component act as a “God component” coordinating multiple large concerns.
