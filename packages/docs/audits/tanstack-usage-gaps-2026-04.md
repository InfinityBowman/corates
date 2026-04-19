# TanStack Usage Gaps in CoRATES

Date: 2026-04-19 (updated 2026-04-19)
Scope: `packages/web` against TanStack Router 1.168 / Start 1.167 / Query 5.96
Method: Read official docs from `reference/tanstack-router/docs/{router,start}/...` and compared against the live codebase. Findings below were each verified against the source doc and the cited file:line.

Companion to `typescript-audit-2026-04.md` — that audit covered language-level patterns. This one covers framework-level patterns specifically.

## TL;DR

The codebase is on a current TanStack Start version. `adminMiddleware` via `createMiddleware` is fully adopted across all admin routes. `dbMiddleware` is composed into the admin middleware chain; all 62 admin-route `createDb` calls have been replaced with `context.db`. The remaining framework-level gaps are: no `loader`s (biggest user-visible win), 45 non-admin `createDb` calls still to migrate, no path-param validation, and no `createServerFn` usage.

## Verified facts (counts)

- **0** uses of `createServerFn`
- **0** uses of `loader:` in any page route
- **44** admin routes using `middleware: [adminMiddleware]` (DONE)
- **57** `$projectId`/`$orgId`/`$userId` route files with no path-param validation
- **45** non-admin handlers still calling `createDb(env.DB)` (was 182; admin routes now use `context.db` via `dbMiddleware`)
- `verbatimModuleSyntax: false` in `packages/web/tsconfig.json`

---

## High impact

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
  loader: ({ context, params }) => context.queryClient.ensureQueryData(projectQueryOptions(params.projectId)),
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

**Important clarification:** `useAuthStore.getState()` is Zustand's vanilla-store getter, **not** the React `useAuthStore()` hook — calling it outside a component is the _correct_ Zustand pattern, not a hooks-rules violation. The earlier draft of this audit got that wrong.

**Why router context is still better:**

1. **Testability** — can inject a fake auth context per test instead of mutating a module-level store.
2. **SSR safety** — global module-level state shared between concurrent requests on a Cloudflare Worker is a real bug risk; per-request context is not.
3. **Type-safety** — `context.auth` is typed at every `beforeLoad` call site without imports.

**Cost:** 1–2 hours, but a separate refactor — don't bundle with G2.

---

### G6. Repeated `createDb(env.DB)` at the top of every handler

**Doc:** `databases.md` + `middleware.md` together imply the pattern: create the DB client in middleware, attach to `context`, every handler reads `context.db`.

**CoRATES:** Originally 182 handlers called `createDb(env.DB)`. Admin routes (62 calls across 35 files) have been migrated to `context.db` via `dbMiddleware` composed into `adminMiddleware`. **45 calls remain** in non-admin routes and guards.

**Done (admin):** `dbMiddleware` in `src/server/middleware/db.ts` creates the Drizzle client and attaches `context.db`. It is composed into `authMiddleware` which feeds `adminMiddleware`. All 35 admin route files now read `db` from context.

**Remaining:** Non-admin routes (billing, orgs, users, google-drive, accounts) and guards (`requireOrgMembership`, `requireProjectAccess`, etc.) still call `createDb(env.DB)` directly. These need their own auth middleware chain or direct `dbMiddleware` composition.

---

### G7. `.server.ts` / `.functions.ts` file naming not used

**Docs:**

- `reference/tanstack-router/docs/start/framework/react/guide/code-execution-patterns.md`
- `reference/tanstack-router/docs/start/framework/react/guide/import-protection.md`

The Start compiler uses naming conventions to guarantee server-only code stays out of the client bundle:

- `*.functions.ts` — `createServerFn` wrappers, safe to import anywhere
- `*.server.ts` — server-only code, only safe inside server function handlers
- `*.ts` (no suffix) — client-safe (types, schemas, constants)

**CoRATES:** API routes live in `routes/api/**/*.ts` and rely on TanStack Start to strip server code by file location. This works _for the routes themselves_, but if anyone imports a non-route file that contains server code (e.g. importing a constant from `server/billing-context.ts` into a component), the server code can leak into the client bundle.

**Action:** quick grep audit of imports from `server/` and `routes/api/` into non-route TS files; rename any found offenders to `.server.ts`.

**Cost:** 1–2 hours of audit + rename.

---

## Low impact

### G8. `verbatimModuleSyntax: false` in `packages/web/tsconfig.json`

Modern TanStack/Vite projects set this `true`. Forces explicit `import type { ... }` for type-only imports. Pairs with G7 — explicit type imports make accidental _runtime_ imports of server-only modules visible at the import site.

**Cost:** one-time autofixable cleanup pass via `eslint --fix` with the right rule.

---

## Suggested order of attack

| #   | Change                                                                           |                    Cost | Why now                                                                              |
| --- | -------------------------------------------------------------------------------- | ----------------------: | ------------------------------------------------------------------------------------ |
| 1   | ~~Add `dbMiddleware`, compose into `adminMiddleware`, sweep admin `createDb` calls (G6)~~ DONE |           -- | Admin routes now use `context.db`; 45 non-admin calls remain for future sweep.     |
| 2   | **Pilot:** add `loader` + `useSuspenseQuery` to **one** page route (G4)          |                half day | Confirm SSR prefetch works in the worker setup before sweeping.                      |
| 3   | If pilot succeeds: incremental loader adoption, page by page                     |                 ongoing | Biggest user-visible win.                                                            |
| 4   | Path-param Zod via param middleware (G3)                                         |                1–2 days | Rides on the existing middleware system.                                             |
| 5   | Router context for auth (G5)                                                     |                  1–2 hr | Separate refactor; don't bundle.                                                     |
| 6   | `.server.ts` audit (G7)                                                          |                  1–2 hr | One-time cleanup.                                                                    |
| 7   | `verbatimModuleSyntax: true` (G8)                                                | 1–2 hr (mostly autofix) | One-time cleanup.                                                                    |

The **loader pilot** in item 2 is deliberately scoped to one route — it's a pattern shift that interacts with TanStack Start's Cloudflare Workers integration in ways the docs don't fully cover.

---

## Methodology notes

- All findings verified against the local TanStack reference (`reference/tanstack-router/docs/...`) and against the cited CoRATES file:line.
- The earlier draft of this audit incorrectly flagged `useAuthStore.getState()` in `_auth.tsx:26` as a hooks-rules violation. It's Zustand's vanilla store getter, which is safe outside components. The G5 recommendation (router context) still stands but for different reasons (testability, SSR safety, typing).
- The earlier draft also referenced a `params: { parse }` API for path-param validation. That API exists but isn't the canonical pattern in the docs — validation goes in `beforeLoad`/`loader` for page routes or middleware for API routes. G3 has been corrected accordingly.
