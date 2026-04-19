# API Development Guide

API routes in the main CoRATES app are TanStack Start file-based server routes, served from the same Cloudflare Worker as the SPA. Shared backend logic (auth, billing resolvers, policies, rate limiting) lives in the `@corates/workers` library package.

A separate Worker (`packages/stripe-purchases`) still uses Hono -- it is isolated for deploy-cadence reasons and documented in its own README.

## File layout

Route files live under `packages/web/src/routes/api/` and mirror the URL path. Dynamic segments use a `$` prefix (TanStack Router convention).

```
routes/api/
  $.ts                                   <- catch-all 404 for /api/*
  orgs.ts                                <- /api/orgs
  orgs/$orgId.ts                         <- /api/orgs/:orgId
  orgs/$orgId/members.ts                 <- /api/orgs/:orgId/members
  billing/
    checkout.ts
    subscription.ts
    portal.ts
  admin/
    users/$userId/impersonate.ts
```

## Anatomy of a route file

Each file exports one handler per HTTP method it serves, then wires them into a `Route` export at the bottom.

```ts
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { getSession } from '@corates/workers/auth';
import { createDb } from '@corates/db/client';
import {
  createDomainError,
  createValidationError,
  AUTH_ERRORS,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
} from '@corates/shared';

export const handleGet = async ({ request }: { request: Request }) => {
  const session = await getSession(request, env);
  if (!session) {
    return Response.json(createDomainError(AUTH_ERRORS.REQUIRED), { status: 401 });
  }

  const url = new URL(request.url);
  const targetPlan = url.searchParams.get('targetPlan');
  if (!targetPlan) {
    return Response.json(
      createValidationError('targetPlan', VALIDATION_ERRORS.FIELD_REQUIRED.code, null, 'required'),
      { status: 400 },
    );
  }

  const db = createDb(env.DB);
  try {
    const result = await doTheWork(db, targetPlan);
    return Response.json(result, { status: 200 });
  } catch (err) {
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'do_the_work',
        originalError: (err as Error).message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/example')({
  server: { handlers: { GET: handleGet } },
});
```

The `Route` export is what TanStack Start registers; handlers are named exports so tests can import them directly without routing through the framework.

## Environment bindings

Worker bindings come from the magic `cloudflare:workers` module:

```ts
import { env } from 'cloudflare:workers';

const db = createDb(env.DB);
const secret = env.STRIPE_SECRET_KEY;
```

Do not read bindings off `process.env`. Types for `env` come from `packages/web/worker-env-augment.d.ts` and the generated `worker-configuration.d.ts`.

## Authentication

Use `getSession(request, env)` from `@corates/workers/auth`. It returns `null` when there is no valid session; otherwise it returns `{ session, user }`.

```ts
const session = await getSession(request, env);
if (!session) {
  return Response.json(createDomainError(AUTH_ERRORS.REQUIRED), { status: 401 });
}
```

For endpoints that need Better Auth functionality (organizations, sessions, subscriptions), go through `createAuth(env).api`:

```ts
import { createAuth } from '@corates/workers/auth-config';

const orgApi = createAuth(env).api;
const result = await orgApi.listOrganizations({ headers: request.headers });
```

## Authorization

Policy checks live in `@corates/workers/policies` (`requireOrgOwner`, `requireOrgMember`, etc.) and in `@/server/guards/`. They throw domain errors when denied.

```ts
import { requireOrgOwner } from '@corates/workers/policies';

try {
  await requireOrgOwner(db, session.user.id, orgId);
} catch (err) {
  if (isDomainError(err)) {
    return Response.json(err, { status: err.statusCode });
  }
  throw err;
}
```

## Rate limiting

Per-endpoint rate limiters live in `@/server/rateLimit`. Declare the limit constant in that file and call `checkRateLimit` at the top of the handler.

```ts
import { BILLING_CHECKOUT_RATE_LIMIT, checkRateLimit } from '@/server/rateLimit';

const limit = checkRateLimit(request, env, BILLING_CHECKOUT_RATE_LIMIT);
if (limit.blocked) return limit.blocked;

// ... happy path ...
return Response.json(result, { status: 200, headers: limit.headers });
```

