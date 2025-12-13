# GitHub Copilot Instructions

This file contains instructions for GitHub Copilot to follow when generating code for this project. Please adhere to these guidelines to ensure consistency and maintainability across the codebase. This project is CoRATES (Collaborative Research Appraisal Tool for Evidence Synthesis), a SolidJS-based web application deployed on Cloudflare Workers.

## Coding Standards

- Do not use emojis in code, comments, documentation, or commit messages.
- For UI icons, use the `solid-icons` library or SVGs only. Do not use emojis.
- Follow standard JavaScript/SolidJS/Cloudflare best practices.
- Prefer modern ES6+ syntax and features.
- Use aliases for imports when appropriate to improve readability.
- Use responsive design principles for UI components.
- Prefer using config files rather than hardcoding values.

## File Size Guidelines

- **Keep files small, focused, and modular.** Aim for ~200-300 lines max per component file.
- If a component exceeds ~300 lines, consider refactoring:
  - Extract sub-components into a folder (e.g., `ComponentName/` with `index.jsx` and helper components)
  - Move complex logic into separate utility files or primitives
  - Split large forms into section components (see `add-studies/` folder pattern)
- Each file should handle one coherent responsibility
- Group related components in subdirectories with an `index.js` barrel export

## Icon Search Tool

When you need to find icons from `solid-icons`, use the `search_icons` MCP tool:

- Search by keyword (e.g., "arrow", "check", "user")
- The tool returns icon names with their library prefix and import statement
- Example: `import { FaArrowRight } from 'solid-icons/fa';`

## Zag.js Documentation Tool

When you need to implement UI components use zag.js
The Zag.js docs are located at /docs/zag
When adding a new zag component, place zag components into components/zag/\* files.

### Existing Zag Components

The following Zag components already exist in `packages/web/src/components/zag/*` and should be reused:

- `Avatar.jsx` - User avatar with image and fallback initials (supports `src`, `name`, `alt`, `onStatusChange`, `class` props)
- `Checkbox.jsx` - Checkbox input with label
- `Collapsible.jsx` - Expandable/collapsible content sections
- `Dialog.jsx` - Modal dialogs
- `FileUpload.jsx` - File upload with drag-and-drop
- `FloatingPanel.jsx` - Draggable and resizable floating panel (supports `open`, `onOpenChange`, `title`, `defaultSize`, `defaultPosition`, `size`, `position`, `onSizeChange`, `onPositionChange`, `onStageChange`, `resizable`, `draggable`, `minSize`, `maxSize`, `lockAspectRatio`, `showControls`, `showResizeHandles` props)
- `PasswordInput.jsx` - Password input with show/hide toggle (supports `label`, `password`, `onPasswordChange`, `autoComplete`, `inputClass` props)
- `Splitter.jsx` - Resizable split panes
- `Switch.jsx` - Toggle switch
- `Tabs.jsx` - Tabbed content
- `Toast.jsx` - Toast notifications (use via `useToast` from `@primitives/useToast.jsx`)
- `Tooltip.jsx` - Tooltips with arrow support (supports `content`, `placement`, `openDelay`, `closeDelay` props)

Always check for existing Zag components before creating new ones or using plain HTML inputs.

## Additional References

- The architecture-goals.md file contains relevant architecture and design patterns to follow.
- The style-guide.md file contains additional style and formatting guidelines.
- See vite.config.js or jsconfig.json for path aliases and build configurations.
- See TESTING.md for testing guidelines and best practices, do NOT add tests unless asked.
- Cloudflare Pages is not used in this project; only Cloudflare Workers is used for backend services and frontend deployments.
- This project is split into multiple packages under the `packages/` directory. Each package may have its own dependencies and configurations. The landing/marketing site, the main app, and the backend services.

## Database Migrations

- All migrations should go in a single file: `packages/workers/migrations/0001_init.sql`
- Do NOT create separate migration files (e.g., 0002_xxx.sql) since this project is not yet in production
- When adding new tables or schema changes, edit the existing 0001_init.sql file directly

## SolidJS Specific

### State Architecture (Very Important)

To keep the codebase maintainable and avoid prop drilling:
• Do NOT prop-drill application state.
• Shared or cross-feature state must live in external stores under packages/web/src/stores/ or relative to the component file.
• Import stores directly where needed instead of passing values through multiple components.
• Components should receive at most 1–5 props, and only for local configuration, not shared state.
• If a component would need more than 5 props, move the shared data into:
• an external store
• a primitive
• or Solid context (when scoped to a feature)
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

    •	Components should be lean and focused.
    •	They should not implement business logic; move that into:
    •	stores
    •	utilities
    •	primitives
    •	Never have a component act as a “God component” coordinating multiple large concerns.
