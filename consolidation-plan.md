# Corates Consolidation Plan

Migrating corates from a split `packages/web` + `packages/workers` monorepo onto a single TanStack Start worker, mirroring the do-sync pattern. One exception: the Stripe purchase webhook stays as a separate, minimal worker.

## TL;DR

**Today:** Two workers on the same `corates.org` zone, routed by wrangler `routes` patterns. `packages/web` (TanStack Start, static+SSR only). `packages/workers` (Hono + 66 routes + `UserSession`/`ProjectDoc` DOs + email queue + Stripe webhooks). Frontend calls backend over HTTP with CORS + `credentials: 'include'` — a real network hop, not a service binding.

**Target:** One TanStack Start worker handling frontend + all API + both DOs. One separate `corates-stripe-purchases` worker owning `/api/billing/purchases/webhook`. One separate `corates-emails` worker consuming the email queue. All three share the same D1.

**Net:** Fewer moving parts (2 → 3, but each much smaller/simpler), no internal network hop, same-origin cookies (drop most CORS config), unified type sharing without a package boundary. Stripe purchase webhook isolation preserves deploy-cadence safety for payments. Email queue consumer isolation preserves `vite dev` UX for the main app (Cloudflare's vite-plugin does not support queue consumers in dev mode).

## Target architecture

```
corates.org/*  →  corates-app (TanStack Start worker)
  ├─ Routes: SSR frontend + /api/* (all non-purchase-webhook)
  ├─ DOs: UserSession, ProjectDoc
  ├─ Bindings: D1, R2, EMAIL_QUEUE (producer only), DO namespaces
  └─ Entry: src/server.ts (default fetch + named DO exports)

corates.org/api/billing/purchases/webhook  →  corates-stripe-purchases (separate worker)
  ├─ Stripe signature verification + idempotency ledger
  ├─ Bindings: D1 (shared), STRIPE_WEBHOOK_SECRET_PURCHASES
  └─ Independent deploy cadence; pinned to stable versions

(queue consumer: corates-emails)  →  corates-emails (separate worker)
  ├─ Consumes corates-emails queue; Postmark delivery
  ├─ Bindings: D1 (for idempotency/logging if needed), SMTP secrets
  └─ Reason: @cloudflare/vite-plugin does not support queue consumers
     in dev; splitting preserves `vite dev` for the main app.
```

## What consolidates vs stays separate

| Current concern                                                            | Target home                          | Rationale                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/web` (SSR frontend)                                              | corates-app                          | TanStack Start owns it already                                                                                                                                                                                                                                                                                                                                     |
| `/api/auth/*` (better-auth, incl. subscription webhooks via stripe plugin) | corates-app                          | Same-origin cookies simplify everything                                                                                                                                                                                                                                                                                                                            |
| `/api/orgs`, `/api/users`, `/api/users/avatar`                             | corates-app                          | Plain CRUD, only called by frontend                                                                                                                                                                                                                                                                                                                                |
| `/api/db`, `/api/admin/*`                                                  | corates-app                          | No special isolation needs                                                                                                                                                                                                                                                                                                                                         |
| `/api/google-drive`, `/api/contact`, PDF proxy, test seed, health          | corates-app                          | Plain external-API wrappers                                                                                                                                                                                                                                                                                                                                        |
| `/api/billing/*` (checkout, portal, read-only)                             | corates-app                          | Customer-initiated, same lifecycle as UI                                                                                                                                                                                                                                                                                                                           |
| `/api/billing/purchases/webhook`                                           | **corates-stripe-purchases**         | Stripe-initiated; signature verification + idempotency; frontend rebuild must not affect retry window. Note: despite the "purchases" name, it currently handles checkout, subscription, invoice, payment_intent, and customer events — see Phase 0 finding #3                                                                                                      |
| `UserSession` DO (WS notifications)                                        | corates-app                          | DO bindings work in TanStack Start workers (see do-sync reference)                                                                                                                                                                                                                                                                                                 |
| `ProjectDoc` DO (Yjs collab)                                               | corates-app                          | Same; WS upgrade handled at Worker boundary before TanStack Start                                                                                                                                                                                                                                                                                                  |
| `corates-emails` queue (consumer)                                          | **corates-emails** (separate worker) | Cloudflare's vite-plugin does not support queue consumers in dev mode (verified in `workers-sdk` source). Keeping the consumer in the TanStack Start worker means `wrangler dev` is required any time you touch queue-consuming code. Splitting preserves the `vite dev` experience for app work. Alternative: accept the dev-mode friction and keep it colocated. |
| `@corates/shared`                                                          | unchanged                            | Types + constants; both workers depend on it                                                                                                                                                                                                                                                                                                                       |
| `@corates/docs` (VitePress)                                                | unchanged                            | Standalone static docs site                                                                                                                                                                                                                                                                                                                                        |
| `@corates/stripe-dev`                                                      | unchanged                            | Dev-only helper scripts                                                                                                                                                                                                                                                                                                                                            |

## Reference pattern (from do-sync)

The blueprint `corates-app` will mirror:

**`wrangler.jsonc` shape:**

```jsonc
{
  "name": "corates-app",
  "compatibility_date": "2025-12-01",
  "compatibility_flags": ["nodejs_compat"],
  "main": "./src/server.ts",
  "assets": { "directory": "./dist/client", "binding": "ASSETS", "html_handling": "drop-trailing-slash" },
  "durable_objects": {
    "bindings": [
      { "name": "USER_SESSION", "class_name": "UserSession" },
      { "name": "PROJECT_DOC", "class_name": "ProjectDoc" },
    ],
  },
  "migrations": [
    // DO NOT change existing tags/class names — they're applied in prod.
    // Snapshot from packages/workers/wrangler.jsonc (see Phase 0 findings):
    { "tag": "v1", "new_sqlite_classes": ["UserSession", "ProjectDoc"] },
    { "tag": "v2", "new_sqlite_classes": ["EmailQueue"] },
    { "tag": "v3", "deleted_classes": ["EmailQueue"] },
  ],
  "d1_databases": [
    /* corates-db / corates-db-prod */
  ],
  "r2_buckets": [
    /* corates-pdfs / corates-pdfs-prod */
  ],
  "queues": {
    "producers": [{ "binding": "EMAIL_QUEUE", "queue": "corates-emails" }],
    "consumers": [{ "queue": "corates-emails", "max_batch_size": 10, "max_retries": 3, "dead_letter_queue": "..." }],
  },
  "routes": [{ "pattern": "corates.org/*", "zone_name": "corates.org" }],
  "observability": { "enabled": true, "head_sampling_rate": 1 },
}
```

**`src/server.ts` shape:**

```ts
import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server';
import { getAuth } from './server/auth';