Forward `limit.headers` on the success path so clients see remaining-quota headers.

## Validation

Light validation is done ad-hoc against typed body interfaces. Return a `createValidationError` response rather than throwing.

```ts
interface CheckoutBody {
  tier?: unknown;
  interval?: unknown;
}

const body = (await request.json()) as CheckoutBody;

if (typeof body.tier !== 'string') {
  return Response.json(
    createValidationError('tier', VALIDATION_ERRORS.FIELD_REQUIRED.code, null, 'required'),
    { status: 400 },
  );
}
```

For routes with richer schemas (admin grant/subscription endpoints are the current examples), use Zod:

```ts
import { z } from 'zod';

const BodySchema = z.object({
  note: z.string().min(1).max(500),
  expiresAt: z.coerce.date().optional(),
});

const parsed = BodySchema.safeParse(await request.json());
if (!parsed.success) {
  const issue = parsed.error.issues[0];
  return Response.json(
    createValidationError(String(issue.path[0]), VALIDATION_ERRORS.INVALID_INPUT.code, null, issue.message),
    { status: 400 },
  );
}
```

Reserve Zod for routes where the schema is worth the weight -- admin mutations, public-facing contact forms, anywhere the body shape is broad or user-submitted.

## Database access

All database work goes through Drizzle via `createDb(env.DB)` from `@corates/db/client`. Never import `drizzle-orm/d1` directly from a route.

```ts
import { createDb } from '@corates/db/client';
import { projects } from '@corates/db/schema';
import { eq } from 'drizzle-orm';

const db = createDb(env.DB);
const row = await db.select().from(projects).where(eq(projects.id, projectId)).get();
```

## Error responses

Return, don't throw. The shared error schema (`@corates/shared`) defines every code and its `statusCode`.

```ts
import { createDomainError, isDomainError, AUTH_ERRORS, SYSTEM_ERRORS } from '@corates/shared';

try {
  // ...
} catch (err) {
  if (isDomainError(err)) {
    return Response.json(err, { status: err.statusCode });
  }
  const sysErr = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
    operation: 'create_checkout_session',
    originalError: (err as Error).message,
  });
  return Response.json(sysErr, { status: 500 });
}
```

The frontend error helpers (`@/lib/error-utils`) understand this schema and surface user-friendly messages automatically.

## Catch-all 404

`routes/api/$.ts` returns a JSON `SYSTEM_ROUTE_NOT_FOUND` for any `/api/*` path that no concrete route claims. This prevents API clients from receiving the SPA HTML shell. Leave it in place; do not add route-specific 404s unless the request shape demands one.

## Testing

Route handlers are named exports, so tests import them directly and synthesize a `Request`:

```ts
import { handlePost } from '../checkout';

const response = await handlePost({
  request: new Request('https://x/api/billing/checkout', {
    method: 'POST',
    body: JSON.stringify({ tier: 'pro', interval: 'monthly' }),
    headers: { 'content-type': 'application/json', cookie: 'session=...' },
  }),
});
```

Server-side tests live under `__tests__/` adjacent to the route and follow the `*.server.test.ts` suffix (picked up by `pnpm --filter web test`).

## The Hono worker (stripe-purchases)

The Stripe purchases webhook lives in its own Worker under `packages/stripe-purchases/`. It uses Hono because the original code predates the TanStack Start migration and webhook signature verification is high-stakes -- it is kept isolated so frontend deploys do not disrupt payment retry windows. See `packages/stripe-purchases/src/routes/webhook.ts` for the two-phase trust model.

Do not add new routes to the stripe-purchases worker unless they specifically need that isolation. New endpoints belong under `packages/web/src/routes/api/`.

## Don'ts

- Don't read bindings from `process.env` -- use `import { env } from 'cloudflare:workers'`.
- Don't throw errors across the route boundary -- catch and return a JSON response with the correct status.
- Don't bypass Drizzle by issuing raw SQL against `env.DB`.
- Don't import from `drizzle-orm/d1` directly in routes; use `@corates/db/client`.
- Don't put shared authz or resolver logic in a route file -- move it to `@corates/workers`.
- Don't add Hono to `packages/web`. The main app is TanStack Start end-to-end.
