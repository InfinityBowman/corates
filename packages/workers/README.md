# @corates/workers

**Shared backend library for CoRATES.** This package no longer deploys as its own Worker -- it is consumed by `packages/web` (the main TanStack Start app) and by `packages/stripe-purchases` (the isolated Stripe webhook Worker). It holds everything the backend needs but that is not route-specific: Durable Objects, auth configuration, authorization policies, billing resolvers, commands, and shared lib helpers.

## Purpose

This package provides:

- **Durable Objects** (`ProjectDoc`, `UserSession`) that the main app Worker registers and routes to.
- **Authentication** configuration and session helpers for Better Auth (multi-provider, admin, organization, Stripe plugins).
- **Authorization policies** (`requireOrgOwner`, project/billing policies) used by API route handlers.
- **Billing resolvers** and plan-change validation used by billing routes and webhook handlers.
- **Commands** -- domain-level operations (invitations, projects, members, billing) that compose DB work + notifications + policy checks.
- **Lib helpers** -- Stripe client, SSRF protection, media file handling, sync-with-retry, Yjs project sync helpers.
- **Queue handler** -- Cloudflare Queue consumer for async email delivery via Postmark.

The actual HTTP routes live in `packages/web/src/routes/api/` (TanStack Start) and `packages/stripe-purchases/src/routes/` (Hono, webhooks only).

## Entry points

The package exposes subpath exports (see `package.json`):

| Import                                         | What it provides                                                 |
| ---------------------------------------------- | ---------------------------------------------------------------- |
| `@corates/workers/auth`                        | `getSession(request, env)` session helper                        |
| `@corates/workers/auth-config`                 | `createAuth(env)` -- Better Auth instance                        |
| `@corates/workers/auth-admin`                  | Admin plugin helpers                                             |
| `@corates/workers/durable-objects`             | `ProjectDoc`, `UserSession` classes (registered by `packages/web`)|
| `@corates/workers/policies`                    | Authorization policies                                           |
| `@corates/workers/billing-resolver`            | `resolveOrgAccess`, `validatePlanChange`                         |
| `@corates/workers/commands/invitations`        | Invitation create/accept/resend commands                         |
| `@corates/workers/commands/projects`           | Project create/update commands                                   |
| `@corates/workers/commands/members`            | Member add/remove commands                                       |
| `@corates/workers/commands/billing`            | Billing-related commands (grant handling, etc.)                  |
| `@corates/workers/stripe`                      | Stripe client factory and helpers                                |
| `@corates/workers/queue`                       | Queue consumer for email delivery                                |
| `@corates/workers/project-sync`                | Yjs project sync utilities                                       |
| `@corates/workers/project-doc-id`              | Project DO ID derivation                                         |
| `@corates/workers/notify`                      | Notification dispatch (to `UserSession` DOs)                     |
| `@corates/workers/media-files`                 | R2 media file helpers                                            |
| `@corates/workers/ssrf-protection`             | SSRF protection for outbound fetches                             |
| `@corates/workers/quota-transaction`           | Transactional quota checks                                       |
| `@corates/workers/constants`                   | Shared backend constants                                         |
| `@corates/workers/email-templates`             | Email template rendering                                         |
| `@corates/workers/config/origins`              | Allowed origins config                                           |

## Development

```bash
# Type-check
pnpm --filter @corates/workers typecheck

# Lint
pnpm --filter @corates/workers lint

# Run tests (regenerates test SQL first)
pnpm --filter @corates/workers test

# Watch mode
pnpm --filter @corates/workers test:watch

# Drizzle Studio
pnpm --filter @corates/workers studio
```

This package does not have a `dev` script and does not deploy. Run `pnpm --filter web dev` for the main app Worker.

## Database

D1 schema lives in **`@corates/db`**, not here. Migrations are generated against the workspace schema via `drizzle-kit`. The scripts in this package wrap the common operations:

- `pnpm db:generate` -- generate a new migration file
- `pnpm db:generate:test` -- regenerate the test SQL used by server tests
- `pnpm db:migrate` -- apply migrations to the local D1
- `pnpm db:migrate:prod` -- apply migrations to production (requires confirmation; ask before running)

Bindings used across the codebase:

- D1: `corates-db` (local), `corates-db-prod` (production)
- R2: `corates-storage` (PDFs and media)
- Durable Objects: `PROJECT_DOC`, `USER_SESSION`

## Testing

`*.test.ts` files colocated with source under `__tests__/`. Tests run under `@cloudflare/vitest-pool-workers` so Durable Objects, D1, and R2 all behave like the real runtime.

```bash
pnpm --filter @corates/workers test
```

Integration-style tests for HTTP behavior live in `packages/web` (`*.server.test.ts`) -- this package's tests focus on pure logic (billing resolvers, policies, commands) and Durable Object protocol.

## Multi-tenancy model

```
Organization
  ├─ Members (Better Auth org membership)
  ├─ Subscription (Stripe) or Access Grant (trial / single-project)
  └─ Projects
      ├─ Project Members (project-level access)
      ├─ Studies
      │   ├─ Checklists (AMSTAR2, ROBINS-I, etc.)
      │   └─ PDFs (stored in R2)
      └─ Yjs Document (real-time sync via ProjectDoc Durable Object)
```

## Billing model

- **Org-scoped:** One active subscription or grant per organization.
- **Access hierarchy:** Subscription > Access Grant > Free tier.
- **Access grants:** Trial (14 days) or Single Project (6 months).
- **Webhook processing:** Two-phase verification with ledger (signature check, then idempotent application). The subscription webhook is handled by the main app; the one-time purchase webhook is handled by `packages/stripe-purchases`.

## Important patterns

### Error handling

Always use domain errors from `@corates/shared`:

```ts
import { createDomainError, PROJECT_ERRORS } from '@corates/shared';

if (!project) {
  throw createDomainError(PROJECT_ERRORS.NOT_FOUND, { projectId });
}
```

Route handlers in `packages/web` catch these, narrow with `isDomainError`, and return them as JSON.

### Database access

Always go through Drizzle via `@corates/db/client`:

```ts
import { createDb } from '@corates/db/client';
import { projects } from '@corates/db/schema';
import { eq } from 'drizzle-orm';

const db = createDb(env.DB);
const row = await db.select().from(projects).where(eq(projects.id, projectId)).get();
```

### Policies

Policy functions throw domain errors on denial. Call them from route handlers inside `try/catch` and return the thrown error as JSON.

```ts
import { requireOrgOwner } from '@corates/workers/policies';

await requireOrgOwner(db, session.user.id, orgId);
```

## Links

- [API Development Guide](../docs/guides/api-development.md)
- [Authentication Guide](../docs/guides/authentication.md)
- [Yjs Sync Guide](../docs/guides/yjs-sync.md)
- [Billing Guide](../docs/guides/billing.md)

## High blast radius

Extra caution required when modifying:

- `src/durable-objects/ProjectDoc.ts` -- all real-time collaboration flows through here.
- `src/lib/billingResolver.ts` -- determines access for every org request.
- `src/auth/config.ts` -- authentication configuration for the whole app.
- `src/policies/` -- authorization decisions.

Read file header warnings before modifying. Webhook processing for one-time purchases lives in `packages/stripe-purchases/src/routes/webhook.ts` -- it is in a separate worker for deploy isolation.
