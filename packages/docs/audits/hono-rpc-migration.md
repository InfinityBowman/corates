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

## Architecture Decision: `parseResponse` + TanStack Query Error Handling

### Problem

The `hc` client returns raw `Response` objects. The current `apiFetch` provides error handling (toast display, auth redirects, retry, domain error parsing). We need to preserve error handling without coupling it to every call site.

### Decision

Use Hono's built-in `parseResponse` from `hono/client` instead of writing custom helpers. It:

1. Auto-detects content type (JSON vs text) and parses accordingly
2. Throws `DetailedError` on non-ok responses (includes `statusCode` and `detail.data` with the parsed response body)
3. Returns typed data directly -- no need to call `.json()`
4. Handles null-body responses (204, 304, etc.)

Error handling lives in TanStack Query's global config, not in the transport layer.

**No custom `fetch`, no `rpc()` helper, no `unwrap()`.** Just `parseResponse` (from Hono) + TanStack Query error handlers.

### Implementation

```typescript
// lib/rpc.ts
import { hc } from 'hono/client';
import type { AppType } from '@workers/index';
import { API_BASE } from '@/config/api';

// Pre-computed client type for IDE performance (official Hono recommendation).
// Moves type instantiation to compile time so tsserver doesn't re-compute
// all route types on every use.
type Client = ReturnType<typeof hc<AppType>>;
export const hcWithType = (...args: Parameters<typeof hc>): Client =>
  hc<typeof app>(...args);

export const api = hcWithType(API_BASE, {
  init: { credentials: 'include' },
});
```

```typescript
// Usage -- parseResponse is imported from hono/client at each call site
import { parseResponse } from 'hono/client';

const data = await parseResponse(api.api.billing.subscription.$get());
// data is typed as the Zod schema shape from the backend
// Throws DetailedError automatically on non-ok responses
```

### How `DetailedError` maps to our domain errors

When the backend returns a non-ok response with a JSON body (our `DomainError` shape: `{ code, message, statusCode, details }`), `parseResponse` throws a `DetailedError` with:

- `error.statusCode` -- HTTP status code (e.g., 403)
- `error.detail.data` -- the parsed JSON body (our `DomainError` object)
- `error.detail.statusText` -- HTTP status text (e.g., "Forbidden")
- `error.message` -- `"403 Forbidden"`

### Error handling in TanStack Query

```typescript
// lib/queryClient.ts
import { DetailedError } from 'hono/client';
import { toast } from 'sonner';

// Helper to extract our DomainError from Hono's DetailedError
function getDomainError(error: unknown) {
  if (error instanceof DetailedError && error.detail?.data?.code) {
    return error.detail.data;
  }
  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof DetailedError && error.statusCode < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      onError: (error) => {
        const domainError = getDomainError(error);
        if (domainError) {
          toast.error(getUserFriendlyMessage(domainError.code));
        } else {
          toast.error('An unexpected error occurred');
        }
      },
    },
  },
});

// Global auth redirect handler
queryClient.getQueryCache().subscribe((event) => {
  if (event.type === 'updated' && event.query.state.error) {
    const domainError = getDomainError(event.query.state.error);
    if (domainError?.code === 'AUTH_REQUIRED' || domainError?.code === 'AUTH_EXPIRED') {
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
// Queries don't show toasts by default (only mutations do via global onError)
import { parseResponse } from 'hono/client';

const { data } = useQuery({
  queryKey: ['subscription'],
  queryFn: () => parseResponse(api.api.billing.subscription.$get()),
});

// Mutations get global toast handling automatically
const mutation = useMutation({
  mutationFn: (data) => parseResponse(api.api.billing.checkout.$post({ json: data })),
  // To suppress toast for a specific mutation:
  // onError: () => {},
});
```

### Why `parseResponse` over custom helpers?

