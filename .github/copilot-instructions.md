# GitHub Copilot Instructions

This file contains instructions for GitHub Copilot to follow when generating code for this project. Please adhere to these guidelines to ensure consistency and maintainability across the codebase. This project is CoRATES (Collaborative Research Appraisal Tools for Evidence Synthesis), a SolidJS-based web application deployed on Cloudflare Workers.

## Coding Standards

- Do not use emojis in code, comments, documentation, or commit messages.
- For UI icons, use the `solid-icons` library or SVGs only. Do not use emojis.
- Follow standard JavaScript/SolidJS/Cloudflare best practices.
- Prefer modern ES6+ syntax and features.
- Keep files small, focused, and modular. Avoid large monolithic files.
  - Split functionality into logically grouped modules.
  - Each file should ideally handle one coherent responsibility.
- Use aliases for imports when appropriate to improve readability.
- Use responsive design principles for UI components.
- Prefer using config files rather than hardcoding values.

## Icon Search Tool

When you need to find icons from `solid-icons`, use the `search_icons` MCP tool:

- Search by keyword (e.g., "arrow", "check", "user")
- The tool returns icon names with their library prefix and import statement
- Example: `import { FaArrowRight } from 'solid-icons/fa';`

## Zag.js Documentation Tool

When you need to implement UI components use zag.js and use the MCP tools for zag:

- `search_zag_docs` - Search for components by name or description (e.g., "modal", "dropdown", "date")
- `get_zag_component` - Get detailed info and usage template for a specific component (e.g., "dialog", "select")
- `list_zag_components` - List all available Zag.js components

The tools return Solid.js-specific documentation, installation commands, and usage templates. You should NOT need to add createEffect manually to integrate Zag.js components callbacks. When adding a new zag component, place zag components into components/zag/\* files.

## Additional References

- The architecture-goals.md file contains relevant architecture and design patterns to follow.
- The style-guide.md file contains additional style and formatting guidelines.
- See vite.config.js or jsconfig.json for path aliases and build configurations.
- See TESTING.md for testing guidelines and best practices, do NOT add tests unless asked.
- Cloudflare Pages is not used in this project; only Cloudflare Workers is used for backend services and frontend deployments.
- This project is split into multiple packages under the `packages/` directory. Each package may have its own dependencies and configurations. The landing/marketing site, the main app, and the backend services.

## SolidJS Specific

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
When you have complex state or state objects, use Solid's `createStore` for better performance and reactivity.

### Primitives

You may create reusable logic in "primitives" (hooks) that can be shared across components. This keeps components clean and focused on rendering.
