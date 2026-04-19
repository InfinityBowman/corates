# TanStack Usage Gaps in CoRATES

Date: 2026-04-19
Scope: `packages/web` against TanStack Router 1.168 / Start 1.167 / Query 5.96
Method: Read official docs from `reference/tanstack-router/docs/{router,start}/...` and compared against the live codebase. Findings below were each verified against the source doc and the cited file:line.

Companion to `typescript-audit-2026-04.md` — that audit covered language-level patterns. This one covers framework-level patterns specifically.

## TL;DR

The codebase is on a current TanStack Start version but uses very few of the framework's structural patterns. Most notably, **the entire `createMiddleware` system is unused** — every admin route hand-rolls a guard call. That single pattern, properly adopted, collapses three other gaps in this audit (auth, db client, path-param validation) into one place.

The biggest user-visible win is **adopting route `loader`s** for the SSR data-prefetch pipe — currently every page mounts → fires `useQuery` → spinner → data arrives, even though the project pays for SSR on Cloudflare Workers.

## Verified facts (counts)

- **0** uses of `createServerFn`
- **0** uses of `loader:` in any page route
- **0** uses of `createMiddleware` (every admin route hand-rolls `await requireAdmin(request, env)`)
- **2** routes use `validateSearch`, both with `as string` casts inside the validator
- **30+** `$projectId`/`$orgId`/`$userId` routes with no path-param validation
- **~100** handlers calling `createDb(env.DB)` at the top of the function
- `verbatimModuleSyntax: false` in `packages/web/tsconfig.json`

---

## High impact

### G1. `validateSearch` is misused in the only 2 routes that use it

**Doc:** `reference/tanstack-router/docs/router/guide/search-params.md` (~line 145)

The official Zod pattern is:
```ts
const schema = z.object({
  page: z.number().catch(1),
  filter: z.string().catch(''),
  sort: z.enum(['newest', 'oldest', 'price']).catch('newest'),
});

export const Route = createFileRoute('/shop/products')({
  validateSearch: schema, // accepts anything with .parse
});
```
Use `.catch(default)` for graceful fallback, `.default()` to surface validation errors via `errorComponent`.

**CoRATES:** `routes/_auth/check-email.tsx:15-17` and `routes/_auth/reset-password.tsx:20-22`:
```ts
validateSearch: (search: Record<string, unknown>) => ({
  email: (search.email as string) || '',
}),
```
The `as string` cast inside what is literally called a *validator* is the wrong pattern. There's no validation here.

**Fix:** one line per file. Define a `z.object({ email: z.string().email().catch('') })` (or `.default('')`) and pass the schema directly.

**Cost:** 10 minutes total.

---

### G2. `createMiddleware` is the right answer for `requireAdmin`

**Docs:**
- `reference/tanstack-router/docs/start/framework/react/guide/middleware.md`
- `reference/tanstack-router/docs/start/framework/react/guide/server-routes.md` (lines ~163-220)

Two patterns CoRATES is missing:

**Whole-route guard** (applies to all handlers in a route):
```ts
server: { middleware: [authMiddleware], handlers: { GET: handleGet } }
```

**Per-verb guard** (different middleware per HTTP method):
```ts
server: {
  handlers: ({ createHandlers }) =>
    createHandlers({
      GET: handleGet,
      POST: { middleware: [validation], handler: handlePost },
    }),
}
```

`createMiddleware()` itself is composable:
```ts
import { createMiddleware } from '@tanstack/react-start';

const authMiddleware = createMiddleware().server(async ({ next, request }) => {
  const session = await getSession(request, env);
  if (!session) throw new Response(null, { status: 401 });
  return next({ context: { session } }); // typed context propagates to handler
});

const adminMiddleware = createMiddleware()
  .middleware([authMiddleware])
  .server(async ({ next, context }) => {
    if (context.session.user.role !== 'admin') throw new Response(null, { status: 403 });
    return next();
  });
```

**CoRATES:** `routes/api/admin/projects/$projectId.ts:25-26` (representative of all admin routes):
```ts
export const handleGet = async ({ request, params }) => {
  const guard = await requireAdmin(request, env);
  if (!guard.ok) return guard.response;
  // ...handler...
};
```
This pattern is hand-rolled middleware. Repeats across every admin handler.

**What you gain by switching:**
- Auth check happens once per route definition, not once per handler
- `context.session` is **typed** in the handler (currently the handler has no idea the auth check ran or what user it produced — they re-call `getSession`)
- Composable across server functions if you ever add them
- One file to change for cross-cutting concerns (logging, observability, rate limits)

**Cost:** half-day pilot on one route to confirm typed context propagation works on Cloudflare Workers; then sweep admin routes (~30 files) over a couple of days.

**Impact:** highest of any item in this audit — collapses G3 and G6 below into the same pattern.

