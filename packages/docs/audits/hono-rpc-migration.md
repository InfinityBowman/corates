# Hono RPC Migration Plan

## Status: POC Complete, Ready for Incremental Adoption

## What

Migrate from manually-typed `apiFetch` calls to Hono's type-safe RPC client (`hc`), which infers request/response types directly from backend route definitions.

## Why

- **Type drift**: Frontend defines `Subscription` interface manually; backend defines `SubscriptionResponseSchema` with Zod. These can silently diverge (the backend has `accessMode`, `source`, `projectCount` fields that the frontend interface doesn't know about).
- **No compile-time safety**: Changing a response shape on the backend won't produce a type error on the frontend.
- **Redundant work**: Every API endpoint requires maintaining types in two places.

## POC Results

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

## Migration Steps Per Route Group

### 1. Backend: Chain `.openapi()` Calls

**Before:**

```typescript
const routes = new OpenAPIHono<{ Bindings: Env }>();
routes.use('*', requireAuth);
routes.openapi(routeA, handlerA); // type lost
routes.openapi(routeB, handlerB); // type lost
export { routes };
```

**After:**

```typescript
import { $, OpenAPIHono } from '@hono/zod-openapi';

const base = new OpenAPIHono<{ Bindings: Env }>();

const routes = $(base.use('*', requireAuth))
  .openapi(routeA, handlerA) // type accumulates
  .openapi(routeB, handlerB); // type accumulates

export { routes };
export type Routes = typeof routes;
```

Key details:

- `$()` converts the `Hono` type returned by `.use()` back to `OpenAPIHono`
- Each `.openapi()` must chain (assign return value), not be a standalone statement
- Export `typeof routes` for the frontend to import

### 2. Backend: Chain `.route()` Calls in Parent Routers

Same pattern applies to `billing/index.ts` and `index.ts`:

```typescript
// Before
const app = new OpenAPIHono();
app.route('/api/billing', billingRoutes);
app.route('/api/users', userRoutes);

// After
const app = new OpenAPIHono().route('/api/billing', billingRoutes).route('/api/users', userRoutes);

export type AppType = typeof app;
```

### 3. Frontend: Create Typed Client

```typescript
import { hc } from 'hono/client';
import type { AppType } from '../../../workers/src/index';
import { API_BASE } from '@/config/api';

export const api = hc<AppType>(API_BASE, {
  init: { credentials: 'include' },
});
```

Consider adding a tsconfig path alias to clean up the import:

```json
// landing/tsconfig.json
"paths": {
  "@workers/*": ["../workers/src/*"]
}
```

### 4. Frontend: Convert Query Functions

```typescript
// Before
const query = useQuery({
  queryFn: () => apiFetch.get<Subscription>('/api/billing/subscription'),
});

// After
const query = useQuery({
  queryFn: async () => {
    const res = await api.api.billing.subscription.$get();
    if (!res.ok) throw new Error('Failed to fetch subscription');
    return res.json();
  },
});
```

The `Subscription` interface becomes unnecessary -- the type is inferred from the route.

### 5. Frontend: Remove Manual Interfaces

After converting all consumers of a given type, delete the manually-defined interface. The Zod schema on the backend is the single source of truth.

## Migration Order (Suggested)

Start with read-only GET endpoints (lowest risk), then move to mutations:

1. **Billing subscription** routes (3 endpoints, POC already done)
2. **Billing validation/invoices** (2 endpoints, read-only)
3. **User routes** (profile, settings)
4. **Google Drive** routes
5. **Org/project** routes (larger, more endpoints)
6. **Billing checkout/portal** (mutations, redirects)
7. **Admin** routes (internal, lower priority)

## Gotchas

- **`$()` helper**: Needed when mixing `.use()` middleware with `.openapi()` since `.use()` returns `Hono` not `OpenAPIHono`
- **IDE performance**: Large chained types can slow down TypeScript. Mitigate with `export type AppType = typeof app` (pre-compiles the type) and TypeScript project references
- **Error responses**: Handlers must use literal status codes, not dynamic `error.statusCode as ContentfulStatusCode`
- **`hc` needs absolute URLs**: `API_BASE` must be a full URL (e.g., `http://localhost:8787`), not a relative path
- **Credentials**: Pass `{ init: { credentials: 'include' } }` to `hc()` for cookie auth
- **Import path**: Currently uses relative path `../../../workers/src/...`. Should be cleaned up with tsconfig path alias or package exports

## Files Modified in Prep Work

- All route files in `packages/workers/src/routes/` -- removed `@ts-expect-error`, literal status codes
- `packages/workers/src/routes/billing/subscription.ts` -- chained `.openapi()` calls, exports type
- `packages/landing/package.json` -- added `hono` dependency
