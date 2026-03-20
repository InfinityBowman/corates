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

## Architecture Decision: Custom Fetch + `rpc()` Helper

### Problem

The `hc` client returns raw `Response` objects. The current `apiFetch` provides error handling (toast display, auth redirects, retry, domain error parsing). We need to preserve error handling without coupling it to every call site.

### Decision

Error handling is split into two layers:

1. **Transport layer** (custom `fetch` in `hc`): Throws structured errors on non-ok responses. This runs automatically on every RPC call.
2. **UI layer** (TanStack Query global config): Shows toasts, handles auth redirects. This is where per-call customization happens.

A thin `rpc()` helper extracts typed JSON from successful responses. It contains no error handling logic.

### Implementation

```typescript
// lib/rpc.ts
import { hc } from 'hono/client';
import type { AppType } from '@workers/index';
import { API_BASE } from '@/config/api';
import { parseApiError } from '@/lib/error-utils';

export const api = hc<AppType>(API_BASE, {
  init: { credentials: 'include' },
  fetch: async (input, init) => {
    const res = await fetch(input, init);
    if (!res.ok) {
      const error = await parseApiError(res);
      throw error;
    }
    return res;
  },
});

/**
 * Extract typed JSON from an RPC response.
 * Error handling is NOT here -- it's in the custom fetch (throws on non-ok)
 * and TanStack Query's global error handlers (toasts, redirects).
 */
export async function rpc<T>(
  promise: Promise<Response & { json(): Promise<T> }>,
): Promise<T> {
  const res = await promise;
  return res.json();
}
```

### Error handling in TanStack Query

```typescript
// lib/queryClient.ts
import { isDomainError, getUserFriendlyMessage } from '@/lib/error-utils';
import { toast } from 'sonner';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry auth errors or client errors
        if (isDomainError(error) && error.statusCode < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      onError: (error) => {
        // Global toast for mutation failures
        if (isDomainError(error)) {
          toast.error(getUserFriendlyMessage(error.code));
        }
      },
    },
  },
});

// Global auth redirect handler
queryClient.getQueryCache().subscribe((event) => {
  if (event.type === 'updated' && event.query.state.error) {
    const error = event.query.state.error;
    if (isDomainError(error) && (error.code === 'AUTH_REQUIRED' || error.code === 'AUTH_EXPIRED')) {
      window.location.href = '/signin';
    }
  }
});
```

### Usage comparison

```typescript
// Before (apiFetch -- no type safety, per-call error options)
const data = await apiFetch.get<Subscription>('/api/billing/subscription', {
  toastMessage: false,
});

// After (RPC -- fully typed, no manual interface, no error options needed)
// Queries don't show toasts by default (only mutations do)
const { data } = useQuery({
  queryKey: ['subscription'],
  queryFn: () => rpc(api.api.billing.subscription.$get()),
});

// Mutations get global toast handling automatically
const mutation = useMutation({
  mutationFn: (data) => rpc(api.api.billing.checkout.$post({ json: data })),
  // To suppress toast for a specific mutation:
  // onError: () => {},
});
```

### Why not `unwrap()`?

The earlier plan used an `unwrap()` helper with per-call `showToast`/`toastMessage` options. This was rejected because:

- It duplicates TanStack Query's error handling (which already has `onError`, `retry`, `throwOnError`)
- ~52 of ~70 call sites suppress toasts. The global default should be "no toast for queries, toast for mutations" -- not opt-out per call
- Error handling belongs at the UI layer (query/mutation hooks), not the transport layer
- `rpc()` is 4 lines with no options. `unwrap()` was a mini error-handling framework

### Calls NOT using TanStack Query

The Zustand admin store actions (`impersonateUser`, `stopImpersonation`) and a few component event handlers call the API directly without TanStack Query. For these, use try/catch:

```typescript
// Zustand store action
impersonateUser: async (userId) => {
  try {
    await rpc(api.api.admin.users[':userId'].impersonate.$post({
      param: { userId },
      json: { userId },
    }));
    set({ isImpersonating: true });
    window.location.href = '/';
  } catch (error) {
    toast.error('Failed to impersonate user');
  }
},
```

---

## Phase 1: Infrastructure Setup

### 1a. Add lint rule to enforce chaining

Before converting any routes, add a lint rule that catches the anti-pattern. This uses ESLint's built-in `no-restricted-syntax` with AST selectors -- no custom plugin needed.

Add to the workers ESLint config, scoped to route files:

```javascript
// In eslint config, scoped to route files
{
  files: ['packages/workers/src/routes/**/*.ts'],
  rules: {
    'no-restricted-syntax': ['error', {
      selector: 'ExpressionStatement > CallExpression[callee.property.name="openapi"]',
      message: 'Chain .openapi() calls (assign return value) so types flow into AppType. See docs/audits/hono-rpc-migration.md',
    }, {
      selector: 'ExpressionStatement > CallExpression[callee.property.name="route"]',
      message: 'Chain .route() calls (assign return value) so types flow into AppType. See docs/audits/hono-rpc-migration.md',
    }],
  },
}
```