#### Status (2026-04-19): pilot complete, sweep ready

`adminMiddleware` is implemented in `packages/web/src/server/middleware/admin.ts` and applied to `routes/api/admin/projects/$projectId.ts`. The pilot validated that:

- `createMiddleware().server({ next, context })` propagates typed context to handlers — no annotations needed at the handler.
- The composition `adminMiddleware.middleware([authMiddleware])` resolves session in auth, then layers CSRF + role check on top.
- All behavior parity with the prior `requireAdmin(request, env)` is preserved (auth, CSRF, admin role).

The pilot **also surfaced a test-infrastructure gap**: existing `*.server.test.ts` files call handlers directly (`handleGet({ request, params })`), which bypasses middleware. After migration, those tests would silently false-pass for auth scenarios. Initially this looked like a multi-day blocker.

**Resolution:** the test-worker now mounts `createStartHandler(defaultStreamHandler)` and tests can use `SELF.fetch(new Request(...))` for true end-to-end route invocation. Cost was ~30 LOC of test infrastructure (vitest config aliases for the three `#tanstack-*` virtual modules + two stand-in files). See `packages/docs/guides/testing.md` § "End-to-end route tests" for the canonical pattern, and `packages/web/src/routes/api/admin/__tests__/projects-self.server.test.ts` for a worked example.

**The sweep is now ready.** For each remaining admin route:

1. Replace `await requireAdmin(request, env)` calls in handlers with `[adminMiddleware]` on the route's `server.middleware`.
2. Migrate auth-failure tests from handler-direct calls (`handleGet({ request, params })`) to `SELF.fetch`. Happy-path / business-logic tests can stay handler-direct or move to SELF as needed.
3. Confirm the route is covered — if you add a new admin route without `[adminMiddleware]`, the SELF tests for that route will catch the regression.

Estimated remaining cost: 1–2 days of mechanical sweep across ~30 admin routes, plus a similar pattern for non-admin auth-required routes (org membership, project access).

---

### G3. No path-param validation

**Doc:** `path-params.md` shows params arrive as raw strings (`{ postId: '123' }`). The canonical validation places are `beforeLoad`/`loader` for page routes, or middleware for API routes.

**CoRATES:** 30+ `$projectId`, `$orgId`, `$userId`, `$studyId`, etc. routes. Sample: `routes/api/admin/projects/$projectId.ts:22` types `params: { projectId: string }` with no format check. Malformed IDs surface as DB query failures instead of 400s.

**Fix shape:** ride on the middleware from G2. A `requireValidParams(schema)` middleware factory keeps the validation declarative at the route level:
```ts
const projectIdMiddleware = createParamsMiddleware(z.object({ projectId: z.string().uuid() }));

server: { middleware: [authMiddleware, projectIdMiddleware], handlers: { GET: handleGet } }
```

**Cost:** rolled into G2 work.

---

### G4. No `loader` for SSR data prefetch — every page does its own client `useQuery`

**Docs:**
- `reference/tanstack-router/docs/router/guide/data-loading.md`
- `reference/tanstack-router/docs/router/guide/external-data-loading.md`

Recommended pattern:
```ts
// route file
export const Route = createFileRoute('/projects/$projectId')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(projectQueryOptions(params.projectId)),
  component: ProjectPage,
});

// component
function ProjectPage() {
  const { projectId } = Route.useParams();
  const { data } = useSuspenseQuery(projectQueryOptions(projectId)); // already populated, no spinner on SSR
  // ...
}
```

**CoRATES:** **0 page routes use `loader:`.** Every page mounts, fires `useQuery`, shows a spinner, data arrives.

**Why this matters here:** the project pays for SSR (Cloudflare Workers running TanStack Start) but throws away the data-prefetch portion of it. This is a real user-visible TTFB regression vs what the framework supports — the HTML arrives, then the JS hydrates, then the queries fire, then the data shows. With loaders, the data is in the HTML.

**Cost:** half-day pilot on one high-traffic page route to confirm the SSR pipe works end-to-end with this codebase's setup, then incremental adoption per page.

**Impact:** biggest user-visible win in this audit.

---

## Medium impact

### G5. Authenticated layout reads from a global store instead of router context

**Docs:**
- `reference/tanstack-router/docs/router/guide/authenticated-routes.md`
- `reference/tanstack-router/docs/router/guide/router-context.md`

Recommended pattern: declare auth on `createRouter({ context: { auth: undefined! } })`, inject at provider, read in `beforeLoad: ({ context }) => { ... }`.

**CoRATES:** `routes/_auth.tsx:26`:
```ts
beforeLoad: ({ location }) => {
  // ...
  const state = useAuthStore.getState();
  const isLoggedIn = selectIsLoggedIn(state);
  if (isLoggedIn) throw redirect({ to: '/dashboard' });
},
```

