# API Development Guide

Server code in the main CoRATES app runs in the same Cloudflare Worker as the SPA, through two front doors. Shared backend logic (auth, billing resolvers, policies, commands) lives in the `@corates/workers` library package.

- **Server functions are the default.** The client calls them like async functions; TanStack Start handles transport, and thrown domain errors arrive in the browser intact.
- **API routes (`routes/api/`) are for raw HTTP only**: the Better Auth catch-all, the Stripe webhook, binary responses (PDF and avatar streams), browser log intake, and the e2e test seams.

To choose, ask whether the caller needs a real URL, a non-JSON body, or an external POST. If not, write a server function.

## Server functions

### File layout

Each area pairs two files in `packages/web/src/server/functions/`:

- `X.functions.ts` -- thin `createServerFn` wrappers: HTTP method, middleware, Zod input.
- `X.server.ts` -- the logic, taking `session` and `db` as parameters so tests call it without a request.

```
server/functions/
  workspaces.functions.ts   <- getMyWorkspaces, updateWorkspace, removeWorkspaceMember, ...
  workspaces.server.ts      <- listMyWorkspaces, updateWorkspaceSettings, ...
  org-projects.functions.ts <- createProject, addMemberToProject, cancelInvitation, ...
  billing.functions.ts      <- getSubscription, checkoutSubscription, openBillingPortal, ...
  admin-*.functions.ts      <- admin-only actions
```

### Anatomy

```ts
// workspaces.functions.ts
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { workspaceNameSchema, workspaceSlugSchema } from '@corates/shared';
import type { OrgId } from '@corates/shared/ids';
import { authMiddleware } from '@/server/middleware/auth';
import { updateWorkspaceSettings } from './workspaces.server';

export const updateWorkspace = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      orgId: z.string(),
      name: workspaceNameSchema.optional(),
      slug: workspaceSlugSchema.optional(),
    }),
  )
  .handler(async ({ data, context: { session, db } }) => {
    const { orgId, ...changes } = data;
    return updateWorkspaceSettings(session, db, orgId as OrgId, changes);
  });
```

```ts
// workspaces.server.ts
export async function updateWorkspaceSettings(
  session: Session,
  db: Database,
  orgId: OrgId,
  data: { name?: string; slug?: string },
) {
  const membership = await requireOrgMembership(session, db, orgId, 'owner');
  if (!membership.ok) throw membership.error;
  // ... Drizzle writes ...
}
```

The client imports the wrapper and calls it with `{ data }`, usually inside a TanStack Query hook:

```ts
await updateWorkspace({ data: { orgId, name } });
```

Take the workspace (`orgId`) as input rather than deriving it from the session.

### Middleware

From `@/server/middleware/`:

- `authMiddleware` -- requires a session (throws `AUTH_REQUIRED` otherwise) and puts `session`, `db` and `request` on the context.
- `optionalAuthMiddleware` -- `session` or `null`, for public pages that render differently when signed in. Never authorize with it.
- `dbMiddleware` -- `db` only.

### Errors

Throw, don't return. Use `throwDomainError(...)` or throw a guard's `result.error` (a `DomainErrorException`). A returned Response would reach the caller as resolved data. `src/start.ts` registers a serialization adapter so the thrown error arrives in the browser with its `code`, `statusCode` and `details`; without it, TanStack Start serializes only the message.

```ts
throwDomainError(
  VALIDATION_ERRORS.INVALID_INPUT,
  { field: 'slug', reason: 'slug_taken' },
  'That URL is already taken.',
);
```

## API routes

### File layout

Route files live under `packages/web/src/routes/api/` and mirror the URL path. Dynamic segments use a `$` prefix (TanStack Router convention). These are all of them:

```
routes/api/
  $.ts                          <- catch-all JSON 404 for /api/*
  auth/$.ts                     <- Better Auth handler (organization/* closed)
  auth/session.ts               <- session read for the client
  auth/verify-email.ts          <- email verification link
  auth/stripe/webhook.ts        <- Stripe webhook
  client-logs.ts                <- browser log intake
  users/avatar.ts               <- avatar upload
  users/avatar/$userId.ts       <- avatar stream
  orgs/$orgId/projects/$projectId/studies/$studyId/pdfs.ts            <- PDF list, upload
  orgs/$orgId/projects/$projectId/studies/$studyId/pdfs/$fileName.ts  <- PDF stream, delete
  test/*                        <- e2e seams (seed, session, cleanup, auth-code, ...)
```

