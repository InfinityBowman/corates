# CoRATES Learn

Documentation and learning platform for CoRATES, built with Astro and Keystatic.

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Start Keystatic admin UI (for editing content)
pnpm keystatic

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Content Editing

### Using Keystatic (Visual Editor)

1. Run `pnpm keystatic`
2. Open http://localhost:3000/keystatic
3. Use the visual editor to create/edit content
4. Changes are saved as files in `src/content/`

### Direct File Editing

Content files are in `src/content/`:

- `docs/` - Documentation articles (`.mdoc` files)
- `tutorials/` - Step-by-step tutorials
- `glossary/` - Glossary terms

Each file has frontmatter (metadata) at the top:

```yaml
---
title: Your Article Title
description: A brief description
category: getting-started
order: 1
tags:
  - tag1
  - tag2
---
# Your Content Here

Write using Markdown...
```

## Deployment

The learn site is built as static files and deployed to Cloudflare Pages at `/learn`.

### Building

```bash
pnpm build
```

This creates static files in `dist/` with all paths prefixed with `/learn`.

### Deploying

Option 1: Deploy to Cloudflare Pages

```bash
pnpm deploy
```

Option 2: Copy `dist/` contents to main app's public folder during build

## Integration with Main App

The learn site is designed to be served at `/learn/*` on the same domain as the main CoRATES app.

### Option A: Separate Cloudflare Pages Project

Deploy as a separate Pages project with custom routes to serve at `/learn/*`.

### Option B: Build-time Integration

Copy the built `dist/` folder into the main app's build output.

### Option C: Cloudflare Workers Routing

Use a Cloudflare Worker to route `/learn/*` requests to this site.

## Content Types

### Documentation (`docs/`)

- **category**: getting-started, evidence-synthesis, amstar2, systematic-reviews, meta-analysis, tools-methods
- **order**: Number for sorting within category
- **tags**: Keywords for search

### Tutorials (`tutorials/`)

- **difficulty**: beginner, intermediate, advanced
- **estimatedTime**: e.g., "30 minutes"
- **prerequisites**: Array of prerequisite knowledge

### Glossary (`glossary/`)

- **term**: The term being defined
- **abbreviation**: Optional abbreviation
- **relatedTerms**: Array of related terms
