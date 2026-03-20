# Hono RPC Frontend Migration Plan

## Status: In Progress -- Phase 1

## What

Migrate from manually-typed `apiFetch` calls to Hono's type-safe RPC client (`hc`), which infers request/response types directly from backend route definitions.

## Why

- **Type drift**: Frontend defines `Subscription` interface manually; backend defines `SubscriptionResponseSchema` with Zod. These can silently diverge (the backend has `accessMode`, `source`, `projectCount` fields that the frontend interface doesn't know about).
- **No compile-time safety**: Changing a response shape on the backend won't produce a type error on the frontend.
- **Redundant work**: Every API endpoint requires maintaining types in two places.
- **Bug prevention**: The impersonate endpoint bug (frontend sending null body when backend expected `{ userId }`) would be caught at compile time with RPC.

## POC Results (Done)

Successfully verified end-to-end type inference with billing subscription routes:

1. Chained `.openapi()` calls accumulate route types correctly
2. `hc<typeof routes>()` infers all request params, query params, JSON bodies, and response types
3. `res.json()` returns the exact Zod schema shape -- no manual interfaces needed
4. Both packages build and typecheck cleanly

## Prerequisites (Done)

- [x] All `@ts-expect-error OpenAPIHono strict return types` removed (~88 instances)
- [x] All handlers use literal status codes (`200`, `400`, `403`, `500`) matching route definitions
- [x] `hono` added as dependency in landing package
- [x] Both packages have `"strict": true` in tsconfig (required by `hc`)

---

## Scope

### By the numbers

| Metric | Count |
|--------|-------|
| Production files importing apiFetch | 18 |
| Total apiFetch call sites | ~70 |
| Unique API paths | ~48 |
| GET calls | ~30 |
| POST calls | ~20 |
| DELETE calls | ~12 |
| PUT calls | 3 |

### Routes NOT covered by RPC

These are mounted on `base` (not chained into `app`) and will keep using `apiFetch`:

| Route | Reason |
|-------|--------|
| `/api/auth/*` | Better Auth passthrough, has its own client |
| `/api/pdf-proxy` | Inline handler on `base`, returns raw blob |
| `/api/project-doc/:id/*` | Durable Object WebSocket proxy |
| `/api/sessions/:id/*` | Durable Object WebSocket proxy |

The `/api/admin/stop-impersonation` endpoint is currently inline on `base` -- it should be moved into the chained admin routes so it's included in `AppType`.

---

## Architecture Decision: `unwrap()` Pattern

The `hc` client returns raw `Response` objects. The current `apiFetch` provides valuable error handling (toast display, auth redirects, retry, domain error parsing). We preserve this with an `unwrap()` helper:

```typescript
// lib/rpc.ts
import { hc } from 'hono/client';
import type { AppType } from '@workers/index';
import { API_BASE } from '@/config/api';
import { parseApiError, handleDomainError } from '@/lib/error-utils';

export const api = hc<AppType>(API_BASE, {
  init: { credentials: 'include' },
});

/**
 * Extract typed JSON from an RPC response, applying error handling.
 * Reuses the same error parsing/toast/redirect logic as apiFetch.
 */
export async function unwrap<T>(
  response: Response & { json(): Promise<T> },
  options?: {
    toastMessage?: string | false;
    showToast?: boolean;
    onError?: (error: unknown) => void;
  },
): Promise<T> {
  if (!response.ok) {
    const error = await parseApiError(response);
    handleDomainError(error, {
      showToast: options?.showToast ?? (options?.toastMessage !== false),
      toastTitle: typeof options?.toastMessage === 'string' ? options.toastMessage : undefined,
    });
    if (options?.onError) options.onError(error);
    throw error;
  }
  return response.json();
}
```

### Usage comparison

```typescript
// Before (apiFetch -- no type safety)
const data = await apiFetch.get<Subscription>('/api/billing/subscription', {
  toastMessage: false,
});

// After (RPC -- fully typed, no manual Subscription interface)
const res = await api.api.billing.subscription.$get();
const data = await unwrap(res, { showToast: false });
// data type is inferred from the backend Zod schema
```

---

## Phase 1: Infrastructure Setup

### 1a. Backend: Fix sub-router chaining

Two sub-routers use imperative (non-chained) patterns, which means their route types are lost and don't flow into `AppType`.

**`routes/billing/index.ts`** -- 7 imperative `.route()` calls:

```typescript
// Current (types lost)
const billingRoutes = new OpenAPIHono<{ Bindings: Env }>();
billingRoutes.route('/', billingWebhookRoutes);
billingRoutes.route('/', billingSubscriptionRoutes);
billingRoutes.route('/', billingValidationRoutes);
billingRoutes.route('/', billingPortalRoutes);
billingRoutes.route('/', billingCheckoutRoutes);
billingRoutes.route('/', billingGrantRoutes);
billingRoutes.route('/', billingInvoicesRoutes);

// Target (types accumulate)
import { $ } from '@hono/zod-openapi';

const base = new OpenAPIHono<{ Bindings: Env }>();
const billingRoutes = $(base)
  .route('/', billingWebhookRoutes)
  .route('/', billingSubscriptionRoutes)
  .route('/', billingValidationRoutes)
  .route('/', billingPortalRoutes)
  .route('/', billingCheckoutRoutes)
  .route('/', billingGrantRoutes)
  .route('/', billingInvoicesRoutes);
```

**`routes/orgs/index.ts`** -- ~11 imperative `.openapi()` calls across ~900 lines:

```typescript
// Current (types lost)
const orgRoutes = new OpenAPIHono<{ Bindings: Env }>();
orgRoutes.openapi(listOrgsRoute, handler);
orgRoutes.openapi(createOrgRoute, handler);
// ...11 more...
orgRoutes.route('/:orgId/projects', orgProjectRoutes);

// Target (types accumulate)
const base = new OpenAPIHono<{ Bindings: Env }>({ defaultHook: validationHook });
const orgRoutes = $(base.use('*', requireAuth))
  .openapi(listOrgsRoute, handler)
  .openapi(createOrgRoute, handler)
  // ...
  .route('/:orgId/projects', orgProjectRoutes);
```

Also check and convert if needed:
- Each billing sub-router file (subscription.ts already done, check others)
- `routes/orgs/projects.ts` (nested sub-routes)
- `routes/admin/` sub-routers (admin/index.ts already chains `.route()`)

**Move stop-impersonation**: Move the inline `/api/admin/stop-impersonation` handler from `index.ts` base into the chained admin routes so it's included in `AppType`.

### 1b. Frontend: tsconfig path alias

Add `@workers/*` alias to `packages/landing/tsconfig.json`:

```json
"paths": {
  "@/*": ["./src/*"],
  "@workers/*": ["../workers/src/*"]
}
```

`vite-tsconfig-paths` (already in devDependencies and configured in `vite.config.ts`) will resolve this at build time.

### 1c. Frontend: Cloudflare Env type resolution

`AppType` depends on `Cloudflare.Env` from `worker-configuration.d.ts`. TypeScript needs to resolve this when type-checking `AppType` in landing. Options (test in order):

1. Check if `hc<AppType>` only needs route shape and doesn't fully resolve `Env` (likely works)
2. Add `@cloudflare/workers-types` to landing devDependencies
3. Include workers' `worker-configuration.d.ts` in landing tsconfig `files` array

### 1d. Frontend: Create `lib/rpc.ts`

Create the typed client and `unwrap()` helper as described in the Architecture Decision section above. The `unwrap` function reuses existing `parseApiError` and `handleDomainError` from `lib/error-utils.ts`.

### 1e. Verify end-to-end

- Run `pnpm --filter workers typecheck` after backend changes
- Run `pnpm --filter landing typecheck` after frontend setup
- Convert one route (billing subscription GET) as smoke test
- Confirm inferred types match expected shape in IDE

---

## Phase 2: Migrate Read-Only GET Endpoints

Lowest risk -- these are simple queryFn replacements with no mutations.

| File | Calls | What changes |
|------|-------|--------------|
| `hooks/useSubscription.ts` | 1 GET `/api/billing/subscription` | Delete manual `Subscription` interface |
| `components/billing/InvoicesList.tsx` | 1 GET `/api/billing/invoices` | Delete manual type |
| `components/settings/BillingSettings.tsx` | 1 GET `/api/billing/usage` | Inline queryFn conversion |
| `api/billing.ts` | 2 GETs (`/members`, `/validate-plan-change`) | Convert in API module |
| `hooks/useMyProjectsList.ts` | 1 GET `/api/users/me/projects` | Simple conversion |
| `api/google-drive.ts` | 2 GETs (`/status`, `/picker-token`) | Convert in API module |

**Pattern for TanStack Query hooks:**

```typescript
// Before
const { data } = useQuery({
  queryKey: ['subscription'],
  queryFn: () => apiFetch.get<Subscription>('/api/billing/subscription', { toastMessage: false }),
});

// After
const { data } = useQuery({
  queryKey: ['subscription'],
  queryFn: async () => {
    const res = await api.api.billing.subscription.$get();
    return unwrap(res, { showToast: false });
  },
});
```

---

## Phase 3: Migrate Mutations (billing, account merge, google drive)

| File | Calls | Notes |
|------|-------|-------|
| `api/billing.ts` | 3 POSTs (`/checkout`, `/portal`, `/trial/start`) | Return redirect URLs; caller-provided toast options |
| `api/billing.ts` | 1 POST (`/single-project/checkout`) | Same pattern as checkout |
| `api/account-merge.ts` | 3 POSTs + 1 DELETE (`/initiate`, `/verify`, `/complete`, `/cancel`) | All use default toasts |
| `api/google-drive.ts` | 2 POSTs + 1 DELETE (`/import`, link-social, `/disconnect`) | Note: `/api/auth/link-social` is NOT on `app` -- keep as apiFetch |

**Pattern for mutations:**

```typescript
// Before
export async function createCheckoutSession(data: CheckoutData, options?: ApiFetchOptions) {
  return apiFetch.post('/api/billing/checkout', data, options);
}

// After
export async function createCheckoutSession(data: CheckoutData, options?: UnwrapOptions) {
  const res = await api.api.billing.checkout.$post({ json: data });
  return unwrap(res, options);
}
```

---

## Phase 4: Migrate User/Project Routes

| File | Calls | Notes |
|------|-------|-------|
| `components/project/CreateProjectModal.tsx` | 1 POST `/api/orgs/:orgId/projects` | Path param from component state |
| `components/project/overview-tab/AddMemberModal.tsx` | 1 GET `/api/users/search`, 1 POST members | Search + add member |
| `components/dashboard/ProjectsSection.tsx` | 1 DELETE project | Uses raw `apiFetch()` with method: DELETE |
| `lib/syncUtils.ts` | 1 POST `/api/users/sync-profile` | Simple conversion |
| `components/dev/DevUserMapping.tsx` | 1 GET `/api/users/search` | Dev-only, low priority |

**Pattern for path params:**

```typescript
// Before
await apiFetch.post(`/api/orgs/${orgId}/projects`, projectData, { showToast: false });

// After
const res = await api.api.orgs[':orgId'].projects.$post({
  param: { orgId },
  json: projectData,
});
await unwrap(res, { showToast: false });
```

---

## Phase 5: Migrate Admin Routes (largest group)

~37 call sites across 4 files. The admin area is the biggest refactor because of the `adminFetch` dynamic path helper.

### 5a. Convert `stores/adminStore.ts` (33 calls)

The Zustand store has 4 actions + 29 plain async functions. Each builds a URL string manually. Convert each to typed RPC calls:

```typescript
// Before
export async function fetchUsers({ page = 1, limit = 20, search = '' } = {}) {
  const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
  if (search) params.set('search', search);
  return apiFetch.get(`/api/admin/users?${params}`, { toastMessage: false });
}

// After
export async function fetchUsers({ page = 1, limit = 20, search = '' } = {}) {
  const res = await api.api.admin.users.$get({
    query: { page: page.toString(), limit: limit.toString(), search },
  });
  return unwrap(res, { showToast: false });
}
```

### 5b. Rewrite `hooks/useAdminQueries.ts`

The current `adminFetch` helper uses dynamic string paths:

```typescript
const adminFetch = (path: string) => apiFetch(`/api/admin/${path}`, { method: 'GET', showToast: false });
```

This pattern is incompatible with RPC. Each `useQuery` hook must call its specific typed endpoint directly:

```typescript
// Before
export function useAdminStats() {
  return useQuery({ queryKey: queryKeys.admin.stats, queryFn: () => adminFetch('stats') });
}

// After
export function useAdminStats() {
  return useQuery({
    queryKey: queryKeys.admin.stats,
    queryFn: async () => unwrap(await api.api.admin.stats.$get(), { showToast: false }),
  });
}
```

### 5c. Rewrite `components/admin/AnalyticsSection.tsx`

Same dynamic path issue as useAdminQueries -- the `fetchStats` helper builds `/api/admin/stats/${path}`. Each chart query needs its own typed call.

### 5d. Convert `routes/.../billing.stripe-tools.tsx` (5 calls)

Stripe admin tool endpoints -- straightforward conversions.

---

## Phase 6: Cleanup

- [ ] Delete all manually-defined TypeScript interfaces that are now inferred from backend Zod schemas (e.g., `Subscription`, `CheckoutSession`, `PortalSession`, `MembersResponse`)
- [ ] Evaluate whether `apiFetch` can be fully removed or still needed for non-RPC routes (auth, PDF proxy, WebSocket DO proxies)
- [ ] If `apiFetch` is still needed, consider renaming to `legacyFetch` or `rawFetch` to signal it should not be used for RPC-covered routes
- [ ] Run full typecheck: `pnpm typecheck`
- [ ] Run full test suite: `pnpm --filter landing test`
- [ ] Update this document with final status

---

## Backend Chaining Reference

### Route files already using chained pattern

These export properly typed routes:

- `routes/users.ts` -- `$(base).openapi(...).openapi(...)`
- `routes/contact.ts` -- `$(base.use(...)).openapi(...)`
- `routes/invitations.ts` -- `$(base.use(...)).openapi(...)`
- `routes/account-merge.ts` -- `$(base.use(...)).openapi(...).openapi(...).openapi(...).openapi(...)`
- `routes/database.ts` -- `$(base).openapi(...).openapi(...).openapi(...)`
- `routes/avatars.ts` -- `$(base.use(...)).openapi(...).openapi(...).openapi(...)`
- `routes/google-drive.ts` -- `$(base.use(...)).openapi(...).openapi(...).openapi(...).openapi(...)`
- `routes/admin/index.ts` -- `$(...).route(...)` chain
- `routes/billing/subscription.ts` -- already converted in POC

### Route files needing chaining conversion

- `routes/billing/index.ts` -- 7 imperative `.route()` calls
- `routes/orgs/index.ts` -- ~11 imperative `.openapi()` calls + nested `.route()`
- `routes/orgs/projects.ts` -- needs verification
- `routes/billing/checkout.ts` -- needs verification
- `routes/billing/portal.ts` -- needs verification
- `routes/billing/grants.ts` -- needs verification
- `routes/billing/validation.ts` -- needs verification
- `routes/billing/invoices.ts` -- needs verification
- `routes/billing/webhooks.ts` -- needs verification

### Top-level `index.ts` (already chained)

```typescript
const app = $(base)
  .route('/api/admin', adminRoutes)
  .route('/api/contact', contactRoutes)
  .route('/api/billing', billingRoutes)
  .route('/api/db', dbRoutes)
  .route('/api/users', userRoutes)
  .route('/api/users/avatar', avatarRoutes)
  .route('/api/accounts/merge', accountMergeRoutes)
  .route('/api/invitations', invitationRoutes)
  .route('/api/orgs', orgRoutes)
  .route('/api/google-drive', googleDriveRoutes);

export type AppType = typeof app;
```

---

## Gotchas

- **`$()` helper**: Needed when mixing `.use()` middleware with `.openapi()` since `.use()` returns `Hono` not `OpenAPIHono`
- **IDE performance**: Large chained types can slow down TypeScript. Mitigate with `export type AppType = typeof app` (pre-computes the type) and TypeScript project references if needed
- **Error responses**: Handlers must use literal status codes, not dynamic `error.statusCode as ContentfulStatusCode`
- **`hc` needs absolute URLs**: `API_BASE` must be a full URL (e.g., `http://localhost:8787`), not a relative path
- **Credentials**: Pass `{ init: { credentials: 'include' } }` to `hc()` for cookie auth
- **Dynamic admin paths**: The `adminFetch` and `fetchStats` helpers build URLs from string paths. These CANNOT be expressed with RPC -- each query must be converted to call its specific typed endpoint
- **`/api/auth/link-social`**: Used by google-drive.ts but mounted on `base`, not `app`. Must stay as apiFetch
- **Orgs route file size**: 900 lines of imperative `.openapi()` calls. Chaining conversion is mechanical but tedious

## Files Modified in Prep Work

- All route files in `packages/workers/src/routes/` -- removed `@ts-expect-error`, literal status codes
- `packages/workers/src/routes/billing/subscription.ts` -- chained `.openapi()` calls, exports type
- `packages/landing/package.json` -- added `hono` dependency
