# @corates/workers

**Backend API for CoRATES** - Cloudflare Workers serverless backend providing REST API, WebSocket sync, and Durable Objects for real-time collaboration.

## Purpose

This package implements the entire backend infrastructure for CoRATES, including:

- **REST API** for project/study/checklist management
- **Real-time collaboration** via Yjs + Durable Objects
- **Authentication** via Better Auth with multi-provider support
- **Billing integration** with Stripe for subscriptions and one-time purchases
- **File storage** via Cloudflare R2 for PDFs
- **Multi-tenancy** with organization and project-level access control

## Tech Stack

- **Runtime:** Cloudflare Workers (V8 isolates, edge computing)
- **Framework:** Hono.js (lightweight web framework)
- **Database:** Cloudflare D1 (SQLite at the edge)
- **ORM:** Drizzle ORM with type-safe queries
- **Real-time:** Y.js CRDT + Durable Objects
- **Auth:** Better Auth v1.4+ with Drizzle adapter
- **Payments:** Stripe SDK v20+

## Key Entry Points

| File | Purpose |
|------|---------|
| `src/index.js` | Main Hono app with route mounting |
| `src/routes/` | API route handlers (REST endpoints) |
| `src/durable-objects/ProjectDoc.js` | ⚠️ Yjs document sync (HIGH BLAST RADIUS) |
| `src/durable-objects/UserSession.js` | User presence tracking |
| `src/auth/config.js` | Better Auth configuration |
| `src/middleware/` | Auth, CORS, CSRF, rate limiting, etc. |
| `src/db/schema.js` | Database schema (Drizzle) |

## Key Exports

This package is deployed as a Cloudflare Worker and doesn't export modules. Instead, it exposes HTTP endpoints:

### Public API Endpoints

```
POST   /api/auth/*                    # Better Auth endpoints
GET    /api/users/:userId/projects    # User's projects
GET    /api/orgs/:orgId/projects      # Org projects
POST   /api/orgs/:orgId/projects      # Create project
GET    /api/billing/subscription      # Current subscription
POST   /api/billing/checkout          # Stripe checkout
WebSocket /api/project-doc/:projectId # Yjs sync
```

## Development

```bash
# Install dependencies
pnpm install

# Run development server (with wrangler)
pnpm dev

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Deploy to Cloudflare (production)
pnpm deploy
```

## Configuration

### Environment Variables

Required secrets (set via `wrangler secret`):

```bash
AUTH_SECRET                 # BetterAuth session secret (64+ chars)
STRIPE_SECRET_KEY           # Stripe API key
STRIPE_WEBHOOK_SECRET_AUTH  # Stripe webhook secret (subscriptions)
STRIPE_WEBHOOK_SECRET_PURCHASES # Stripe webhook secret (purchases)
GOOGLE_CLIENT_ID            # OAuth client ID
GOOGLE_CLIENT_SECRET        # OAuth client secret
POSTMARK_SERVER_TOKEN       # Email delivery token
```

See `.env.example` for all variables.

### Databases

- **D1 (SQLite):** `corates-db` (local), `corates-db-prod` (production)
- **R2 (Object Storage):** `corates-storage` (PDFs and media files)
- **Durable Objects:** `PROJECT_DOC` (Yjs documents), `USER_SESSION` (presence)

## Architecture

### Multi-Tenancy Model

```
Organization
  ├─ Members (Better Auth org membership)
  ├─ Subscription (Stripe or access grant)
  └─ Projects
      ├─ Project Members (project-level access)
      ├─ Studies
      │   ├─ Checklists (AMSTAR2, ROBINS-I, etc.)
      │   └─ PDFs (stored in R2)
      └─ Y.js Document (real-time sync via Durable Object)
```

### Middleware Stack

Routes compose middleware for authorization and validation:

```javascript
projectRoutes.post('/',
  requireAuth,                          // Must be logged in
  requireOrgMembership(),               // Must be org member
  requireEntitlement('project.create'), // Plan allows feature
  requireQuota('projects.max', fn, 1),  // Under quota
  validateRequest(schema),              // Valid input
  async (c) => { /* handler */ }
);
```

### Billing Model

- **Org-scoped:** One subscription per organization
- **Plan hierarchy:** Subscription > Grant > Free
- **Access grants:** Trial (14 days) or Single Project (6 months)
- **Webhook processing:** Two-phase verification with ledger (see `routes/billing/index.js`)

## Testing

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test members

# Run with coverage
pnpm test:coverage
```

Test files are colocated with source in `__tests__/` directories.

### Testing Patterns

- **Unit tests:** Pure function tests (e.g., `billingResolver.test.js`)
- **Integration tests:** Route handlers with mock DB (e.g., `members.test.js`)
- **Durable Object tests:** WebSocket protocol tests (e.g., `ProjectDoc.ws-auth.test.js`)

## Important Patterns

### Error Handling

Always use domain errors from `@corates/shared`:

```javascript
import { createDomainError, PROJECT_ERRORS } from '@corates/shared';

if (!project) {
  const error = createDomainError(PROJECT_ERRORS.NOT_FOUND, { projectId });
  return c.json(error, error.statusCode);
}
```

### Database Access

```javascript
import { createDb } from '../db/client.js';

const db = createDb(c.env.DB);
const projects = await db.select().from(projects).where(eq(projects.orgId, orgId));
```

### Validation

All schemas centralized in `src/config/validation.js`:

```javascript
import { validateRequest } from '../middleware/validateRequest.js';
import { projectSchemas } from '../config/validation.js';

projectRoutes.post('/', validateRequest(projectSchemas.create), async c => {
  const body = c.req.valid('json');  // Pre-validated
});
```

## Links

- **Documentation:** [packages/docs/](../docs/)
- **Cursor Rules:** [.cursor/rules/](../../.cursor/rules/)
- **API Development Guide:** [packages/docs/guides/api-development.md](../docs/guides/api-development.md)
- **Billing Guide:** [packages/docs/guides/billing.md](../docs/guides/billing.md)
- **Yjs Sync Guide:** [packages/docs/guides/yjs-sync.md](../docs/guides/yjs-sync.md)

## Safety Notes

⚠️ **High Blast Radius Files** - Extra caution required:

- `src/durable-objects/ProjectDoc.js` - All real-time collaboration
- `src/routes/billing/index.js` - All payment processing
- `src/auth/config.js` - Authentication configuration
- `src/middleware/requireOrg.js` - Authorization logic

Read the file header warnings before modifying these files.
