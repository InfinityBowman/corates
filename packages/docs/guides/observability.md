# Observability Guide

How CoRATES emits, ships, and queries logs, and where Sentry fits.

## Overview

Logging is **Loki-first**. Every server-side log is a single line of structured JSON on the
console; Cloudflare Workers Observability exports those lines over OTLP to a self-hosted Loki,
where they are queryable for 90 days. Sentry is reserved for **exceptions** - places where a
stack trace, release mapping, and (in the browser) a session replay are worth having.

Informational logs are not mirrored into Sentry. Loki already holds 100% of them, so a second
copy would be duplicated volume against a separately metered quota.

```
Workers (prod/staging) -> OTLP -> loki.jacobmaynard.dev -> Loki -> R2 (corates-loki)
                                          Grafana queries Loki

Exceptions (all envs with a DSN) -> Sentry
```

Staging deliberately has **no `SENTRY_DSN`**. Loki is the only signal there, which is why the
structured fields below matter.

## The entry shape

`createLogger()` in `@corates/shared/logger` is the single primitive. Every entry is one JSON
object so Loki can parse it with `| json` and turn each key into a queryable field:

```json
{
  "ts": "2026-08-08T22:14:03.219Z",
  "level": "info",
  "service": "corates-workers",
  "env": "production",
  "requestId": "3f2b...",
  "cfRay": "8e1c...",
  "message": "Created personal org org_123 for user usr_456",
  "route": "/api/projects",
  "method": "POST",
  "userId": "usr_456"
}
```

`ts`, `level`, `service`, and `message` are always present. `env`, `requestId`, and `cfRay` come
from the request scope; anything else is per-call data or scope context.

## Which logger to use

| Package            | Import                          | Notes                                                                                    |
| ------------------ | ------------------------------- | ---------------------------------------------------------------------------------------- |
| `workers`          | `@corates/workers/logger`       | `debug` / `info` / `warn` / `captureError`. The default for all server code.             |
| sync engine        | `createWorkspaceDO({ logger })` | Engine diagnostics; the hook in `sync/workspace.ts` forwards them to the same logger.    |
| `stripe-purchases` | `src/lib/observability/logger`  | Hono-request-scoped wrapper adding `.stripe(action, data)` with a typed field whitelist. |
| `web` (server)     | `@corates/workers/logger`       | Same as workers - server functions, route handlers, middleware.                          |
| `web` (browser)    | `@/config/sentry`               | No Loki path exists from the browser; use `captureException`.                            |

Only reach for `createLogger` directly when you need a distinct `service` name, as the web
Stripe webhook route does.

## Request correlation

Every log emitted while handling a request carries the same `requestId`, so one query returns
the whole story of a failure.

The scope is opened in `packages/web/src/server.ts`, which reads an inbound `x-request-id`
(falling back to a fresh UUID) and captures `cf-ray`, `env`, `route`, and `method`. It is
carried by `AsyncLocalStorage` rather than a threaded parameter, which is why command
signatures stay `(env, actor, params)` while their logs still correlate.

`authMiddleware` narrows the scope with `userId` once the caller is known, so anything
downstream of auth logs the user too.

```js
import { runWithLogger, runWithContext, getRequestId } from '@corates/workers/logger';

// Entry points open a scope
runWithLogger({ requestId, cfRay, env, context: { route, method } }, () => handler());

// Middleware narrows one
runWithContext({ userId }, () => next());

// Anything else reads the current id
const id = getRequestId();
```

### Crossing into a Durable Object

`AsyncLocalStorage` does not survive `stub.fetch()` - the DO runs in its own isolate. The id
therefore travels as an `x-request-id` header, and the DO reopens a scope from it:

```js
// Caller (packages/web/src/server.ts)
const headers = new Headers(request.headers);
headers.set('x-request-id', requestId);
return stub.fetch(new Request(request, { headers }));

// Callee (UserSession.fetch)
runWithLogger({ requestId: request.headers.get('x-request-id') ?? crypto.randomUUID() }, ...);
```

Rebuilding the Request this way preserves the WebSocket upgrade handshake, which is pinned by
`durable-objects/__tests__/do-correlation.test.ts` - the same test also asserts the ALS scope
does _not_ cross, since that is the whole reason the header exists.

`UserSession` logs also carry `requestIdForwarded`, which separates an entry that joins back
to a worker request from one holding only a locally minted id - both are UUIDs, so they are
otherwise indistinguishable.

Two things still log unscoped:

- **`WorkspaceDO`** (the sync engine). `createWorkspaceDO` takes a `logger`, which
  `sync/workspace.ts` supplies, so the engine's init failures, schema-drift warnings and
  internal errors go through the shared logger and reach Loki as structured JSON. They carry
  no `requestId` though: the DO class comes from `@cf-sync/server`, so there is no `fetch` of
  ours to open a scope in. (The sync route does forward all original request headers, so the
  missing piece is scope, not transport.)
- **Module-init and test code**, which has no request to attach to.

Hibernated WebSocket callbacks (`webSocketMessage`, `webSocketError`) also fall outside: they
fire long after the originating request, so there is no scope left to inherit.

## Levels

- `debug` - diagnostic detail, not expected to be read routinely
- `info` - a thing happened that you would want to see when reconstructing a request
- `warn` - degraded but handled; the operation still succeeded
- `error` - the operation failed. Prefer `captureError`, which logs _and_ reports to Sentry.

Printf-style call sites are supported and interpolated into `message` so log queries read
naturally:

```js
info('Created personal org %s for user %s', [orgId, userId]);
```

## Sentry

| Surface        | Wiring                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------- |
| Browser        | `packages/web/src/config/sentry.ts` - replay (masked text, blocked media), feedback widget, TanStack Router tracing |
| Web Worker     | `packages/web/src/server.ts` - `Sentry.withSentry` over `fetch` + `queue`                                           |
| Durable Object | `packages/workers/src/durable-objects/UserSession.ts` - `instrumentDurableObjectWithSentry`                         |
| Stripe worker  | `packages/stripe-purchases/src/index.ts` - `Sentry.withSentry`                                                      |
| Sourcemaps     | `sentryVitePlugin` in `packages/web/vite.config.ts`                                                                 |

Every browser-side helper no-ops without a DSN, so local development stays quiet.

In the browser, the rule of thumb is **error means capture, warn means console**. A failure the
user attempted and that did not complete gets `captureException` with `component` and `action`
tags. A tolerated degradation - a metadata lookup that fell back, a cache write that missed -
stays a `console.warn` and rides along as a Sentry breadcrumb if a real error follows.

The Worker entries do not set `enableLogs`; nothing calls `Sentry.logger.*`.

## Querying

Grafana lives at `grafana.jacobmaynard.dev` with one dashboard, `CoRATES Logs`.

```logql
{service_name="corates-workers-prod"}                          # all prod logs
{service_name=~"corates-workers.*"} |= "error"                 # errors, both envs
{service_name="corates-workers-prod"} | json | level="warn"    # structured fields
{service_name="corates-workers-prod"} | json | requestId="3f2b..."   # one request
```

Retention is 90 days (`limits_config.retention_period`). Deploying and operating the stack
itself is covered in `infra/observability/README.md`.
