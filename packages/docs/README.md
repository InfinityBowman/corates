# CoRATES Documentation

This package contains the VitePress documentation site for CoRATES.

## Development

```bash
# Start dev server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

Or from the root:

```bash
pnpm docs
pnpm docs:build
pnpm docs:preview
```

## Structure

- `index.md` - Home page
- `architecture/` - Architecture diagrams and documentation
- `guides/` - Development guides (error handling, style guide, etc.)

## Content

Documentation is written in Markdown with support for:

- Mermaid diagrams
- Code syntax highlighting
- Vue components (if needed)
- Full VitePress features
