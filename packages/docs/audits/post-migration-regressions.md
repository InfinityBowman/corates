# Post-migration regressions — what the Hono retirement actually lost

The Hono → TanStack Start migration ([#484](https://github.com/InfinityBowman/corates/issues/484), [#485](https://github.com/InfinityBowman/corates/issues/485), [#486](https://github.com/InfinityBowman/corates/issues/486)) ported every route. After verifying claim-by-claim against current code, the genuine regressions are smaller than they first appeared, and the merge-prep pass closed the operational ones.

Severity legend:

- **block** — fix before merging the `retire-hono-app` branch
- **soon** — degraded contract or operational visibility; fix shortly after merge
- **followup** — quality-of-life; no immediate impact

---

## block — none

Initial audit flagged security headers and CSRF as blockers. Both turned out to be already-handled or already-fixed:

- **Security headers (HTML + static assets):** `packages/web/src/routes/__root.tsx` sets `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and CSP on every TanStack-served HTML response. `packages/web/public/_headers` sets the same on every static response. The Hono middleware was redundant for the SPA's HTML.
- **Admin CSRF:** restored Pass 26 by folding `requireTrustedOrigin` into `requireAdmin`.

Nothing is a hard merge blocker.

---

## Resolved during merge prep

Three small fixes landed before merging the `retire-hono-app` branch:

### HSTS header — restored

Added `Strict-Transport-Security: max-age=15552000; includeSubDomains` to both `__root.tsx` (TanStack HTML responses) and `public/_headers` (static asset responses). Mirrors the original Hono header on every HTTPS response.

### `/api/$.ts` JSON 404 — restored

`routes/api/$.ts` returns the `SYSTEM_ROUTE_NOT_FOUND` JSON (with the requested path in `details.path`) for every method. TanStack's specificity sort guarantees it only fires for paths no concrete API route claims. Two tests in `routes/api/__tests__/not-found.server.test.ts`.

### Health deep-check endpoint — restored

`routes/health.ts` re-exposes the original Hono `/health` shape: D1 `SELECT 1`, R2 `list({ limit: 1 })`, DO bindings present. Returns 503 with per-service status when anything degrades. The plain `OK` liveness probe stays at `/healthz`.

---

## soon — operational gaps

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

- `/api/$.ts` Hono catch-all forwarder (Pass 25; replaced with the JSON 404 catch-all above)
- 410 legacy endpoints (`/api/orgs/$orgId/project-doc/$projectId`, `/api/project/$projectId`)
- Hono RPC client (`packages/web/src/lib/rpc.ts`) and `DetailedError` instance checks (Pass 25)

---

## Verified preserved (not regressions)

Audited and confirmed in current code:

- Security headers on **HTML responses** — `__root.tsx`'s `headers()` callback sets HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, CSP
- Security headers on **static assets** — `public/_headers` sets the same six
- Admin CSRF — `requireAdmin` runs `requireTrustedOrigin` first (Pass 26)
- Liveness probe — `/healthz` returns "OK"
- Health deep-check — `/health` returns JSON with D1/R2/DO status (restored during merge prep)
- API JSON 404 — `routes/api/$.ts` returns `SYSTEM_ROUTE_NOT_FOUND` for unmatched paths (restored during merge prep)
- Sentry server-side error monitoring — `Sentry.withSentry` wraps the worker default export
- Sentry client-side — `packages/web/src/config/sentry.ts` initialises `@sentry/react`
- All API routes from the original Hono app (auth, billing, admin, orgs, projects, users, PDF, dev, Google Drive, invitations) are migrated and tested

---

## Suggested order for an "ops" follow-up branch

1. Centralized error wrapper (`wrapHandler` helper) — retrofit one route at a time.
2. Validation helper for the 4 lazy admin routes.
3. Request-ID propagation in `server.ts` + handler context.
4. Auth rate-limit refund.
5. CORS — only when we move off pure same-origin.
6. OpenAPI — only if something automated wants the spec.
