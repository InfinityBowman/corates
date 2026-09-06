# Configuration Guide

This guide covers configuration files, environment variables, path aliases, and setup for CoRATES.

## Overview

CoRATES uses a monorepo structure with multiple packages, each with its own configuration. This guide covers the key configuration files and settings.

## Package Structure

The project is organized as a monorepo with packages under `packages/`:

```
packages/
├── web/          # Frontend application (React/TanStack Start)
├── workers/      # Backend API (Cloudflare Workers)
├── ui/           # Shared UI component library
├── shared/       # Shared TypeScript utilities
├── mcp/          # MCP server for development tools
└── docs/         # Documentation site
```

## Path Aliases

### Frontend (Web Package)

`packages/web/tsconfig.json` defines one path alias:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**Usage:**

```tsx
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { useOrgs } from '@/hooks/useOrgs';
```

There are no per-feature aliases (`@auth-ui`, `@project-ui`, etc.) -- those were removed in the React migration. Everything goes through `@/*`.

## Environment Variables

### Backend (Workers)

Environment variables are defined in `.env` NOT `.dev.vars`

**Required:**

- `DB` - D1 database binding
- `BETTER_AUTH_SECRET` - Secret key for Better Auth
- `BETTER_AUTH_URL` - Base URL for Better Auth callbacks

**Optional:**

- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - Google OAuth
- `ORCID_CLIENT_ID` / `ORCID_CLIENT_SECRET` - ORCID OAuth
- `POSTMARK_API_KEY` - Email service
- `STRIPE_SECRET_KEY` - Stripe API secret key (shared for all Stripe operations)
- `STRIPE_WEBHOOK_SECRET_AUTH` - Stripe webhook signing secret for Better Auth subscription webhooks (`/api/auth/stripe/webhook`)
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

### Stripe Local Development

Prices are addressed by Stripe lookup key (`team_monthly`, `team_yearly`, `lab_monthly`, `lab_yearly`), so local development needs no price ids. The setup script creates the products and prices in your Stripe test account from `@corates/shared/plans`.

1. Get a test secret key from https://dashboard.stripe.com/test/apikeys
2. From `packages/web`, run `STRIPE_SECRET_KEY=sk_test_... pnpm stripe:setup`. It writes the key to `packages/web/.env`. Re-run it after changing prices in `@corates/shared/plans`; it moves each lookup key to a new price.
3. Install the Stripe CLI (https://stripe.com/docs/stripe-cli) and run `stripe login`.
4. Forward webhooks to the app with `stripe listen --forward-to <app url>/api/auth/stripe/webhook`. `pnpm dev:test` in `packages/web` starts this listener for you against port 3010.
5. Copy the `whsec_...` value the listener prints into `packages/web/.env` as `STRIPE_WEBHOOK_SECRET_AUTH`. It stays valid for that Stripe CLI session.

## Package-Specific Configuration

### Web Package (`packages/web`)

- **Framework**: React 19 + TanStack Start (SSR + file-based routing)
- **Build tool**: Vite
- **Styling**: Tailwind CSS
- **UI primitives**: shadcn/ui wrappers under `@/components/ui/` (Radix under the hood, with `@ark-ui/react` for a handful of components Radix doesn't cover)
- **Icons**: lucide-react
- **Client state**: Zustand
- **Server state**: TanStack Query
- **Type checking**: TypeScript (strict)

### Workers Package (`packages/workers`)

- **Runtime**: Cloudflare Workers
- **Role**: Shared backend library -- auth, policies, billing resolvers, Durable Objects
- **Database**: Cloudflare D1 (SQLite)
- **ORM**: Drizzle ORM
- **Auth**: Better Auth
- **Storage**: Cloudflare R2

The main app Worker is `packages/web`; `packages/workers` is imported as a library.

## Import Patterns

### UI Components

Import from the colocated shadcn/ui primitives under `@/components/ui/`:

```tsx
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { showToast } from '@/lib/toast';
```

There is no external `@corates/ui` package -- these components live in the repo so they can be modified directly. Under the hood they wrap Radix (most) and `@ark-ui/react` (editable, steps, qr-code, password-input, file-upload).

### Icons

Import from `lucide-react`:

```tsx
import { FolderIcon, PlusIcon } from 'lucide-react';
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