**Important clarification:** `useAuthStore.getState()` is Zustand's vanilla-store getter, **not** the React `useAuthStore()` hook — calling it outside a component is the *correct* Zustand pattern, not a hooks-rules violation. The earlier draft of this audit got that wrong.

**Why router context is still better:**
1. **Testability** — can inject a fake auth context per test instead of mutating a module-level store.
2. **SSR safety** — global module-level state shared between concurrent requests on a Cloudflare Worker is a real bug risk; per-request context is not.
3. **Type-safety** — `context.auth` is typed at every `beforeLoad` call site without imports.

**Cost:** 1–2 hours, but a separate refactor — don't bundle with G2.

---

### G6. Repeated `createDb(env.DB)` at the top of every handler

**Doc:** `databases.md` + `middleware.md` together imply the pattern: create the DB client in middleware, attach to `context`, every handler reads `context.db`.

**CoRATES:** `createDb(env.DB)` appears at the top of ~100 route handlers.

**Fix:** rolls into G2's middleware work — one `dbMiddleware` adds `context.db` for every downstream handler.

---

### G7. `.server.ts` / `.functions.ts` file naming not used

**Docs:**
- `reference/tanstack-router/docs/start/framework/react/guide/code-execution-patterns.md`
- `reference/tanstack-router/docs/start/framework/react/guide/import-protection.md`

The Start compiler uses naming conventions to guarantee server-only code stays out of the client bundle:
- `*.functions.ts` — `createServerFn` wrappers, safe to import anywhere
- `*.server.ts` — server-only code, only safe inside server function handlers
- `*.ts` (no suffix) — client-safe (types, schemas, constants)

**CoRATES:** API routes live in `routes/api/**/*.ts` and rely on TanStack Start to strip server code by file location. This works *for the routes themselves*, but if anyone imports a non-route file that contains server code (e.g. importing a constant from `server/billing-context.ts` into a component), the server code can leak into the client bundle.

**Action:** quick grep audit of imports from `server/` and `routes/api/` into non-route TS files; rename any found offenders to `.server.ts`.

**Cost:** 1–2 hours of audit + rename.

---

## Low impact

### G8. `verbatimModuleSyntax: false` in `packages/web/tsconfig.json`

Modern TanStack/Vite projects set this `true`. Forces explicit `import type { ... }` for type-only imports. Pairs with G7 — explicit type imports make accidental *runtime* imports of server-only modules visible at the import site.

**Cost:** one-time autofixable cleanup pass via `eslint --fix` with the right rule.

---

## Suggested order of attack

| # | Change | Cost | Why now |
|---|---|---:|---|
| 1 | Fix the 2 broken `validateSearch` calls (G1) | 10 min | Free. Removes a clearly-wrong pattern. |
| 2 | **Pilot:** build `authMiddleware` via `createMiddleware`, apply to **one** admin route (G2) | half day | Confirm typed context propagation works on Cloudflare Workers before committing to a sweep. |
| 3 | If pilot succeeds: add `dbMiddleware`, compose `apiAuthMiddleware = [auth, db]`, sweep admin routes (G2 + G6) | 2–3 days | Highest-leverage cleanup. Sets up G3 to ride on the same middleware. |
| 4 | **Pilot:** add `loader` + `useSuspenseQuery` to **one** page route (G4) | half day | Confirm SSR prefetch works in the worker setup before sweeping. |
| 5 | If pilot succeeds: incremental loader adoption, page by page | ongoing | Biggest user-visible win. |
| 6 | Path-param Zod via param middleware (G3) | 1–2 days | Rides on G2's middleware system. |
| 7 | Router context for auth (G5) | 1–2 hr | Separate refactor; don't bundle. |
| 8 | `.server.ts` audit (G7) | 1–2 hr | One-time cleanup. |
| 9 | `verbatimModuleSyntax: true` (G8) | 1–2 hr (mostly autofix) | One-time cleanup. |

The two **pilots** in items 2 and 4 are deliberately scoped to one route each. Both are pattern shifts that interact with TanStack Start's Cloudflare Workers integration in ways the docs don't fully cover — better to confirm they work than to do a sweep and discover a problem on route #28.

---

## Methodology notes

- All findings verified against the local TanStack reference (`reference/tanstack-router/docs/...`) and against the cited CoRATES file:line.
- The earlier draft of this audit incorrectly flagged `useAuthStore.getState()` in `_auth.tsx:26` as a hooks-rules violation. It's Zustand's vanilla store getter, which is safe outside components. The G5 recommendation (router context) still stands but for different reasons (testability, SSR safety, typing).
- The earlier draft also referenced a `params: { parse }` API for path-param validation. That API exists but isn't the canonical pattern in the docs — validation goes in `beforeLoad`/`loader` for page routes or middleware for API routes. G3 has been corrected accordingly.