Three more paths are handled in the worker entry (`src/server.ts`) before TanStack Start sees the request: `/api/sync/<projectId>` and `/api/sync-admin/<projectId>/<op>` (the project sync DO), and `/api/sessions/<userId>` (the UserSession DO for notifications).

### Anatomy

Each file exports one handler per HTTP method, then wires them into a `Route` export. Handlers are named exports so tests can import them directly.

```ts
import { createFileRoute } from '@tanstack/react-router';
import type { Database } from '@corates/db/client';
import type { OrgId, ProjectId } from '@corates/shared/ids';
import { requireOrgMembership } from '@/server/guards/requireOrgMembership';
import { requireProjectAccess } from '@/server/guards/requireProjectAccess';
import { authMiddleware, type Session } from '@/server/middleware/auth';

type HandlerArgs = {
  request: Request;
  params: { orgId: OrgId; projectId: ProjectId };
  context: { db: Database; session: Session };
};

export const handleGet = async ({ params, context: { db, session } }: HandlerArgs) => {
  const orgMembership = await requireOrgMembership(session, db, params.orgId);
  if (!orgMembership.ok) return orgMembership.error.toResponse();

  const access = await requireProjectAccess(session, db, params.orgId, params.projectId);
  if (!access.ok) return access.error.toResponse();

  // ... stream the file ...
};

export const Route = createFileRoute('/api/orgs/$orgId/projects/$projectId/example')({
  server: {
    middleware: [authMiddleware],
    handlers: { GET: handleGet },
  },
});
```

### Errors

Return, don't throw. Guards hand back a `DomainErrorException`; return `result.error.toResponse()`. For anything else, return `Response.json(createDomainError(...), { status })`. The shared error schema (`@corates/shared`) defines every code and its `statusCode`.

```ts
try {
  // ...
} catch (err) {
  if (isDomainError(err)) {
    return Response.json(err, { status: err.statusCode });
  }
  return Response.json(
    createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
      operation: 'upload_pdf',
      originalError: (err as Error).message,
    }),
    { status: 500 },
  );
}
```

## Environment bindings

Worker bindings come from the magic `cloudflare:workers` module:

```ts
import { env } from 'cloudflare:workers';

const db = createDb(env.DB);
const secret = env.STRIPE_SECRET_KEY;
```

Do not read bindings off `process.env`. Types for `env` come from `packages/web/worker-env-augment.d.ts` and the generated `worker-configuration.d.ts`.

## Authentication

Server functions and API routes that use `authMiddleware` get the session on the context. An API route without it reads the session itself with `getSession(request, env)` from `@corates/workers/auth`, which returns `null` when there is no valid session and `{ session, user }` otherwise.

For Better Auth functionality (sessions, subscriptions), go through `createAuth(env).api` in-process. Workspaces are the exception: read and write the `organization` and `member` tables with Drizzle through the workspace server functions, never the organization plugin's API.

## Authorization

Policy checks live in `@corates/workers/policies`. The real policy functions are:

- `requireOrgOwner` -- enforce org owner role (billing operations)
- `getOrgMembership` / `requireOrgMemberRemoval` -- org membership checks and removal safety
- `getProjectMembership` -- project membership lookup
- `requireProjectEdit` -- enforce project edit permission
- `requireMemberRemoval` / `requireSafeRemoval` / `requireSafeRoleChange` -- project member management safety

Each throws a domain error when denied; route handlers catch and return them as JSON.

Policy call shapes vary -- check each before using. `requireOrgOwner` is _not_ a DB lookup; it validates a role you already resolved. For workspace-level checks in server functions, prefer the `requireOrgMembership(session, db, orgId, minRole?)` guard, which looks the role up. `requireProjectEdit` does its own DB lookup.

