# Post-migration regressions — what the Hono retirement actually lost

The Hono → TanStack Start migration ([#484](https://github.com/InfinityBowman/corates/issues/484), [#485](https://github.com/InfinityBowman/corates/issues/485), [#486](https://github.com/InfinityBowman/corates/issues/486)) ported every route. After verifying claim-by-claim against current code, the genuine regressions are smaller than they first appeared.

Severity legend:

- **block** — fix before merging the `retire-hono-app` branch
- **soon** — degraded contract or operational visibility; fix shortly after merge
- **followup** — quality-of-life; no immediate impact

---

## block — none

Initial audit flagged security headers and CSRF as blockers. Both turned out to be already-handled or already-fixed:

- **Security headers (HTML + static assets):** `packages/web/src/routes/__root.tsx` sets `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and CSP on every TanStack-served HTML response. `packages/web/public/_headers` (Cloudflare Pages-style static asset config) sets the same on every static response. The Hono middleware was redundant for the SPA's HTML.
- **Admin CSRF:** restored Pass 26 by folding `requireTrustedOrigin` into `requireAdmin`. Verified by tests in `users.server.test.ts`.

Nothing is a hard merge blocker.

---

## soon — operational gaps

### Health deep-check endpoint — gone

**What we had.** `routes/health.ts` exposed two endpoints:

- `/health` — JSON deep check: D1 `SELECT 1`, R2 `list({ limit: 1 })`, DO bindings present. Returned 503 if any failed.
- `/health/live` — plain `OK` text liveness probe.

**What's now there.** `packages/web/src/routes/healthz.ts` returns `OK` (text) — covers liveness at a different path.

**Gap.** Deep dependency check is gone. If anything monitors `/health` (uptime services, CF health checks, dashboards), the URL now 404s. The path renamed from `/health/live` to `/healthz` may also break monitors.

**Fix.** Add `routes/api/health.ts` with the deep check (same JSON shape as before), and either keep `/healthz` or alias it. Bindings (`env.DB`, `env.PDF_BUCKET`, `env.USER_SESSION`, `env.PROJECT_DOC`) are all available.

### `/api/$.ts` JSON 404 — gone

**What we had.** Hono's global `notFound` returned `SYSTEM_ROUTE_NOT_FOUND` JSON for any unmatched path under `/api/*`. Pass 25 deleted both the `/api/$.ts` Hono forwarder and its 404 fallback.

**What's now there.** TanStack's root `notFoundComponent` renders the React 404 page (HTML, status 404). An API client hitting `/api/typo` gets HTML back instead of the documented JSON shape — content-type wrong, body un-parseable.

**Fix.** Add `routes/api/$.ts` returning the `SYSTEM_ROUTE_NOT_FOUND` JSON for any method. TanStack's specificity sort puts splats last, so it only catches truly unmatched API paths.

### HSTS header — gone

**What we had.** Hono's `securityHeaders` middleware set `Strict-Transport-Security: max-age=15552000; includeSubDomains` on every HTTPS response.

**What's now there.** Neither `__root.tsx` nor `_headers` sets it. Cloudflare doesn't add HSTS automatically — it has to be enabled per zone in the dashboard's "Edge Certificates → HSTS Settings" or via this header.

**Gap.** First-visit downgrade attacks possible until the browser learns the host is HTTPS-only via some other means.

**Fix.** Add `Strict-Transport-Security` to both `_headers` (catches static asset responses) and the `headers` block in `__root.tsx` (catches TanStack-served HTML). Or enable HSTS at the CF zone level — that covers everything including API responses.

### CORS — gone, but not currently breaking anything

**What we had.** `packages/workers/src/middleware/cors.ts` wrapped Hono's `cors()` with allow-list, methods, headers, credentials, OPTIONS preflight.

**What's now there.** Nothing.

**Why it's not breaking.** Browsers don't enforce CORS on same-origin requests, including non-simple ones. Production is `corates.org` SPA → `corates.org/api` (same-origin); local dev is `localhost:3010` → `localhost:3010/api` (same-origin); programmatic clients ignore CORS.

**When it'd start mattering.** Different-origin SPA, dev pointing at prod, third-party embeds, public API clients in browsers.

**Fix when needed.** Wrapper in `packages/web/src/server.ts`, before the WS dispatch and TanStack handoff. Reuse `isOriginAllowed`/`STATIC_ORIGINS` from `@corates/workers/config/origins`.

---

## followup — quality and parity

### Centralized error handler — degraded but not broken

**What we had.** `packages/workers/src/middleware/errorHandler.ts` (`base.onError`) caught every uncaught error in route handlers and converted:

- Zod errors → `VALIDATION_ERROR` JSON with field paths
- D1 errors (`D1_*` prefix) → `DB_ERROR` with operation context
- `UNIQUE constraint failed` → 409 with friendly message
- `FOREIGN KEY constraint failed` → 400
- Other errors → `INTERNAL_ERROR` (stack stripped in production)

**What's now there.** Each TanStack handler has its own try/catch — most return `SYSTEM_ERRORS.DB_ERROR` for any thrown error. Constraint-violation classification (UNIQUE → 409, FK → 400) is gone. Uncaught exceptions inside handler logic propagate as TanStack error responses rather than `INTERNAL_ERROR` JSON.

**Fix.** Either (a) a small `wrapHandler(fn)` helper that does the classification once, applied to every export, or (b) extend per-route try/catches to detect the same string patterns. (a) is cleaner.

### Validation error quality — flat in 4 routes

**Surveyed all migrated routes.** 34 routes use `createValidationError` properly (field paths, error codes). 4 admin routes catch Zod errors and return a flatter `INVALID_INPUT { field: 'body', value: err.message }` shape:

- `routes/api/admin/orgs/$orgId/grants.ts`
- `routes/api/admin/orgs/$orgId/grants/$grantId.ts`
- `routes/api/admin/orgs/$orgId/subscriptions.ts`
- `routes/api/admin/orgs/$orgId/subscriptions/$subscriptionId.ts`

**Impact.** Admin UI clients of those 4 routes can't highlight specific failing fields from a 400 response. Only matters if the admin grants/subscriptions UI shows form-field errors.

**Fix.** Replace `Schema.parse(raw)` with `Schema.safeParse(raw)` and pull the first issue's path/message into a proper `VALIDATION_ERROR`.

### Request ID propagation — partial

**What we had.** `packages/workers/src/lib/observability/logger.ts` (deleted Pass 25) generated or honoured `x-request-id` and set it on every response; structured logs included `requestId`, `cfRay`, `route`, `method`.

**What's now there.** Only the Stripe webhook still threads `requestId` (Pass 22 ported it inline). Other routes log without correlation IDs and don't set the response header.

**Impact.** Harder to trace a single request through logs. CF's `cf-ray` header still exists for cross-system correlation.

**Fix.** Add request-ID generation in `packages/web/src/server.ts` (single point), expose it via the request context for handlers, and set it on the outgoing response.

### X-Content-Type-Options on API responses — gone

**Subtle.** `_headers` and `__root.tsx` set this header on static assets and SPA HTML. API JSON responses don't have it. Hono set it on every response.

**Impact.** Tiny. The header prevents browsers from MIME-sniffing a response with the wrong `Content-Type`. JSON responses with `Content-Type: application/json` aren't at risk because that's not an HTML-sniff target.

**Fix.** Optionally set it in a thin response wrapper in `server.ts`. Low value.

### Auth rate limit `skipFailedRequests` — gone

**What we had.** Hono's `authRateLimit` set `skipFailedRequests: true` — failed sign-ins/sign-ups didn't count toward the 20-per-15-min budget.

**What's now there.** `packages/web/src/server/rateLimit.ts`'s `checkRateLimit` API doesn't support skipping. `AUTH_RATE_LIMIT` (used in `routes/api/auth/$.ts` catch-all) counts every request, success or fail.

**Impact.** Slightly easier to lock out a real user typing their password wrong. With a 20/15min budget, a user typo-ing 5 times still has room.

**Fix.** Add an optional refund step in `checkRateLimit` (or a `refundRateLimit` helper) and call it in the catch-all when better-auth returns a 4xx representing a failed credential attempt.

### OpenAPI / `/docs` page — gone

**What we had.** `@hono/zod-openapi` routes generated an OpenAPI spec; the dev-only `/docs` page rendered it.

**What's now there.** No spec, no docs page. Removed deliberately in Pass 25.

**Impact.** Lost a dev convenience. Production never served `/docs` (404 outside dev mode), so no user impact.

**Fix.** Optional — regenerate from TanStack handlers if anyone misses it. Low value unless something automated consumed the spec.

---

## Out of scope — already removed deliberately

- `/api/$.ts` Hono catch-all forwarder (Pass 25)
- 410 legacy endpoints (`/api/orgs/$orgId/project-doc/$projectId`, `/api/project/$projectId`)
- Hono RPC client (`packages/web/src/lib/rpc.ts`) and `DetailedError` instance checks (Pass 25)

---

## Verified preserved (not regressions)

Audited and confirmed in current code:

- Security headers on **HTML responses** — `__root.tsx`'s `headers()` callback sets X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, CSP
- Security headers on **static assets** — `public/_headers` sets the same five
- Admin CSRF — `requireAdmin` runs `requireTrustedOrigin` first (Pass 26)
- Liveness probe — `/healthz` returns "OK"
- Sentry server-side error monitoring — `Sentry.withSentry` wraps the worker default export (added during this audit)
- Sentry client-side — `packages/web/src/config/sentry.ts` initialises `@sentry/react`
- All API routes from the original Hono app (auth, billing, admin, orgs, projects, users, PDF, dev, Google Drive, invitations) are migrated and tested

---

## Suggested order for an "ops" follow-up branch

1. HSTS header — one-line addition to `_headers` and `__root.tsx`.
2. Health deep-check endpoint at `/api/health` — one route file.
3. `/api/$.ts` JSON 404 — one route file.
4. Centralized error wrapper (`wrapHandler` helper) — retrofit one route at a time.
5. Validation helper for the 4 lazy admin routes.
6. Request-ID propagation, rate-limit refund, CORS, OpenAPI — as needed.
