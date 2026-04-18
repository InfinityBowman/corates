# Hono → TanStack Start backend migration

Handoff doc. Migration consolidates two Cloudflare Workers (`packages/workers` + `packages/web`) into one: the TanStack Start app in `packages/web` takes over every route that used to live in the Hono app.

Branches: `migrate-backend` (Passes 0-5, merged), `migrate-billing-routes` (Passes 6-12, [#484](https://github.com/InfinityBowman/corates/issues/484), merged via PR #487), `migrate-admin-routes` (Passes 13-21, [#485](https://github.com/InfinityBowman/corates/issues/485), merged via PR #488), `retire-hono-app` (Passes 22+, [#486](https://github.com/InfinityBowman/corates/issues/486), in progress as of 2026-04-17).

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

Tier 3 admin (in progress, issue [#485](https://github.com/InfinityBowman/corates/issues/485)):

- **Pass 13** — admin orgs: `/api/admin/orgs` (GET list), `/api/admin/orgs/$orgId` (GET details). Two route files. Created `packages/web/src/server/guards/requireAdmin.ts` (session check + `isAdminUser` role check, returns discriminated union like other guards). Added `@corates/workers/auth-admin` subpath export so the guard can reuse `isAdminUser`. Both routes are GET-only, so no CSRF/`requireTrustedOrigin` equivalent needed yet. Migrated `fetchOrgs`/`fetchOrgDetails` in `stores/adminStore.ts` from Hono RPC to plain fetch.
- **Pass 14** — admin storage: `/api/admin/storage/documents` (GET list, DELETE bulk), `/api/admin/storage/stats` (GET). Two route files (`storage/documents.ts`, `storage/stats.ts`). Tests use real R2 via `cloudflare:test`'s `env.PDF_BUCKET` (puts and lists actual objects) instead of mocking — same pattern as the PDFs route tests. `clearR2('projects/')` runs in `beforeEach`. The `stats.ts` R2 list call needs an explicit cast — `as { objects, truncated, cursor? }` — because web env doesn't pull in `@cloudflare/workers-types` (already documented in the gotchas). Migrated `useStorageDocuments` (in `useAdminQueries.ts`) and `deleteStorageDocuments` (in `adminStore.ts`) from Hono RPC to plain fetch.
- **Pass 15** — admin stats: `/api/admin/stats/{signups,organizations,projects,webhooks,subscriptions,revenue}` (6 GET routes). Six separate route files in `routes/api/admin/stats/`. Extracted shared `fillMissingDays` helper to `packages/web/src/server/lib/fillMissingDays.ts` (used by signups/organizations/projects). Stripe routes (subscriptions, revenue) mock `@corates/workers/stripe`'s `createStripeClient`. Migrated all 6 RPC callers in `components/admin/AnalyticsSection.tsx` to plain fetch via a tiny `fetchStats<T>` helper. Tagged `useAdminStats` with `TODO(agent)` — that hook calls `GET /api/admin/stats` which has never had a backend endpoint (statsRoutes only mounts the 6 sub-paths above), kept it converted to plain fetch with the same dead URL to preserve runtime behavior. No prior Hono test file existed for stats.
- **Pass 16** — admin projects: `/api/admin/projects` (GET list), `/api/admin/projects/$projectId` (GET details + DELETE), `/api/admin/projects/$projectId/doc-stats` (GET; wakes ProjectDoc DO via `getProjectDocStub`), `/api/admin/projects/$projectId/members/$memberId` (DELETE). Four route files. The `doc-stats` route uses `@corates/workers/project-doc-id` (already a subpath export, also used by sync-profile and dev routes) and checks D1 first to avoid waking a DO for non-existent IDs. Migrated `useAdminProjects`/`useAdminProjectDetails`/`useAdminProjectDocStats` (in `useAdminQueries.ts`) and `removeProjectMember`/`deleteProject` (in `adminStore.ts`) from Hono RPC to plain fetch. Replaced the prior Hono test (which only covered `doc-stats`) with full coverage of all 4 routes.
- **Pass 17** — admin billing observability: `/api/admin/orgs/$orgId/billing/reconcile` (GET, deeply nested under admin/orgs), `/api/admin/billing/stuck-states` (GET global), `/api/admin/billing/ledger` (GET global). Three route files. Reconcile uses `getLedgerEntriesByOrgId` + `LedgerStatus` from `@corates/db/stripe-event-ledger` (already exported) and `createStripeClient` from `@corates/workers/stripe`. Stripe path mocks `@corates/workers/stripe` for the `checkStripe=true` case. Migrated `fetchBillingLedger`/`fetchBillingStuckStates`/`fetchOrgBillingReconcile` (in `adminStore.ts`) from Hono RPC to plain fetch.
- **Pass 18** — admin Stripe tools: `/api/admin/stripe/customer` (GET lookup by email|customerId), `/api/admin/stripe/portal-link` (POST), `/api/admin/stripe/customer/$customerId/{invoices,payment-methods,subscriptions}` (3 GETs). Five route files. All routes mock `@corates/workers/stripe`'s `createStripeClient` and exercise the customer-lookup → linked-org join via D1. No prior Hono test file existed. Migrated all 5 RPC callers in `routes/_app/_protected/admin/billing.stripe-tools.tsx` to plain fetch and dropped its `parseResponse`/`api` imports.
- **Pass 19** — admin database viewer: `/api/admin/database/tables` (GET list), `/api/admin/database/tables/$tableName/schema` (GET), `/api/admin/database/tables/$tableName/rows` (GET — mediaFiles takes a dedicated path that joins org/project/user), `/api/admin/database/analytics/{pdfs-by-org,pdfs-by-user,pdfs-by-project,recent-uploads}` (4 GETs). Seven route files. Extracted `ALLOWED_TABLES` whitelist + `isAllowedTable` helper to `packages/web/src/server/lib/dbTables.ts` (used by both schema and rows routes). Migrated `useAdminDatabaseTables`/`useAdminTableSchema`/`useAdminTableRows` (in `useAdminQueries.ts`) from Hono RPC to plain fetch. The 4 analytics endpoints had no frontend caller (dead in the typed RPC client); preserved the endpoints anyway. No prior Hono test file existed.
- **Pass 20** — admin users: `/api/admin/stats` (GET dashboard counts), `/api/admin/users` (GET list with pagination/search + provider join), `/api/admin/users/$userId` (GET details with projects/sessions/accounts/orgs+billing, DELETE with DO sync), `/api/admin/users/$userId/{ban,unban,impersonate}` (POST), `/api/admin/users/$userId/sessions` (DELETE all), `/api/admin/users/$userId/sessions/$sessionId` (DELETE one). Eight route files (stats split into its own file alongside the existing `stats/*` sub-routes — TanStack flat names handle parent + nested children fine). Self-ban/self-impersonate/self-delete return 400 with `details.constraint` (not `details.reason`) — that's how `createValidationError` shapes its details. Impersonate proxies to better-auth's `/api/auth/admin/impersonate-user` via `createAuth(env).handler(authRequest)`; tests mock `@corates/workers/auth-config` to return `{ handler: vi.fn() }`. Deleted Hono `packages/workers/src/__tests__/admin.test.ts` (8 tests, all covered the 4 routes migrated here). Reverted the wrong Pass 15 `useAdminStats` TODO — the `/api/admin/stats` endpoint was real (mounted by `userRoutes` in Hono); the hook now points to the new TanStack handler. Migrated `useAdminUsers`/`useAdminUserDetails` (in `useAdminQueries.ts`) and `impersonateUser`/`banUser`/`unbanUser`/`revokeUserSessions`/`revokeUserSession`/`deleteUser` (in `adminStore.ts`) from Hono RPC to plain fetch — `adminStore.ts` no longer references the typed `api.admin.users.*` client.
- **Pass 21** — admin billing (org subscriptions + grants): `/api/admin/orgs/$orgId/billing` (GET full billing snapshot), `/api/admin/orgs/$orgId/subscriptions` (POST create), `/api/admin/orgs/$orgId/subscriptions/$subscriptionId` (PUT update / DELETE soft-cancel), `/api/admin/orgs/$orgId/grants` (POST create with trial-uniqueness + `expiresAt > startsAt` validation), `/api/admin/orgs/$orgId/grants/$grantId` (PUT update — `expiresAt` extends or `revokedAt` revokes/unrevokes / DELETE revokes), `/api/admin/orgs/$orgId/grant-trial` (POST 14-day convenience), `/api/admin/orgs/$orgId/grant-single-project` (POST 6-month, extends existing non-revoked grant by 6 months from `max(now, expiresAt)` returning `action: 'extended'` 200, otherwise `action: 'created'` 201). Seven route files. Added `@corates/workers/notify` subpath export so the subscription mutation routes can re-use `notifyOrgMembers`/`EventTypes`. Notification dispatch uses a small `dispatchSubscriptionNotify` helper exported from `subscriptions.ts` and re-imported by the `$subscriptionId.ts` PUT/DELETE — it uses `cloudflareCtx.waitUntil` when the TanStack handler receives `context?.cloudflareCtx`, otherwise awaits inline (test-friendly). The same `HandlerArgs` extension pattern (`context?: { cloudflareCtx?: ExecutionContext }`) is the recommended way to thread `waitUntil` into TanStack routes — first instance in the codebase. Deleted Hono `packages/workers/src/routes/admin/__tests__/admin-billing.test.ts` (12 tests, all covered routes migrated here). Migrated `fetchOrgBilling`/`createOrgSubscription`/`updateOrgSubscription`/`cancelOrgSubscription`/`createOrgGrant`/`revokeOrgGrant`/`grantOrgTrial`/`grantOrgSingleProject` (in `adminStore.ts`) from Hono RPC to plain fetch via a tiny `adminBillingMutate` helper that handles invalidation. **`adminStore.ts` no longer imports `parseResponse` or `api`** — admin tier is fully on TanStack from the client side too.

**Admin tier complete.** All admin routes are TanStack. Every route a regular user or admin hits is now on TanStack. Hono still serves `/api/auth/*` (better-auth catch-all), Stripe webhooks, and DO WebSocket upgrades — that's it.

Tier 4 (in progress, issue [#486](https://github.com/InfinityBowman/corates/issues/486)):

- **Pass 23** — admin stop-impersonation: `POST /api/admin/stop-impersonation`. One route file. CSRF-guarded (Origin/Referer must match a trusted origin) but bypasses the `requireAdmin` umbrella because the impersonated user does not carry the admin role — only better-auth's session check applies downstream. Created `packages/web/src/server/guards/requireTrustedOrigin.ts` (Hono-shape error: `AUTH_FORBIDDEN` with `details.reason: missing_origin | untrusted_origin`). Added `@corates/workers/config/origins` subpath export so the guard reuses `isOriginAllowed`/`STATIC_ORIGINS` (still authoritative for both packages until workers retires). Forwards cookie/origin/referer + `accept: application/json` to `/api/auth/admin/stop-impersonating` via `auth.handler`. Stripped the inline POST handler (and the `requireTrustedOrigin` middleware mount) from `packages/workers/src/index.ts`; deleted `packages/workers/src/__tests__/stop-impersonation.test.ts` (8 tests, all replaced). 7 new tests covering CSRF (4) + forwarding (2) + error path (1). Note: the broader admin tier (`requireAdmin` umbrella) does not currently apply CSRF in TanStack — `requireTrustedOrigin` was a Hono mount-time concern that didn't propagate during Passes 13-21. Worth a follow-up audit but out of scope for this pass.

- **Pass 22** — `/api/auth/*` + Stripe webhook: `/api/auth/session` (custom WebSocket session payload, GET), `/api/auth/verify-email` (branded HTML wrapper around better-auth's verification, GET), `/api/auth/stripe/webhook` (POST, two-phase ledger trust model), `/api/auth/$` (catch-all that proxies to better-auth's `auth.handler`). Four route files. Migrated together because the catch-all would otherwise shadow the webhook — TanStack's specificity sort (Index → Static most-specific → Dynamic longest → Splat) puts `stripe/webhook.ts` ahead of `$.ts`, and the same rule lets `session.ts`/`verify-email.ts` win against the splat. Added `AUTH_RATE_LIMIT` and `SESSION_RATE_LIMIT` to `server/rateLimit.ts`. The catch-all rate-limits the same paths the Hono mount did: `/api/auth/get-session` (session), and `/api/auth/{sign-in,sign-up,forget-password,reset-password,magic-link}/*` (auth). Moved `auth/templates.ts` into `packages/web/src/server/lib/authHtmlPages.ts` (only consumed by `verify-email.ts`). The Stripe webhook ports the two-phase trust model verbatim (Phase 1: signature presence + payload-hash dedupe + early reject for missing signature / unreadable body / `livemode=false` in production; Phase 2: forward raw body to better-auth, classify response into `processed` / `ignored_unverified` / `failed` and update ledger row accordingly). Replaced `createLogger`/`sha256`/`truncateError` from `lib/observability/logger.ts` with inline `console.info`/`console.error` plus 5-line local `sha256`/`truncate` helpers (same observability event names, Pass 12 precedent). Stripped Hono `auth/routes.ts` to an empty router, deleted `auth/templates.ts`. No prior Hono tests covered the webhook (`__tests__/app.test.ts` had 4 unrelated tests; nothing for the catch-all or webhook). 18 new tests across 2 files (`webhook.server.test.ts` 8, `auth.server.test.ts` 10).

## What's left

Tracking issues:

- [#484](https://github.com/InfinityBowman/corates/issues/484) — Migrate billing (non-webhook) routes
- [#485](https://github.com/InfinityBowman/corates/issues/485) — Migrate admin routes
- [#486](https://github.com/InfinityBowman/corates/issues/486) — Retire `packages/workers` Hono app

Tier 3:

- `packages/workers/src/routes/admin/*` — fully migrated. All 9 files stripped to stubs (Pass 13-21). `index.ts` (34) still mounts the empty stubs and applies `requireAdmin` + `requireTrustedOrigin`; once the Hono app retires (#486) this whole tree goes away.
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
- `requireAdmin(request, env)` — session + `isAdminUser` role check (uses `@corates/workers/auth-admin` for the shared `isAdminUser` helper)

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

**`vi.mock` factories can't reference module-scoped variables.** `vi.mock` is hoisted above all imports, so a factory referencing a top-level `const mockFn = vi.fn()` throws `Cannot access 'mockFn' before initialization`. Use `const { mockFn } = vi.hoisted(() => ({ mockFn: vi.fn() }))` when the test body needs to inspect the mock (e.g. asserting `toHaveBeenCalledWith` on `syncMemberToDO` or `auth.handler`).

**Threading `waitUntil` into TanStack handlers.** `src/server.ts` injects `cloudflareCtx` into every TanStack request via `context: { cloudflareCtx: ctx }`. Routes that want fire-and-forget work (notifications, async logging) extend their handler args with `context?: { cloudflareCtx?: ExecutionContext }` and check `context?.cloudflareCtx?.waitUntil` at runtime. When absent (tests, fallback) the work is awaited inline. `routes/api/admin/orgs/$orgId/subscriptions.ts` exports a reusable `dispatchSubscriptionNotify` helper that does this.

**TanStack file-route specificity wins over splats.** From the Route Matching docs: routes are sorted Index → Static (most-specific first) → Dynamic (longest first) → Splat. This is why the Pass 22 catch-all `routes/api/auth/$.ts` does not shadow sibling exact files like `routes/api/auth/session.ts` or the deeper `routes/api/auth/stripe/webhook.ts`, and the existing `/api/$.ts` Hono catch-all hasn't shadowed any of the migrated tiers either. The order routes are defined or codegened doesn't matter — TanStack re-sorts.

**Catch-all handlers must be exported when tested.** TanStack types `server.handlers` as a function (not a record), so accessing `Route.options.server!.handlers!.POST` from tests fails to typecheck even though it works at runtime. Export the handler function (e.g. `export const handle = ...`) and import it directly into tests, same as the named `handleGet`/`handlePost` pattern.

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

- Web server tests: **402 passing** across 39 files (Pass 23: +7 tests, +1 file)
- Workers tests: **211 passing** across 19 files (Pass 23 deleted `__tests__/stop-impersonation.test.ts` — 6 tests, all routes migrated)
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
2. ~~**Admin**~~ ([#485](https://github.com/InfinityBowman/corates/issues/485)). Done — Passes 13-21. ~~`orgs.ts` (393, Pass 13)~~, ~~`storage.ts` (525, Pass 14)~~, ~~`stats.ts` (665, Pass 15)~~, ~~`projects.ts` (772, Pass 16)~~, ~~`billing-observability.ts` (788, Pass 17)~~, ~~`stripe-tools.ts` (808, Pass 18)~~, ~~`database.ts` (997, Pass 19)~~, ~~`users.ts` (1,092, Pass 20)~~, ~~`billing.ts` (1,195, Pass 21)~~.
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