export { UserSession } from './server/user-session';
export { ProjectDoc } from './server/project-doc';

const startFetch = createStartHandler(defaultStreamHandler);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // WS upgrades go directly to DOs, bypassing TanStack Start.
    if (request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
      // route /api/project/:id/sync  → PROJECT_DOC
      // route /api/session/:userId   → USER_SESSION
      // (auth via better-auth getSession on the incoming headers)
    }

    return startFetch(request);
  },

  async queue(batch, env) {
    // existing email queue consumer logic, moved verbatim
  },
};
```

**`vite.config.ts` plugin order (matches do-sync):**

```ts
plugins: [
  cloudflare({ viteEnvironment: { name: 'ssr' } }),
  tanstackStart({
    /* prerender config */
  }),
  viteReact(),
];
```

**API routes** move from Hono to TanStack Start file-based routes with a `server.handlers` export. For minimum disruption, keep a single catch-all `routes/api/$.ts` that mounts the existing Hono app — then migrate routes incrementally to native TanStack Start server handlers over time:

```ts
// src/routes/api/$.ts
import { createFileRoute } from '@tanstack/react-router'; // NB: react-router, not react-start
import { env } from 'cloudflare:workers';
import { app as honoApp } from '@/server/hono'; // existing Hono instance

export const Route = createFileRoute('/api/$')({
  server: {
    handlers: {
      GET: ({ request }) => honoApp.fetch(request, env),
      POST: ({ request }) => honoApp.fetch(request, env),
      PUT: ({ request }) => honoApp.fetch(request, env),
      PATCH: ({ request }) => honoApp.fetch(request, env),
      DELETE: ({ request }) => honoApp.fetch(request, env),
    },
  },
});
```

Verified against do-sync's `apps/web/src/routes/api/auth.$.ts` (TanStack Start 1.167). This lets you move in one shot without a 66-route rewrite. Refactor to native TanStack Start routes later at your own pace.

## Migration sequence

Order matters. Each step should land independently on `main` with tests passing.

### Phase 0 — Preconditions (completed — findings below)

**1. DO migrations snapshot.** Three tags in prod, all must be preserved verbatim:

```jsonc
{ "tag": "v1", "new_sqlite_classes": ["UserSession", "ProjectDoc"] },
{ "tag": "v2", "new_sqlite_classes": ["EmailQueue"] },
{ "tag": "v3", "deleted_classes": ["EmailQueue"] }
```

The `EmailQueue` class was added in v2 and removed in v3 (presumably when the email path moved to Cloudflare Queues). Omitting v2/v3 would cause wrangler to replay them on a fresh deploy — safe for a new env but must match for the existing namespaces.

**2. Purchase webhook route path corrected.** Actual path is `/api/billing/purchases/webhook` (verified: `packages/workers/src/index.ts:143` mounts `billingRoutes` at `/api/billing`; `routes/billing/webhooks.ts:62` defines `POST /purchases/webhook`). An earlier draft of this plan had `/api/billing/webhook/purchases` — that is wrong; all references have been corrected.

**3. Purchase webhook scope is broader than the name suggests.** `routes/billing/webhookRouter.ts` handles 14 event types, not just checkout sessions:

- `checkout.session.completed`
- `customer.subscription.{created,updated,deleted,paused,resumed}` (5 events)
- `invoice.{payment_succeeded,payment_failed,finalized}` (3 events)
- `payment_intent.{processing,succeeded,payment_failed}` (3 events)
- `customer.{updated,deleted}` (2 events)

This overlaps conceptually with the better-auth stripe plugin webhook (which also handles subscription lifecycle). Two distinct secrets (`STRIPE_WEBHOOK_SECRET_PURCHASES` and `STRIPE_WEBHOOK_SECRET_AUTH`) mean two separate Stripe dashboard endpoints — but it's worth confirming in the Stripe dashboard **before Phase 1** which event types each endpoint is subscribed to. If both endpoints receive the same subscription events, the `corates-stripe-purchases` split preserves current behavior; if only the auth endpoint receives subscription events (and the purchases endpoint only sees checkout + payment_intent + customer), the standalone worker's router becomes mostly dead code and can be trimmed.

**4. Better-auth subscription webhook confirmed at `/api/auth/stripe/webhook`.** The stripe plugin is registered in `auth/config.ts:262-431` with `stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET_AUTH`. Mounted via `base.route('/api/auth', auth)` in `index.ts:102`. Subscription-lifecycle callbacks (`onSubscriptionComplete`, `onSubscriptionUpdate`, `onSubscriptionCancel`) run here and call `notifyOrgMembers`. This path consolidates into `corates-app` as-is.

**5. Purchase webhook standalone extraction — dependency inventory.** Files the purchases worker will need:

- `db/client.ts` (Drizzle D1 wrapper), `db/stripeEventLedger.ts`, `db/schema.ts` (at least `stripeEventLedger` and `orgAccessGrants` + any tables the handlers touch)
- `lib/stripe.ts` (`createStripeClient`, `isStripeConfigured`, `STRIPE_API_VERSION`)
- `lib/observability/logger.ts` (`createLogger`, `sha256`, `truncateError`)
- `routes/billing/webhookRouter.ts` + `routes/billing/handlers/*` (checkoutHandlers, subscriptionHandlers, invoiceHandlers, paymentIntentHandlers, customerHandlers) + `processCheckoutSession.ts`
- `@corates/shared` error types

Env bindings: `DB`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET_PURCHASES`, `ENVIRONMENT`, `SENTRY_DSN`. Plus whatever `createLogger` needs (likely Sentry binding).

**Decision gate before Phase 1:** Confirm Stripe dashboard event-type routing (finding #3). This changes whether the purchases worker carries the full 14-event router or a trimmed subset.

### Phase 1 — Stand up the separate Stripe webhook worker first

4. Create `packages/stripe-purchases/` with its own `wrangler.jsonc`, `src/index.ts`, and `.env`.
5. Extract the purchase webhook route + its D1 access (`stripeEventLedger.ts`) + minimal Drizzle setup (D1 binding only, same DB IDs as main app).
6. Bindings: D1 (`corates-db`/`corates-db-prod`), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET_PURCHASES`.
7. Route: `corates.org/api/billing/purchases/webhook` (more specific than `corates.org/*`, so it wins over `corates-app`'s catch-all).
8. Deploy. Update Stripe dashboard to point the purchase webhook endpoint at this worker (URL unchanged; route match now resolves to the new worker).
9. Remove the purchase webhook route from `packages/workers` only after the new one is verified taking traffic.

### Phase 2 — Build the consolidated worker alongside the current split

10. In `packages/web/`, add the wrangler bindings from `packages/workers/wrangler.jsonc` (D1, R2, DOs, queues), preserving exact DO class names and migration tags.
11. Rename `packages/web/server-entry.ts` → `src/server.ts`. Expand it from the minimal `createStartHandler` wrapper to the do-sync-style handler with WebSocket interceptor + queue export.
12. Copy the DO classes (`UserSession`, `ProjectDoc`) from `packages/workers/src` into `packages/web/src/server/`. Export them from `src/server.ts`.
13. Mount the existing Hono app under `src/routes/api/$.ts` via the catch-all pattern shown above. Zero route rewrites required at this stage.
14. Move the queue consumer (`queue()` handler) into `src/server.ts`.
15. Move the Drizzle schema from `packages/workers/src/db/` to `packages/web/src/server/db/` (or `@corates/shared` if you want the purchases worker to share imports — recommended).

### Phase 3 — Cutover

16. Merge `.env` from `packages/workers` into `packages/web/.env`.
17. Update the frontend: change `VITE_API_URL` default from `http://localhost:8787` to `http://localhost:3010` (or whatever the TanStack Start dev port is), and consider changing `apiFetch.ts` to use relative URLs (`/api/...`) now that everything is same-origin.
18. Shrink `getAllowedOrigins()` / `trustedOrigins` in better-auth config — dev origins only. Drop the CORS middleware from the mounted Hono app (same-origin now).
19. Update wrangler `routes` in `packages/web/wrangler.jsonc` to catch `corates.org/*` (taking over from `packages/workers`).
20. Deploy `corates-app`. Once traffic is healthy, delete `packages/workers` from the deploy pipeline. Keep the folder around for one release cycle in case of rollback, then remove.

### Phase 4 — Cleanup

21. Delete `packages/workers/`.
22. Simplify `turbo.json` — one less `dev` task, simpler DAG.
23. Optionally: start migrating Hono routes to native TanStack Start server handlers, a few at a time. Not required for the consolidation to be "done."

## Hazards & mitigations

- **DO class renames break production.** `UserSession` and `ProjectDoc` class names and migration tags must be copied verbatim into the new wrangler config. Never rename without a `renamed_classes` migration entry.
- **Stripe ledger shared between two workers.** Both `corates-app` (better-auth subscription webhooks) and `corates-stripe-purchases` (one-time purchases) write to `stripeEventLedger`. Keep the schema + helpers in `@corates/shared` (or a `@corates/db` package) to avoid divergence.
- **Hardcoded `VITE_API_URL` in frontend.** Audit `packages/web/src/lib/apiFetch.ts` and `packages/web/src/config/api.ts` before cutover. Either keep `VITE_API_URL` set to same-origin, or migrate to relative paths in one pass.
- **Zone routing precedence.** Wrangler `routes` resolve most-specific first. `corates.org/api/billing/purchases/webhook` (purchases worker) must win over `corates.org/*` (corates-app). Verify this with a dry-run before Phase 1 deploy.
- **WebSocket upgrade at the Worker boundary.** Must be intercepted in `src/server.ts` _before_ invoking `startFetch` — TanStack Start's handler won't pass through WS upgrades. Reference: do-sync `src/server.ts`.
- **`nodejs_compat` flag required.** better-auth + drizzle-orm both need it. Carry it over.
- **Queue + fetch + DO in same worker is supported.** Confirmed by do-sync pattern (minus queue) and standard Cloudflare docs; no runtime conflict between `fetch()` and `queue()` exports.
- **Test infrastructure split stays fine.** `@cloudflare/vitest-pool-workers` (server tests) and `vitest + @vitest/browser-playwright` (client tests) both coexist in one package. No test restructuring needed.
- **`packages/web` can't currently access D1/R2/DO bindings in dev.** Once its wrangler config declares them, local dev via `@cloudflare/vite-plugin` should expose them in SSR via `getCloudflareContext()`. Validate this early in Phase 2 before deep work.

## Open decisions

1. **Drizzle schema location.** Options: (a) inline in `corates-app`, (b) move to `@corates/shared`, (c) new `@corates/db` package. Recommend (b) or (c) so `corates-stripe-purchases` and `corates-emails` can import the same schema types.
2. **Incremental Hono→TanStack Start migration vs one-shot.** Recommend incremental via catch-all. One-shot rewrite of 66 routes is disproportionate to the consolidation goal.
3. **Separate-worker wrangler env structure.** Single env with secrets, or full dev/prod split? Recommend matching the main app's env structure for operational consistency across `corates-app`, `corates-stripe-purchases`, and `corates-emails`.
4. **Accept the 3-worker split, or keep the email queue consumer colocated?** If you're willing to switch to `wrangler dev` when working on email delivery (and primarily use `vite dev` for app work), you can collapse this to 2 workers. The 3-worker split is the recommendation, but 2 is viable with discipline.

## Verification notes

Claims in this document were verified against primary sources:

- **TanStack Start file route API** — confirmed via do-sync production code at `apps/web/src/routes/api/auth.$.ts` and TanStack Router source at `do-sync/reference/tanstack-router/`. `createFileRoute` imported from `@tanstack/react-router`; `server.handlers` per-method shape is correct for 1.167.x.
- **better-auth stripe plugin webhook path** — confirmed by reading `corates/packages/workers/src/auth/config.ts` and `corates/reference/better-auth/packages/stripe/src/routes.ts`. Mounts at `/api/auth/stripe/webhook`, uses `STRIPE_WEBHOOK_SECRET_AUTH`, handles subscription lifecycle events.
- **Purchase webhook extraction dependencies** — traced through `corates/packages/workers/src/routes/billing/webhooks.ts` and `processCheckoutSession.ts`. Only touches D1 (`stripeEventLedger`, `orgAccessGrants`). No DO, R2, queue, or auth session dependencies.
- **Cloudflare route precedence** — confirmed from Cloudflare docs: "the most specific route pattern wins." `corates.org/api/billing/webhook/purchases` will deterministically win over `corates.org/*`.
- **`@cloudflare/vite-plugin` queue consumer support** — verified by inspecting `workers-sdk/packages/vite-plugin-cloudflare/src/`. Queue producers work in dev; queue consumer handlers are **not** supported in `vite dev`. This is the reason the email queue consumer is recommended as a separate worker.
- **DO + D1 + R2 in dev via vite-plugin** — confirmed supported by playground examples in `workers-sdk/packages/vite-plugin-cloudflare/playground/`. Multiple SQLite-backed DO classes are fine.

Not verified (trust-but-test before acting):

- Exact dev port configuration for consolidated TanStack Start worker + vite-plugin with this specific binding set.
- Whether prerender config in `packages/web/vite.config.ts` needs updating after routes move in from `packages/workers`.
- `@cloudflare/vitest-pool-workers` config changes needed for the new binding set in `corates-app`.

## Why this shape

Historical reason for the split (no TanStack Start at project start) is gone. The only _present-day_ concern that survives scrutiny is Stripe webhook isolation — payments have different blast-radius and deploy-cadence needs than the app. Everything else benefits from the merge: no internal network hop, same-origin cookies, unified types, unified dev server, simpler turbo graph. do-sync demonstrates the target pattern works end-to-end.
