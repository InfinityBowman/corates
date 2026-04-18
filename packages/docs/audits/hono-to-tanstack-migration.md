# Hono → TanStack Start backend migration

Handoff doc. Migration consolidates two Cloudflare Workers (`packages/workers` + `packages/web`) into one: the TanStack Start app in `packages/web` takes over every route that used to live in the Hono app.

Branch: `migrate-backend`. Passes 0-12 complete and uncommitted as of 2026-04-17. Tier 3 billing ([#484](https://github.com/InfinityBowman/corates/issues/484)) is fully migrated.

## What's migrated

Tier 1 (prior sessions):

- `/api/invitations/accept`
- `/api/users/avatar` + `/api/users/avatar/:userId`
- `/api/pdf-proxy`
- `/api/google-drive/*` (4 files: status, picker-token, disconnect, import)

Tier 2 (this session, Passes 1-5):

- **Pass 1** — org CRUD: `/api/orgs` (list/create), `/api/orgs/$orgId` (get/update/delete), `/api/orgs/$orgId/set-active`
- **Pass 2** — org members: `/api/orgs/$orgId/members` (list/add), `/api/orgs/$orgId/members/$memberId` (update/remove)
- **Pass 3** — projects: `/api/orgs/$orgId/projects` (list/create), `/api/orgs/$orgId/projects/$projectId` (get/update/delete), `/api/orgs/$orgId/projects/$projectId/members` + `$userId`
- **Pass 4** — invitations: `/api/orgs/$orgId/projects/$projectId/invitations` (list/create) + `$invitationId` (cancel)
- **Pass 5** — PDFs + dev: `.../studies/$studyId/pdfs` + `pdfs/$fileName`, and `.../dev/{templates,apply-template,export,import,reset,add-study}`

Tier 3 (in progress, issue [#484](https://github.com/InfinityBowman/corates/issues/484)):

- **Pass 6** — billing sync: `/api/billing/sync-after-success` (POST). Added `@corates/workers/commands/billing` subpath export. Updated `BillingSettings.tsx` from Hono RPC to plain fetch.
- **Pass 7** — billing portal: `/api/billing/portal` (POST). Created `packages/web/src/server/billing-context.ts` with `resolveOrgId`/`resolveOrgIdWithRole` (was `routes/billing/helpers/orgContext.ts` in Hono). Added `BILLING_PORTAL_RATE_LIMIT` to `server/rateLimit.ts`. Updated `api/billing.ts` `createPortalSession` to plain fetch. Removed obsolete portal describe from `packages/workers/src/routes/billing/__tests__/index.test.ts`.
- **Pass 8** — billing plan validation: `/api/billing/validate-plan-change` (GET). Uses `validatePlanChange` from `@corates/workers/billing-resolver` (already exported) and `resolveOrgId` from `@/server/billing-context`. Updated `api/billing.ts` `validatePlanChange` client to plain fetch. Removed `validate-plan-change` describe block from `billing/__tests__/index.test.ts`.
- **Pass 9** — billing trial: `/api/billing/trial/start` (POST). Owner-only one-shot trial grant. Uses `createGrant`/`getGrantByOrgIdAndType` from `@corates/db/org-access-grants`, `GRANT_CONFIG` from `@corates/workers/constants`, and `requireOrgOwner` from `@corates/workers/policies`. No corresponding Hono test existed. Updated `api/billing.ts` `startTrial` client to plain fetch.
- **Pass 10** — billing invoices: `/api/billing/invoices` (GET). Returns up to 10 most recent Stripe invoices for org's active/trialing subscription, empty list if none. Added `@corates/workers/stripe` subpath export for `createStripeClient`. Tests mock the Stripe client directly. Updated `InvoicesList.tsx` Hono RPC → plain fetch.
- **Pass 11** — billing read-only trio: `/api/billing/usage` (GET), `/api/billing/subscription` (GET), `/api/billing/members` (GET). Three separate route files. `subscription` uses `resolveOrgAccess` + `getPlan`/`getGrantPlan`. `members` delegates to better-auth's `listMembers` via `createAuth`. Replaced `InferResponseType<typeof api.api.billing.subscription.$get>` in `useSubscription.ts` with manual `Subscription` interface. Updated `BillingSettings.tsx`, `useSubscription.ts`, and `api/billing.ts` `getMembers` to plain fetch. Removed Hono `subscription` describe (2 tests) from `billing/__tests__/index.test.ts`.
- **Pass 12** — billing checkout trio: `/api/billing/validate-coupon` (POST), `/api/billing/checkout` (POST), `/api/billing/single-project/checkout` (POST). Three separate route files. Added `BILLING_CHECKOUT_RATE_LIMIT` to `server/rateLimit.ts`. Replaced workers' structured `createLogger` with plain `console.info`/`console.error` (same observability event names). After this strip, all three remaining describes (checkout, single-project, downgrade-validation) were obsolete — deleted the entire `packages/workers/src/routes/billing/__tests__/` directory. Updated `api/billing.ts` `createCheckoutSession` and `createSingleProjectCheckout` to plain fetch.

Every route a regular user hits is now on TanStack. Hono still serves `/api/auth/*` (better-auth catch-all), `/api/admin/*`, the remaining `/api/billing/*` routes, Stripe webhooks, and DO WebSocket upgrades.

## What's left

Tracking issues:

- [#484](https://github.com/InfinityBowman/corates/issues/484) — Migrate billing (non-webhook) routes
- [#485](https://github.com/InfinityBowman/corates/issues/485) — Migrate admin routes
- [#486](https://github.com/InfinityBowman/corates/issues/486) — Retire `packages/workers` Hono app

Tier 3:

- `packages/workers/src/routes/admin/*` — 10 files, ~7,200 lines total. Largest individual files: `billing.ts` (1,195), `users.ts` (1,092), `database.ts` (997), `stripe-tools.ts` (808), `billing-observability.ts` (788), `projects.ts` (772), `stats.ts` (665), `storage.ts` (525), `orgs.ts` (393)
- `packages/workers/src/routes/billing/*` — fully migrated. All 7 files stripped to stubs. Order: `sync.ts` (Pass 6), `portal.ts` (Pass 7), `validation.ts` (Pass 8), `grants.ts` (Pass 9), `invoices.ts` (Pass 10), `subscription.ts` 3 routes (Pass 11), `checkout.ts` 3 routes (Pass 12).

Must stay on Hono indefinitely:

- `/api/auth/*` — better-auth catch-all
- Stripe webhooks — specialized middleware for raw-body signature verification
- DO WebSocket upgrade paths

## Migration pattern (the recipe)

### File layout

One TanStack file per route key. Shared path prefixes become directories.

```
packages/web/src/routes/api/orgs/$orgId/projects/$projectId/
├── invitations.ts                 # GET list, POST create
├── invitations/
│   └── $invitationId.ts           # DELETE cancel
├── members.ts                     # GET list, POST add
├── members/
│   └── $userId.ts                 # PUT update, DELETE remove
└── __tests__/
    ├── invitations.server.test.ts
    └── members.server.test.ts
```

TanStack's codegen regenerates `packages/web/src/routeTree.gen.ts` on file changes (gitignored). Sometimes needs a save-trigger or a `pnpm --filter web build` to pick up new files.

### Handler shape

```ts
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { requireOrgMembership } from '@/server/guards/requireOrgMembership';
import { requireProjectAccess } from '@/server/guards/requireProjectAccess';
import { requireOrgWriteAccess } from '@/server/guards/requireOrgWriteAccess';

type HandlerArgs = { request: Request; params: { orgId: string; projectId: string } };

export const handleGet = async ({ request, params }: HandlerArgs) => {
  const orgMembership = await requireOrgMembership(request, env, params.orgId);
  if (!orgMembership.ok) return orgMembership.response;

  const access = await requireProjectAccess(request, env, params.orgId, params.projectId);
  if (!access.ok) return access.response;

  // ... business logic, return Response.json(...)
};

export const Route = createFileRoute('/api/orgs/$orgId/projects/$projectId/some-path')({
  server: { handlers: { GET: handleGet, POST: handlePost } },
});
```

Every handler takes `HandlerArgs`. Export `handleGet`/`handlePost`/`handlePut`/`handleDelete` named so tests can import directly without going through the router.

### Guards

Hono middleware → sync guard functions returning a discriminated union:

```ts
type Result = { ok: true; context: {...} } | { ok: false; response: Response };
```

Live in `packages/web/src/server/guards/`:

- `requireOrgMembership(request, env, orgId, minRole?)` — session + org member lookup, optional role check
- `requireProjectAccess(request, env, orgId, projectId, minRole?)` — validates project exists, belongs to orgId, user is project member, optional role
- `requireOrgWriteAccess(method, env, orgId)` — early-returns for GET/HEAD/OPTIONS; otherwise checks `accessMode !== 'readOnly'`
- `requireEntitlement(env, orgId, key)` — checks `orgBilling.entitlements[key]`
- `requireQuota(env, orgId, getUsage, requested?)` — checks `used + requested <= limit` (unlimited via `isUnlimitedQuota`)

Call order for write routes: `requireOrgMembership` → `requireOrgWriteAccess` → `requireProjectAccess`.

For project sub-routes (members, invitations, PDFs etc.), you typically want `requireOrgMembership` first so the caller gets `not_org_member` rather than `project_access_denied` when they're a total stranger.

### Test shape

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { resetTestDatabase, clearProjectDOs } from '@/__tests__/server/helpers';
import { buildProject, resetCounter } from '@/__tests__/server/factories';
import { handleGet, handlePost } from '../some-route';

let currentUser = { id: 'user-1', email: 'user1@example.com' };

vi.mock('@corates/workers/auth', () => ({
  getSession: async () => ({
    user: { id: currentUser.id, email: currentUser.email, name: 'Test User' },
    session: { id: 'test-session', userId: currentUser.id },
  }),
}));

vi.mock('@corates/workers/billing-resolver', () => ({
  resolveOrgAccess: vi.fn(async () => ({
    accessMode: 'write',
    source: 'free',
    quotas: { 'projects.max': 10, 'collaborators.org.max': -1 },
    entitlements: { 'project.create': true },
  })),
}));

beforeEach(async () => {
  await resetTestDatabase();
  await clearProjectDOs(['project-1']);
  vi.clearAllMocks();
  resetCounter();
  currentUser = { id: 'user-1', email: 'user1@example.com' };
});

function jsonReq(path: string, method: string, body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}
```

Tests call handlers directly — no routing, no Hono, no `app.fetch`. Use `env` from `cloudflare:test` for R2/DB. Real R2 binding works in vitest-pool-workers (see avatar and PDF tests).

Mock `@corates/workers/auth.getSession` to impersonate users. Mock `@corates/workers/billing-resolver.resolveOrgAccess` for quota/entitlement paths. Postmark mock only needed if the route sends email.

## Subtleties and gotchas

**Workers subpath exports.** When the web route needs a workers-side command/helper, export it from `packages/workers/package.json`:

```json
"./commands/invitations": "./src/commands/invitations/index.ts",
"./commands/projects": "./src/commands/projects/index.ts",
"./commands/members": "./src/commands/members/index.ts",
"./commands/billing": "./src/commands/billing/index.ts",
"./stripe": "./src/lib/stripe.ts",
"./billing-resolver": "./src/lib/billingResolver.ts",
"./quota-transaction": "./src/lib/quotaTransaction.ts",
"./constants": "./src/config/constants.ts",
"./ssrf-protection": "./src/lib/ssrf-protection.ts",
"./media-files": "./src/lib/media-files.ts",
"./policies/projects": "./src/policies/projects.ts",
"./policies": "./src/policies/index.ts",
"./project-doc-id": "./src/lib/project-doc-id.ts"
```

**Web env has stricter types.** `@cloudflare/workers-types` isn't pulled in. When web transitively compiles workers code, R2 types can come back as `unknown`. Fix with explicit annotations at the boundary — see `packages/workers/src/commands/lib/doSync.ts` where the R2 `list()` return is typed inline.

**Catch-all `/api/$.ts`.** TanStack file routes take priority; anything unmatched forwards to the Hono app. That's why partial migrations don't break other endpoints. Keep the mount intact until all Hono routes are gone.

**Hono stub pattern when stripping.** Don't delete the Hono router file — the parent mount still imports from it. Strip to an empty router:

When the Hono test file bundles multiple routes (e.g. `packages/workers/src/routes/billing/__tests__/index.test.ts` has 6 `describe` blocks), delete only the `describe` block matching the migrated route, not the whole file. Otherwise the remaining routes lose their tests.

```ts
import { OpenAPIHono, $ } from '@hono/zod-openapi';
import { requireAuth } from '../../middleware/auth.js';
import { validationHook } from '../../lib/honoValidationHook.js';
import type { Env } from '../../types';

const base = new OpenAPIHono<{ Bindings: Env }>({ defaultHook: validationHook });
const orgInvitationRoutes = $(base.use('*', requireAuth));
export { orgInvitationRoutes };
```

Delete the corresponding Hono test file (`packages/workers/src/routes/__tests__/*.test.ts`).

**`createInvitation` always sets `grantOrgMembership: true`.** The Hono schema accepted `grantOrgMembership` as optional, but the command hard-codes true. Tests rely on this.

**Validation error codes are picky.** Missing required field = `createValidationError(field, VALIDATION_ERRORS.FIELD_REQUIRED.code, null, 'required')` with 400. Blank-but-present can map to a different error (see POST `/api/orgs` where missing `name` is 400/VALIDATION but blank `name` is 403/AUTH_FORBIDDEN `name_required`).

**`getDomainError` on the client.** The client `apiFetch` throws parsed domain errors. When rejecting from the catch, `throw data` directly (if data already has `code` + `statusCode`) rather than wrapping in an Error with `.response`.

**`DEV_MODE` in tests.** For dev routes, added `"DEV_MODE": true` to `packages/web/wrangler.test.jsonc` vars. Don't try `vi.mock('cloudflare:workers')` — it hangs the pool.

**Linter collapses multi-line call expressions.** Prettier collapses guards like `requireProjectAccess(request, env, params.orgId, params.projectId, 'owner')` to one line on save. Expected, don't fight it.

## Client caller translation

Client callers that were using Hono RPC (`honoClient.api.orgs[':orgId'].$get(...)`) were rewritten to plain `fetch(\`\${API_BASE}/api/orgs/\${orgId}\`, {...})`. The URLs are identical; the TanStack routes serve the same paths. Completed updates:

- `project/actions/project.ts`
- `project/actions/members.ts`
- `components/dashboard/ProjectsSection.tsx`
- `components/project/CreateProjectModal.tsx`
- `components/project/overview-tab/AddMemberModal.tsx`
- `api/google-drive.ts`
- `routes/_auth/complete-profile.tsx`

Most components already used plain `fetch`, so no code changes were needed for PDFs (`api/pdf-api.ts`), avatar (`components/settings/ProfileInfoSection.tsx`), or dev routes (`components/dev/*`).

## Test counts (2026-04-17)

- Web server tests: **218 passing** across 27 files
- Workers tests: **264 passing** across 26 files
- Web typecheck: clean modulo 3 pre-existing errors (e2e `timeout` in TestDetails, unused `loginWithApiCookies`, `src/server.ts:28` queue() arity)
- Workers typecheck: clean

## How to run

```bash
cd packages/web
pnpm exec vitest run --config vitest.server.config.ts                           # all web server tests
pnpm exec vitest run --config vitest.server.config.ts path/to/test.server.test.ts  # single file

cd packages/workers
pnpm test                                                                        # all workers tests

pnpm --filter web typecheck
pnpm --filter workers typecheck
```

Never start dev servers — the user does that.

## Recommended Tier 3 order

1. ~~**Billing non-webhook first** ([#484](https://github.com/InfinityBowman/corates/issues/484)). Done — Passes 6-12.~~
2. **Admin** ([#485](https://github.com/InfinityBowman/corates/issues/485)). ~7.2k lines. Mostly read-only dashboards, so faster per-line than billing. Suggested order by size: `orgs.ts` (393), `storage.ts` (525), `stats.ts` (665), `projects.ts` (772), `billing-observability.ts` (788), `stripe-tools.ts` (808), `database.ts` (997), `users.ts` (1,092), `billing.ts` (1,195).
3. **Retire Hono app** ([#486](https://github.com/InfinityBowman/corates/issues/486)). Port `/api/auth/*` and Stripe webhooks, then strip workers to library-only.

Stripe webhooks stay on Hono. The `/api/auth/*` catch-all stays on Hono (better-auth).

## End state: retiring `packages/workers`

The workers package is already non-deploying (its `deploy` script errors out with "This package is retired. Deploy from packages/web"). After Tier 3, the Hono app will be an empty shell — every route stubbed. At that point there are three remaining pieces of Hono surface to unwind:

- `/api/auth/*` — better-auth handler. It's just a fetch handler; port to a TanStack catch-all route file.
- Stripe webhooks — need raw body for signature verification. Port to a TanStack handler that reads `request.clone().text()` before parsing.
- `packages/workers/src/index.ts` + middleware plumbing — deleted once nothing mounts Hono.

### What stays valuable in `packages/workers`

Even after the Hono app is gone, these modules remain useful and are already consumed by web via subpath exports:

- DO classes: `UserSession`, `ProjectDoc` (web's `wrangler.jsonc` references them by class name; web's `src/server.ts` re-exports them for the Worker runtime)
- Commands: `createInvitation`, `createProject`, `createMember`, etc.
- Shared lib: `billingResolver`, `quotaTransaction`, `policies`, `media-files`, `project-doc-id`, `ssrf-protection`, `constants`
- Auth: `auth-config`, `email-templates`, session helper

### End state options

1. **Keep `packages/workers` as a library-only workspace.** Delete `src/routes/`, `src/middleware/`, `src/index.ts`, `src/__tests__/test-worker.ts` (if still present). Remove the `main` field and `deploy` script from `package.json`. Web continues to import DOs and commands via `@corates/workers/*` exports exactly as it does today. Simplest landing.

2. **Fold everything into `packages/web`** (or a new `packages/core`). Move DO classes, commands, policies, and lib into web's source tree. Delete `packages/workers` entirely. Touches every `@corates/workers/*` import site. A separate refactor; doesn't block anything.

Option 1 is the natural follow-up after Tier 3 lands. Option 2 is optional cleanup.

## If you pick this up cold

1. Read the current status: `git status`, `git log --oneline -10` on `migrate-backend`.
2. Confirm tests still green: `pnpm --filter web test` + `pnpm --filter workers test`.
3. Pick the smallest Tier 3 file. Read the Hono route + its test file.
4. Clone the pattern: guards → handler → test → strip Hono to stub → delete Hono test → run both suites.
5. Each migration is its own pass. Don't batch.
