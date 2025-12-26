# Configuration Guide

This guide covers configuration files, environment variables, path aliases, and setup for CoRATES.

## Overview

CoRATES uses a monorepo structure with multiple packages, each with its own configuration. This guide covers the key configuration files and settings.

## Package Structure

The project is organized as a monorepo with packages under `packages/`:

```
packages/
├── web/          # Frontend application (SolidJS)
├── workers/      # Backend API (Cloudflare Workers)
├── landing/      # Landing/marketing site
├── ui/           # Shared UI component library
├── shared/       # Shared TypeScript utilities
├── mcp/          # MCP server for development tools
└── docs/         # Documentation site
```

## Path Aliases

### Frontend (Web Package)

Path aliases are defined in `packages/web/jsconfig.json`:

```1:20:packages/web/jsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"],
      "@auth-ui/*": ["src/components/auth-ui/*"],
      "@checklist-ui/*": ["src/components/checklist-ui/*"],
      "@project-ui/*": ["src/components/project-ui/*"],
      "@routes/*": ["src/routes/*"],
      "@primitives/*": ["src/primitives/*"],
      "@auth/*": ["src/components/auth-ui/*"],
      "@offline/*": ["src/offline/*"],
      "@api/*": ["src/api/*"],
      "@config/*": ["src/config/*"],
      "@lib/*": ["src/lib/*"]
    }
  },
  "exclude": ["node_modules", "dist"]
}
```

**Usage:**

```js
// Use aliases instead of relative paths
import projectStore from '@/stores/projectStore.js';
import SignIn from '@auth-ui/SignIn.jsx';
import { useProject } from '@primitives/useProject/index.js';
```

**Available Aliases:**

- `@/*` → `src/*`
- `@components/*` → `src/components/*`
- `@auth-ui/*` → `src/components/auth-ui/*`
- `@checklist-ui/*` → `src/components/checklist-ui/*`
- `@project-ui/*` → `src/components/project-ui/*`
- `@routes/*` → `src/routes/*`
- `@primitives/*` → `src/primitives/*`
- `@api/*` → `src/api/*`
- `@config/*` → `src/config/*`
- `@lib/*` → `src/lib/*`

## Environment Variables

### Backend (Workers)

Environment variables are defined in `wrangler.jsonc` or `.dev.vars`:

**Required:**

- `DB` - D1 database binding
- `BETTER_AUTH_SECRET` - Secret key for Better Auth
- `BETTER_AUTH_URL` - Base URL for Better Auth callbacks

**Optional:**

- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - Google OAuth
- `ORCID_CLIENT_ID` / `ORCID_CLIENT_SECRET` - ORCID OAuth
- `POSTMARK_API_KEY` - Email service
- `STRIPE_SECRET_KEY` - Stripe billing
- `R2_BUCKET` - R2 storage binding for PDFs

### Frontend (Web)

Environment variables are typically set at build time via Vite:

- `VITE_API_BASE` - API base URL (defaults to `/api`)

## Build Configuration

### Vite Config (Frontend)

The web package uses Vite for building. Configuration in `packages/web/vite.config.js`.

### Wrangler Config (Backend)

Cloudflare Workers configuration in `packages/workers/wrangler.jsonc`:

- D1 database bindings
- Durable Object bindings
- R2 bucket bindings
- Environment variables
- Routes

## Development Setup

### Prerequisites

- Node.js (v18+)
- pnpm (package manager)
- Cloudflare account (for Workers/D1)

### Installation

```bash
# Install dependencies
pnpm install

# Setup local development
# See README.md for detailed setup instructions
```

### Development Commands

```bash
# Start development servers
pnpm dev

# Build all packages
pnpm build

# Run tests
pnpm test

# Run linting
pnpm lint
```

## Package-Specific Configuration

### Web Package

- **Build tool**: Vite
- **Framework**: SolidJS + SolidStart
- **Styling**: Tailwind CSS
- **Type checking**: TypeScript (via JSDoc comments)

### Workers Package

- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **ORM**: Drizzle ORM
- **Auth**: Better Auth
- **Storage**: Cloudflare R2

### UI Package

- **Components**: Ark UI
- **Icons**: solid-icons
- **TypeScript**: Full TypeScript support

## Import Patterns

### UI Components

Always import from `@corates/ui`:

```js
import { Dialog, Select, Toast } from '@corates/ui';
```

### Icons

Import from `solid-icons`:

```js
import { BiRegularHome } from 'solid-icons/bi';
import { FiUsers } from 'solid-icons/fi';
```

### Internal Packages

Import using package names:

```js
import { createDomainError } from '@corates/shared';
```

## Best Practices

### DO

- Use path aliases instead of relative paths
- Keep configuration files in sync across packages
- Use environment variables for secrets
- Document required environment variables
- Use package.json scripts for common tasks

### DON'T

- Don't use relative paths when aliases are available
- Don't hardcode API URLs or secrets
- Don't commit `.env` files
- Don't create circular dependencies between packages

## Related Guides

- [Development Workflow Guide](/guides/development-workflow) - For setup and common tasks
- [API Development Guide](/guides/api-development) - For backend configuration
- [Component Development Guide](/guides/components) - For frontend configuration
