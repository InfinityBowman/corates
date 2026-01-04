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
- `STRIPE_SECRET_KEY` - Stripe API secret key (shared for all Stripe operations)
- `STRIPE_WEBHOOK_SECRET_AUTH` - Stripe webhook signing secret for Better Auth subscription webhooks (`/api/auth/stripe/webhook`)
- `STRIPE_WEBHOOK_SECRET_PURCHASES` - Stripe webhook signing secret for one-time purchase webhooks (`/api/billing/purchases/webhook`)
- `STRIPE_PRICE_ID_STARTER_TEAM_MONTHLY` / `STRIPE_PRICE_ID_STARTER_TEAM_YEARLY` - Subscription plan price IDs
- `STRIPE_PRICE_ID_TEAM_MONTHLY` / `STRIPE_PRICE_ID_TEAM_YEARLY` - Subscription plan price IDs
- `STRIPE_PRICE_ID_UNLIMITED_TEAM_MONTHLY` / `STRIPE_PRICE_ID_UNLIMITED_TEAM_YEARLY` - Subscription plan price IDs
- `STRIPE_PRICE_ID_SINGLE_PROJECT` - One-time purchase price ID
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

For local Stripe webhook testing, the project includes a `@corates/stripe-dev` package that runs two Stripe CLI listeners automatically when you run `turbo dev`:

- **Subscription webhooks** (Better Auth): `http://localhost:8787/api/auth/stripe/webhook`
- **Purchase webhooks** (one-time): `http://localhost:8787/api/billing/purchases/webhook`

**Setup steps:**

1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
2. Authenticate: `stripe login`
3. Run `turbo dev` - the Stripe listeners will start automatically
4. Copy the two `whsec_...` signing secrets printed by each listener
5. Add them to `packages/workers/.env`:
   - `STRIPE_WEBHOOK_SECRET_AUTH=whsec_...` (from the auth listener)
   - `STRIPE_WEBHOOK_SECRET_PURCHASES=whsec_...` (from the purchases listener)
6. Also add your Stripe test key and price IDs:
   - `STRIPE_SECRET_KEY=sk_test_...`
   - `STRIPE_PRICE_ID_STARTER_TEAM_MONTHLY=price_...`
   - `STRIPE_PRICE_ID_STARTER_TEAM_YEARLY=price_...`
   - `STRIPE_PRICE_ID_TEAM_MONTHLY=price_...`
   - `STRIPE_PRICE_ID_TEAM_YEARLY=price_...`
   - `STRIPE_PRICE_ID_UNLIMITED_TEAM_MONTHLY=price_...`
   - `STRIPE_PRICE_ID_UNLIMITED_TEAM_YEARLY=price_...`
   - `STRIPE_PRICE_ID_SINGLE_PROJECT=price_...`

**Note:** The webhook signing secrets are printed when the listeners start. You only need to copy them once into `.env` - they remain valid for that Stripe CLI session.

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