| Approach | Lines of custom code | Error handling | Type safety |
|----------|---------------------|----------------|-------------|
| `unwrap()` (v1) | ~20 lines + per-call options | In transport layer (wrong place) | Yes |
| Custom fetch + `rpc()` (v2) | ~15 lines | Split transport/UI | Yes |
| `parseResponse` (v3, chosen) | 0 lines (built into Hono) | All in TanStack Query (right place) | Yes |

- Zero custom transport code to maintain
- `DetailedError` is Hono's standard -- no need to define our own error type for RPC calls
- `parseResponse` handles content-type detection, null bodies, and error throwing in one call
- Stays aligned with upstream Hono patterns -- no custom abstractions that diverge over time

### Calls NOT using TanStack Query

The Zustand admin store actions (`impersonateUser`, `stopImpersonation`) and a few component event handlers call the API directly without TanStack Query. For these, use try/catch with `parseResponse`:

```typescript
import { parseResponse, DetailedError } from 'hono/client';

// Zustand store action
impersonateUser: async (userId) => {
  try {
    await parseResponse(api.api.admin.users[':userId'].impersonate.$post({
      param: { userId },
      json: { userId },
    }));
    set({ isImpersonating: true });
    window.location.href = '/';
  } catch (error) {
    if (error instanceof DetailedError) {
      toast.error(getUserFriendlyMessage(error.detail?.data?.code));
    } else {
      toast.error('Failed to impersonate user');
    }
  }
},
```

### Type inference utilities

Hono exports `InferRequestType` and `InferResponseType` for cases where you need to type function arguments or return values explicitly:

```typescript
import type { InferRequestType, InferResponseType } from 'hono/client';

type CreateProjectReq = InferRequestType<typeof api.api.orgs[':orgId'].projects.$post>;
type CreateProjectRes = InferResponseType<typeof api.api.orgs[':orgId'].projects.$post>;
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

### 1e. Frontend: Verify Hono version alignment

Both packages must use identical Hono versions to avoid "Type instantiation is excessively deep" errors (official Hono docs warning). Currently both specify `"hono": "^4.12.5"` but pnpm has resolved both 4.12.5 and 4.11.4. Pin to the same exact version or ensure deduplication.

### 1f. Frontend: Create `lib/rpc.ts`

Create the typed `hc` client using the `hcWithType` pattern as described in the Architecture Decision section. No custom fetch or helper functions needed -- `parseResponse` from `hono/client` handles everything.

### 1g. Frontend: Update `lib/queryClient.ts`

Add global error handlers for `DetailedError` from `hono/client`:
- Mutation `onError`: extract domain error from `error.detail.data`, show toast via `getUserFriendlyMessage()`
- Query retry: skip retries for client errors (4xx) using `error.statusCode`
- Auth redirect: subscribe to query cache for `AUTH_REQUIRED`/`AUTH_EXPIRED`

### 1h. Verify end-to-end

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
  queryFn: () => parseResponse(api.api.billing.subscription.$get()),
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
  return parseResponse(api.api.billing.checkout.$post({ json: data }));
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
await parseResponse(api.api.orgs[':orgId'].projects.$post({
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
  return parseResponse(api.api.admin.users.$get({
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
    queryFn: () => parseResponse(api.api.admin.stats.$get()),
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
- **IDE performance**: Large chained types can slow down TypeScript. Mitigated by the `hcWithType` pattern (official Hono recommendation) which pre-computes the client type at compile time. Consider TypeScript project references if still slow.
- **Hono version mismatch**: Both packages MUST use identical Hono versions. Mismatched versions cause "Type instantiation is excessively deep and possibly infinite" errors. Currently both specify `^4.12.5` but pnpm has resolved 4.11.4 alongside 4.12.5 -- deduplicate before starting.
- **`c.notFound()` loses type info**: Don't use `c.notFound()` in RPC endpoints. Return `c.json({ error: 'not found' }, 404)` instead.
- **Path params must be strings**: `hc` requires all path and query params to be strings. Numbers must be `.toString()`'d.
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
