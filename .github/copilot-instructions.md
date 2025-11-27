# GitHub Copilot Instructions

## Coding Standards

- Do not use emojis in code, comments, documentation, or commit messages.
- For UI icons, use the `solid-icons` library or SVGs only. Do not use emojis.
- Follow standard JavaScript/SolidJS/Cloudflare best practices.
- Prefer modern ES6+ syntax and features.
- Keep files small, focused, and modular. Avoid large monolithic files.
  - Split functionality into logically grouped modules.
  - Each file should ideally handle one coherent responsibility.
- Use aliases for imports when appropriate to improve readability.

## Icon Search Tool

When you need to find icons from `solid-icons`, use the `search_icons` MCP tool:

- Search by keyword (e.g., "arrow", "check", "user")
- The tool returns icon names with their library prefix and import statement
- Example: `import { FaArrowRight } from 'solid-icons/fa';`

Available icon libraries: ai, bi, bs, cg, fa, fi, hi, im, io, oc, ri, si, tb, ti, vs, wi

## Additional References

- The architecture-goals.md file contains relevant architecture and design patterns to follow.
- The style-guide.md file contains additional style and formatting guidelines.
- See vite.config.js or jsconfig.json for path aliases and build configurations.

## Project Guidelines

- Maintain consistent formatting and indentation.
- Avoid unnecessary dependencies.
- Ensure code is readable and maintainable, and structured into sensible modules.
- Keep component, utility, and handler files concise and scoped to a single purpose.

## Copilot Usage

- All code suggestions and completions must comply with these instructions.
- If a suggestion includes an emoji, remove it and use `solid-icons` or SVGs instead.
- Copilot should prefer generating smaller, modular files over large multi-purpose files.

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

### Using createMemo for derived values

When you need to compute a value based on props or state, use `createMemo` to ensure it updates reactively

### Primitives

You may create reusable logic in "primitives" (hooks) that can be shared across components. This keeps components clean and focused on rendering.