```ts
import { requireProjectEdit } from '@corates/workers/policies/projects';
import { requireOrgMembership } from '@/server/guards/requireOrgMembership';
import { isDomainError } from '@corates/shared';

// Workspace-style: the guard resolves the caller's role in the given workspace
const membership = await requireOrgMembership(session, db, orgId, 'owner');
if (!membership.ok) throw membership.error;

// Project-style: positional args, policy does its own lookup
try {
  await requireProjectEdit(db, session.user.id, projectId);
} catch (err) {
  if (isDomainError(err)) return Response.json(err, { status: err.statusCode });
  throw err;
}
```

Additional guards live under `@/server/guards/` -- these are route-specific wrappers (e.g., `requireQuota`) that compose the policy primitives.

## Rate limiting

There is no shared rate-limit module. Public forms that write a row per submission (contact, feedback) count their own recent rows and throw `SYSTEM_ERRORS.RATE_LIMITED` when the caller is over the limit, so the submissions table is the counter:

```ts
const [{ count: recentCount }] = await db
  .select({ count: count() })
  .from(contactSubmissions)
  .where(and(eq(contactSubmissions.email, normalizedEmail), gt(contactSubmissions.createdAt, oneHourAgo)));
if (recentCount >= MAX_SUBMISSIONS_PER_HOUR) {
  throwDomainError(SYSTEM_ERRORS.RATE_LIMITED);
}
```

The Better Auth endpoints under `/api/auth/*` use Better Auth's own per-IP limiter with D1 storage (see Rate Limiting in the authentication guide). A single Cloudflare rate-limiting rule blocks any IP that exceeds 300 requests to `/api/*` in 10 seconds, as a flood backstop only; no endpoint relies on it for its own limit.

## Validation

Server functions declare their input with Zod in `.validator(...)`. Input that fails it is rejected before the handler runs, so the handler can trust `data`. Reuse shared schemas where they exist (`workspaceSlugSchema`, `workspaceNameSchema`, plan and step enums) so the client and server agree.

```ts
.validator(z.object({ orgId: z.string(), targetPlan: z.string() }))
```

API routes parse their own bodies. Use Zod for anything broad or user-submitted, and return a `createValidationError` response rather than throwing:

```ts
const parsed = BodySchema.safeParse(await request.json());
if (!parsed.success) {
  const issue = parsed.error.issues[0];
  return Response.json(
    createValidationError(String(issue.path[0]), VALIDATION_ERRORS.INVALID_INPUT.code, null, issue.message),
    { status: 400 },
  );
}
```

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

Server functions throw and API routes return; see the Errors subsections above. Either way the body is the shared domain error schema, which the frontend helpers (`@/lib/error-utils`) turn into user-friendly messages.

## Catch-all 404

`routes/api/$.ts` returns a JSON `SYSTEM_ROUTE_NOT_FOUND` for any `/api/*` path that no concrete route claims. This prevents API clients from receiving the SPA HTML shell. Leave it in place; do not add route-specific 404s unless the request shape demands one.

## Testing

Server tests follow the `*.server.test.ts` suffix and run under `vitest.server.config.ts` in workerd, with a real D1 (`pnpm --filter web test`).

Server functions are tested through their `X.server.ts` logic, with a hand-built session and factory-seeded data:

```ts
import { fetchUsage } from '@/server/functions/billing.server';

const { org, owner } = await buildOrg();
const session = {
  user: { id: owner.id, email: owner.email, name: owner.name },
  session: { id: 's', userId: owner.id },
} as Session;
const usage = await fetchUsage(createDb(env.DB), session, org.id);
```

API route handlers are named exports, so tests import them and synthesize a `Request`:

```ts
import { handlePost } from '../client-logs';

const res = await handlePost({
  request: new Request('http://localhost/api/client-logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entries: [{ level: 'info', message: 'client.example', route: '/' }] }),
  }),
});
```

## Don'ts

- Don't read bindings from `process.env` -- use `import { env } from 'cloudflare:workers'`.
- Don't add an API route for something a server function can do.
- Don't return a Response from a server function, or throw across an API route boundary.
- Don't bypass Drizzle by issuing raw SQL against `env.DB`.
- Don't import from `drizzle-orm/d1` directly in routes; use `@corates/db/client`.
- Don't put shared authz or resolver logic in a route or `.functions.ts` file -- move it to `@corates/workers` or the `.server.ts` file.
- Don't add Hono to `packages/web`. The main app is TanStack Start end-to-end.
