# Hono → TanStack Start migration

The Hono app in `packages/workers` was migrated to TanStack Start file routes in `packages/web` over 27 numbered passes; tracked in [#484](https://github.com/InfinityBowman/corates/issues/484), [#485](https://github.com/InfinityBowman/corates/issues/485), [#486](https://github.com/InfinityBowman/corates/issues/486). Per-pass narrative lives in `git log`. Post-migration follow-ups (what didn't survive): [post-migration-regressions.md](./post-migration-regressions.md).

## Current architecture

- **API routes** live in `packages/web/src/routes/api/**` as TanStack file routes.
- **`packages/workers`** is now a library workspace (Durable Objects, commands, lib helpers, auth/email, queue consumer) consumed via subpath exports declared in `packages/workers/package.json`. It no longer deploys.
- **`packages/web/src/server.ts`** is the worker entry. It (1) routes WebSocket-DO paths (`/api/project-doc/*`, `/api/sessions/*`) to DO stubs *before* TanStack — TanStack Start can't pass WS upgrades through, (2) calls `createStartHandler(defaultStreamHandler)` for everything else, threading `cloudflareCtx` through `context` so handlers can `waitUntil`, (3) wraps the whole thing in `Sentry.withSentry`, (4) delegates queue consumption to `handleEmailQueue` from `@corates/workers/queue`.

## Adding a route

```ts
// packages/web/src/routes/api/orgs/$orgId/some-path.ts
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { requireOrgMembership } from '@/server/guards/requireOrgMembership';

type HandlerArgs = { request: Request; params: { orgId: string } };

export const handleGet = async ({ request, params }: HandlerArgs) => {
  const guard = await requireOrgMembership(request, env, params.orgId);
  if (!guard.ok) return guard.response;
  // ... business logic, return Response.json(...)
};

export const Route = createFileRoute('/api/orgs/$orgId/some-path')({
  server: { handlers: { GET: handleGet } },
});
```

- Export `handleGet`/`handlePost`/`handlePut`/`handleDelete` named so tests can import directly without going through the router.
- TanStack regenerates `routeTree.gen.ts` on file changes (gitignored). Sometimes needs a `pnpm --filter web build` to pick up new files.
- For fire-and-forget work (notifications, async logging, ledger updates), extend args with `context?: { cloudflareCtx?: ExecutionContext }` and check `context?.cloudflareCtx?.waitUntil`. Tests omit it; production has it. See `routes/api/admin/orgs/$orgId/subscriptions.ts`'s `dispatchSubscriptionNotify` helper.

## Guards (`packages/web/src/server/guards/`)

Discriminated-union return: `{ ok: true; context } | { ok: false; response }`.

- `requireOrgMembership(request, env, orgId, minRole?)`
- `requireProjectAccess(request, env, orgId, projectId, minRole?)`
- `requireOrgWriteAccess(method, env, orgId)` — early-returns for read methods
- `requireEntitlement(env, orgId, key)`
- `requireQuota(env, orgId, getUsage, requested?)`
- `requireAdmin(request, env)` — bundles CSRF (mutations only) → session → admin role. CSRF is bundled here because the Hono mount applied `requireTrustedOrigin` umbrella-style; bundling preserves that without per-route boilerplate.
- `requireTrustedOrigin(request, { isProduction })` — standalone CSRF; only `stop-impersonation.ts` uses it directly (impersonated user lacks admin role).

Call order for write routes: `requireOrgMembership` → `requireOrgWriteAccess` → `requireProjectAccess`. For project sub-routes, put `requireOrgMembership` first so a stranger gets `not_org_member` rather than `project_access_denied`.

## Tests

Tests call handlers directly — no routing, no `app.fetch`. Use `env` from `cloudflare:test` for real D1/R2/DOs.

```ts
import { env } from 'cloudflare:test';
import { handleGet } from '../some-route';

vi.mock('@corates/workers/auth', () => ({
  getSession: async () => ({ user: { id: 'u1', email: 'u1@example.com', name: 'U1' }, session: { id: 'sess', userId: 'u1' } }),
}));
```

Mock `@corates/workers/auth.getSession` to impersonate users. Mock `@corates/workers/billing-resolver.resolveOrgAccess` for quota/entitlement paths. Postmark mock only needed if the route sends email.

**Mutating admin tests must include a trusted Origin header** because `requireAdmin` runs CSRF first. Use `origin: 'http://localhost:3010'` in request init or via the `jsonReq`/`deleteReq` helpers in those test files.

## Gotchas worth knowing

- **Subpath exports + type firewalls.** Web doesn't pull in `@cloudflare/workers-types`. Any subpath export whose public surface includes `DurableObject<Env>` or `MessageBatch` types needs a hand-written `.d.ts` firewall stub — see `packages/workers/{durable-objects,queue,auth,types}.d.ts`. Without it web's tsc complains about missing `ctx`/`Message`.
- **R2 boundary types.** When web transitively compiles workers code, R2 types can come back as `unknown`. Annotate explicitly at the boundary — see `packages/workers/src/commands/lib/doSync.ts`.
- **TanStack file-route specificity wins over splats.** Routes sort Index → Static (most-specific first) → Dynamic (longest first) → Splat ([Route Matching docs](https://tanstack.com/router/latest/docs/routing/route-matching)). So `routes/api/auth/stripe/webhook.ts` reliably beats `routes/api/auth/$.ts` regardless of definition order.
- **Catch-all handlers must be exported when tested.** TanStack types `server.handlers` as a function (not a record), so `Route.options.server!.handlers!.POST` fails to typecheck. Export the handler function (`export const handle = ...`) and import it directly.
- **`vi.mock` factories can't reference module-scoped variables.** Hoisting throws `Cannot access 'mockFn' before initialization`. Use `const { mockFn } = vi.hoisted(() => ({ mockFn: vi.fn() }))`.
- **Self-action validation uses `details.constraint`, not `details.reason`.** `createValidationError` puts the value in `details.constraint`. Trip wires: self-ban, self-impersonate, self-delete in admin user routes.
- **`createInvitation` always sets `grantOrgMembership: true`.** The Hono schema accepted it as optional, but the command hard-codes true. Tests rely on this.
- **`DEV_MODE` in tests.** Dev routes need `"DEV_MODE": true` in `packages/web/wrangler.test.jsonc`. Don't try `vi.mock('cloudflare:workers')` — it hangs the pool.
- **Client error throws are plain objects.** Callers `throw data` directly where `data` already has `code` + `statusCode`. The Hono-RPC era `DetailedError instanceof` checks are gone — just shape-check.

## Future: fold workers into web

The workers package is now a library workspace whose only consumer is web. Folding its source into `packages/web/src/server/` would eliminate the subpath-export indirection. Mechanical refactor; touches every `@corates/workers/*` import site. Do it when the indirection becomes annoying.