This catches any `.openapi()` or `.route()` call whose return value is discarded (an `ExpressionStatement` means the result isn't assigned to a variable). It will immediately flag all the imperative calls that need conversion.

**Validation steps:**
1. Add the rule
2. Run `pnpm --filter workers lint` to confirm it catches the known violations
3. Verify it does NOT flag already-chained routes (e.g., `routes/users.ts`)
4. Verify it does NOT flag non-route `.route()` calls elsewhere in the codebase

### 1b. Backend: Fix sub-router chaining

Fix all violations caught by the lint rule. Two sub-routers use imperative (non-chained) patterns, which means their route types are lost and don't flow into `AppType`.

**`routes/billing/index.ts`** -- 7 imperative `.route()` calls:

```typescript
// Current (types lost -- lint error)
const billingRoutes = new OpenAPIHono<{ Bindings: Env }>();
billingRoutes.route('/', billingWebhookRoutes);
billingRoutes.route('/', billingSubscriptionRoutes);
// ...5 more...

// Target (types accumulate -- lint passes)
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
// Current (types lost -- lint error)
const orgRoutes = new OpenAPIHono<{ Bindings: Env }>();
orgRoutes.openapi(listOrgsRoute, handler);
orgRoutes.openapi(createOrgRoute, handler);
// ...
orgRoutes.route('/:orgId/projects', orgProjectRoutes);

// Target (types accumulate -- lint passes)
const base = new OpenAPIHono<{ Bindings: Env }>({ defaultHook: validationHook });
const orgRoutes = $(base.use('*', requireAuth))
  .openapi(listOrgsRoute, handler)
  .openapi(createOrgRoute, handler)
  // ...
  .route('/:orgId/projects', orgProjectRoutes);
```

Also check and convert if needed (the lint rule will catch these):
- Each billing sub-router file (subscription.ts already done, check others)
- `routes/orgs/projects.ts` (nested sub-routes)
- `routes/admin/` sub-routers (admin/index.ts already chains `.route()`)

**Move stop-impersonation**: Move the inline `/api/admin/stop-impersonation` handler from `index.ts` base into the chained admin routes so it's included in `AppType`.

### 1c. Frontend: tsconfig path alias

Add `@workers/*` alias to `packages/landing/tsconfig.json`:

```json
"paths": {
  "@/*": ["./src/*"],
  "@workers/*": ["../workers/src/*"]
}
```

`vite-tsconfig-paths` (already in devDependencies and configured in `vite.config.ts`) will resolve this at build time.

### 1d. Frontend: Cloudflare Env type resolution

`AppType` depends on `Cloudflare.Env` from `worker-configuration.d.ts`. TypeScript needs to resolve this when type-checking `AppType` in landing. Options (test in order):

1. Check if `hc<AppType>` only needs route shape and doesn't fully resolve `Env` (likely works)
2. Add `@cloudflare/workers-types` to landing devDependencies
3. Include workers' `worker-configuration.d.ts` in landing tsconfig `files` array

### 1e. Frontend: Create `lib/rpc.ts`

Create the typed `hc` client with custom error-throwing fetch and the `rpc()` helper as described in the Architecture Decision section.

### 1f. Frontend: Update `lib/queryClient.ts`

Add global error handlers:
- Mutation `onError`: show toast via `getUserFriendlyMessage()`
- Query retry: skip retries for client errors (4xx)
- Auth redirect: subscribe to query cache for `AUTH_REQUIRED`/`AUTH_EXPIRED`

### 1g. Verify end-to-end

- Run `pnpm --filter workers typecheck` after backend changes
- Run `pnpm --filter landing typecheck` after frontend setup
- Convert one route (billing subscription GET) as smoke test
- Confirm inferred types match expected shape in IDE
- Verify error responses trigger toast/redirect correctly

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

**Pattern:**

```typescript
// Before
const { data } = useQuery({
  queryKey: ['subscription'],
  queryFn: () => apiFetch.get<Subscription>('/api/billing/subscription', { toastMessage: false }),
});

// After
const { data } = useQuery({
  queryKey: ['subscription'],
  queryFn: () => rpc(api.api.billing.subscription.$get()),
});
```

---

## Phase 3: Migrate Mutations (billing, account merge, google drive)

| File | Calls | Notes |
|------|-------|-------|
| `api/billing.ts` | 4 POSTs (`/checkout`, `/portal`, `/trial/start`, `/single-project/checkout`) | Return redirect URLs |
| `api/account-merge.ts` | 3 POSTs + 1 DELETE (`/initiate`, `/verify`, `/complete`, `/cancel`) | Toast handled by global mutation onError |
| `api/google-drive.ts` | 2 POSTs + 1 DELETE (`/import`, `/disconnect`) | `/api/auth/link-social` stays as apiFetch |

**Pattern:**

```typescript
// Before
export async function createCheckoutSession(data: CheckoutData, options?: ApiFetchOptions) {
  return apiFetch.post('/api/billing/checkout', data, options);
}

// After
export async function createCheckoutSession(data: CheckoutData) {
  return rpc(api.api.billing.checkout.$post({ json: data }));
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
await rpc(api.api.orgs[':orgId'].projects.$post({
  param: { orgId },
  json: projectData,
}));
```

---

## Phase 5: Migrate Admin Routes (optional, defer recommended)

~37 call sites across 4 files. This is the largest refactor and has the lowest ROI since admin is internal-only tooling where type drift is low-consequence.

**Recommend deferring this phase.** Phases 1-4 cover all user-facing routes (~33 call sites across 14 files) and capture the majority of the type safety benefit.

If done, the key changes are:

### 5a. Convert `stores/adminStore.ts` (33 calls)

Each plain async function builds a URL string manually. Convert each to typed RPC calls:

```typescript
// Before
export async function fetchUsers({ page = 1, limit = 20, search = '' } = {}) {
  const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
  if (search) params.set('search', search);
  return apiFetch.get(`/api/admin/users?${params}`, { toastMessage: false });
}

// After
export async function fetchUsers({ page = 1, limit = 20, search = '' } = {}) {
  return rpc(api.api.admin.users.$get({
    query: { page: page.toString(), limit: limit.toString(), search },
  }));
}
```

### 5b. Rewrite `hooks/useAdminQueries.ts`

The `adminFetch` dynamic path helper is incompatible with RPC. Each `useQuery` hook must call its specific typed endpoint:

```typescript
// Before
const adminFetch = (path: string) => apiFetch(`/api/admin/${path}`, { method: 'GET', showToast: false });

export function useAdminStats() {
  return useQuery({ queryKey: queryKeys.admin.stats, queryFn: () => adminFetch('stats') });
}

// After (adminFetch deleted)
export function useAdminStats() {
  return useQuery({
    queryKey: queryKeys.admin.stats,
    queryFn: () => rpc(api.api.admin.stats.$get()),
  });
}
```

### 5c. Rewrite `components/admin/AnalyticsSection.tsx`

Same dynamic path issue -- the `fetchStats` helper builds `/api/admin/stats/${path}`. Each chart query needs its own typed call.

### 5d. Convert `routes/.../billing.stripe-tools.tsx` (5 calls)

Stripe admin tool endpoints -- straightforward conversions.

---

## Phase 6: Cleanup

- [ ] Delete all manually-defined TypeScript interfaces now inferred from backend Zod schemas (e.g., `Subscription`, `CheckoutSession`, `PortalSession`, `MembersResponse`)
- [ ] Simplify `lib/error-utils.ts` -- retry logic, per-call toast options, and `handleFetchError` wrapper become dead code once all calls migrate to RPC + TanStack Query error handling
- [ ] Evaluate whether `apiFetch` can be fully removed or is still needed for non-RPC routes (auth, PDF proxy, WebSocket DO proxies)
- [ ] If `apiFetch` is still needed, consider renaming to `rawFetch` to signal it should not be used for RPC-covered routes
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
- **Chaining footgun**: If someone adds a route with imperative `routes.openapi()` instead of chaining, that route silently disappears from `AppType`. Mitigated by the `no-restricted-syntax` lint rule added in Phase 1a, which catches discarded return values on `.openapi()` and `.route()` calls in route files.
- **IDE performance**: Large chained types can slow down TypeScript. Mitigate with `export type AppType = typeof app` (pre-computes the type) and TypeScript project references if needed
- **Error responses**: Handlers must use literal status codes, not dynamic `error.statusCode as ContentfulStatusCode`
- **`hc` needs absolute URLs**: `API_BASE` must be a full URL (e.g., `http://localhost:8787`), not a relative path
- **Credentials**: Pass `{ init: { credentials: 'include' } }` to `hc()` for cookie auth
- **Dynamic admin paths**: The `adminFetch` and `fetchStats` helpers build URLs from string paths. These CANNOT be expressed with RPC -- each query must be converted to call its specific typed endpoint
- **`/api/auth/link-social`**: Used by google-drive.ts but mounted on `base`, not `app`. Must stay as apiFetch
- **Orgs route file size**: 900 lines of imperative `.openapi()` calls. Chaining conversion is mechanical but tedious
- **Alternative considered**: openapi-fetch + openapi-typescript could generate types from the OpenAPI spec without requiring backend chaining. Rejected because the POC and prep work are already done for hc, and hc provides live type inference without a codegen step.

## Files Modified in Prep Work

- All route files in `packages/workers/src/routes/` -- removed `@ts-expect-error`, literal status codes
- `packages/workers/src/routes/billing/subscription.ts` -- chained `.openapi()` calls, exports type
- `packages/landing/package.json` -- added `hono` dependency
