# TanStack Usage Gaps in CoRATES

Date: 2026-04-19 (updated 2026-04-20)
Scope: `packages/web` against TanStack Router 1.168 / Start 1.167 / Query 5.96
Method: Read official docs from `reference/tanstack-router/docs/{router,start}/...` and compared against the live codebase. Findings below were each verified against the source doc and the cited file:line.

Companion to `typescript-audit-2026-04.md` -- that audit covered language-level patterns. This one covers framework-level patterns specifically.

## TL;DR

The codebase is on a current TanStack Start version. The middleware stack is fully built out: `logMiddleware` (structured logging via evlog) chains into `dbMiddleware` (Drizzle client), which chains into `authMiddleware` (session resolution + user identification), which optionally chains into `adminMiddleware`. All production routes have logging; all authenticated routes get session via middleware context. Guards (`requireOrgMembership`, `requireProjectAccess`) accept `session` from middleware context. Zero `createDb(env.DB)` calls remain in source files.

The remaining framework-level gaps are: no `loader`s (biggest user-visible win), no path-param validation, and no `createServerFn` usage.

## Verified facts (counts)

- **0** uses of `createServerFn`
- **1** page route uses `loader:` (`admin/users.$userId.tsx` -- pilot)
- **57** `$projectId`/`$orgId`/`$userId` route files with no path-param validation
- `verbatimModuleSyntax: false` in `packages/web/tsconfig.json`

---

## High impact

### G3. No path-param validation

**Doc:** `path-params.md` shows params arrive as raw strings (`{ postId: '123' }`). The canonical validation places are `beforeLoad`/`loader` for page routes, or middleware for API routes.

**CoRATES:** 30+ `$projectId`, `$orgId`, `$userId`, `$studyId`, etc. routes. Sample: `routes/api/admin/projects/$projectId.ts:22` types `params: { projectId: string }` with no format check. Malformed IDs surface as DB query failures instead of 400s.

**Fix shape:** A `requireValidParams(schema)` middleware factory keeps the validation declarative at the route level:

```ts
const projectIdMiddleware = createParamsMiddleware(z.object({ projectId: z.string().uuid() }));

server: { middleware: [authMiddleware, projectIdMiddleware], handlers: { GET: handleGet } }
```

**Cost:** 1-2 days.

---

### G4. No `loader` for SSR data prefetch -- every page does its own client `useQuery`

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

**CoRATES:** Pilot implemented on `admin/users.$userId.tsx`. Pattern: `queryOptions()` factory in `useAdminQueries.ts`, `loader` calls `queryClient.prefetchQuery()`, component uses `useSuspenseQuery()` with a `Suspense` boundary. Route-level `errorComponent` handles fetch failures. Remaining page routes still use client-side `useQuery` with spinners.

**Why this matters here:** the project pays for SSR (Cloudflare Workers running TanStack Start) but throws away the data-prefetch portion of it. The HTML arrives, then the JS hydrates, then the queries fire, then the data shows. With loaders, the data is in the HTML.

**Next:** confirm the pilot works end-to-end in the deployed worker (SSR prefetch, client-side navigation, error handling), then incrementally adopt the pattern across remaining page routes.

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

**Note:** `useAuthStore.getState()` is Zustand's vanilla-store getter, not a React hook -- calling it outside a component is correct. The recommendation is router context for testability, SSR safety, and type-safety reasons.

**Cost:** 1-2 hours, separate refactor.

---

### G7. `.server.ts` / `.functions.ts` file naming not used

The Start compiler uses naming conventions to guarantee server-only code stays out of the client bundle:

- `*.functions.ts` -- `createServerFn` wrappers, safe to import anywhere
- `*.server.ts` -- server-only code, only safe inside server function handlers
- `*.ts` (no suffix) -- client-safe (types, schemas, constants)

**CoRATES:** API routes live in `routes/api/**/*.ts` and rely on TanStack Start to strip server code by file location. This works _for the routes themselves_, but if anyone imports a non-route file that contains server code (e.g. importing a constant from `server/billing-context.ts` into a component), the server code can leak into the client bundle.

**Action:** quick grep audit of imports from `server/` and `routes/api/` into non-route TS files; rename any found offenders to `.server.ts`.

**Cost:** 1-2 hours of audit + rename.

---

## Low impact

### G8. `verbatimModuleSyntax: false` in `packages/web/tsconfig.json`

Modern TanStack/Vite projects set this `true`. Forces explicit `import type { ... }` for type-only imports. Pairs with G7 -- explicit type imports make accidental _runtime_ imports of server-only modules visible at the import site.

**Cost:** one-time autofixable cleanup pass via `eslint --fix` with the right rule.

---

## Suggested order of attack

| #   | Change                                         |                    Cost | Why now                                                                          |
| --- | ---------------------------------------------- | ----------------------: | -------------------------------------------------------------------------------- |
| 1   | Incremental loader adoption, page by page (G4) |                 ongoing | Biggest user-visible win. Pilot on `admin/users.$userId.tsx` needs verification. |
| 2   | Path-param Zod via param middleware (G3)       |                1-2 days | Rides on the existing middleware system.                                         |
| 3   | Router context for auth (G5)                   |                  1-2 hr | Separate refactor; don't bundle.                                                 |
| 4   | `.server.ts` audit (G7)                        |                  1-2 hr | One-time cleanup.                                                                |
| 5   | `verbatimModuleSyntax: true` (G8)              | 1-2 hr (mostly autofix) | One-time cleanup.                                                                |
