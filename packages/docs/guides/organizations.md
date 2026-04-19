# Organizations Guide

This guide covers the organization (workspace) model in CoRATES: how orgs, projects, members, and invitations fit together, and the actual route and guard patterns used in the codebase today.

## Overview

CoRATES is multi-tenant:

- **Organizations** are the top-level container. Billing attaches here.
- **Projects** belong to exactly one organization.
- **Users** can belong to multiple organizations with different roles.
- **Invitations** grant project membership, and optionally org membership in the same flow.

Project membership is independent of org membership by default -- a user can be a member of a project without being in its org. This is deliberate: outside reviewers/collaborators often don't need org-level access.

## Data Model

| Entity               | Storage          | Source of truth for                   |
| -------------------- | ---------------- | ------------------------------------- |
| Organizations        | D1 (Better Auth) | Org metadata, billing                 |
| Org Members          | D1 (Better Auth) | Org-level access + role               |
| Projects             | D1               | Project metadata                      |
| Project Members      | D1               | Project-level access + role           |
| Project Invitations  | D1               | Pending invites + tokens              |
| Studies / Checklists | Durable Object   | Real-time collaborative content (Yjs) |
| PDFs                 | R2               | Binary uploads                        |

### Key tables

Schema lives in `packages/db/src/schema.ts` -- the canonical reference. Relevant tables:

- `organization`, `member`, `invitation` -- Better Auth organization plugin. `member.role`: `owner | admin | member`.
- `projects` -- `id`, `name`, `description`, `orgId` (FK, cascade), `createdBy`.
- `projectMembers` -- `projectId` (FK), `userId` (FK), `role` (`owner | member`), `joinedAt`.
- `projectInvitations` -- `orgId`, `projectId`, `email`, `role`, `orgRole`, `grantOrgMembership`, `token` (unique), `expiresAt`, `acceptedAt`.

The `grantOrgMembership` flag on an invitation says "also add this user to the org at `orgRole` when they accept." Defaults to `false`; only org admins/owners can set it to `true`.

## Role Hierarchies

### Organization

| Role     | What it grants                                              |
| -------- | ----------------------------------------------------------- |
| `owner`  | Full control: delete org, manage billing, any member action |
| `admin`  | Manage members (except owners), update org settings         |
| `member` | View org, access assigned projects, create projects         |

Hierarchy: `owner > admin > member`. Use `hasOrgRole(actual, minRole)` from `@corates/workers/policies`.

### Project

| Role     | What it grants                                       |
| -------- | ---------------------------------------------------- |
| `owner`  | Full control: delete project, manage project members |
| `member` | Edit project content, upload PDFs                    |

Hierarchy: `owner > member`. Use `hasProjectRole(actual, minRole)` from `@corates/workers/policies`.

## API Routes

All org-scoped API routes follow `/api/orgs/:orgId/...`. The backend always uses `orgId`; slugs are not routed.

### Organization routes (`/api/orgs/*`)

| Method | Endpoint                      | Auth          |
| ------ | ----------------------------- | ------------- |
| GET    | `/api/orgs`                   | Authenticated |
| POST   | `/api/orgs`                   | Authenticated |
| GET    | `/api/orgs/:orgId`            | Org member    |
| PUT    | `/api/orgs/:orgId`            | Org admin     |
| DELETE | `/api/orgs/:orgId`            | Org owner     |
| POST   | `/api/orgs/:orgId/set-active` | Org member    |

### Org member routes (`/api/orgs/:orgId/members`)

Member mutations are delegated to Better Auth's `organization` plugin (`createAuth(env).api.addMember`, etc.).

### Project routes (`/api/orgs/:orgId/projects/*`)

| Method | Endpoint                               | Auth                                        |
| ------ | -------------------------------------- | ------------------------------------------- |
| GET    | `/api/orgs/:orgId/projects`            | Org member                                  |
| POST   | `/api/orgs/:orgId/projects`            | Org member + entitlement (`project.create`) |
| GET    | `/api/orgs/:orgId/projects/:projectId` | Project member                              |
| PUT    | `/api/orgs/:orgId/projects/:projectId` | Project member                              |
| DELETE | `/api/orgs/:orgId/projects/:projectId` | Project owner                               |

### Project member + invitation routes

| Method | Endpoint                                                         | Auth           |
| ------ | ---------------------------------------------------------------- | -------------- |
| GET    | `/api/orgs/:orgId/projects/:projectId/members`                   | Project member |
| POST   | `/api/orgs/:orgId/projects/:projectId/members`                   | Project owner  |
| DELETE | `/api/orgs/:orgId/projects/:projectId/members/:userId`           | Project owner  |
| GET    | `/api/orgs/:orgId/projects/:projectId/invitations`               | Project member |
| POST   | `/api/orgs/:orgId/projects/:projectId/invitations`               | Project owner  |
| DELETE | `/api/orgs/:orgId/projects/:projectId/invitations/:invitationId` | Project owner  |
| POST   | `/api/invitations/accept`                                        | Authenticated  |

## Server guards

Route handlers gate themselves with **guard functions** that return a tagged `{ ok, context | response }` union rather than throwing. Each guard lives in `packages/web/src/server/guards/`.

| Guard                   | Signature                                    | Purpose                                       |
| ----------------------- | -------------------------------------------- | --------------------------------------------- |
| `requireOrgMembership`  | `(request, env, orgId, minRole?)`            | Ensure caller is an org member, optional role |
| `requireProjectAccess`  | `(request, env, orgId, projectId, minRole?)` | Ensure caller is a project member + role      |
| `requireOrgWriteAccess` | `(request, env, orgId)`                      | Billing-aware write gate                      |
| `requireEntitlement`    | `(...)`                                      | Plan/feature entitlement check                |
| `requireQuota`          | `(...)`                                      | Quota bookkeeping                             |
| `requireAdmin`          | `(request, env)`                             | Admin-only routes                             |
| `requireTrustedOrigin`  | `(request)`                                  | CSRF / origin check                           |

All guards return:

```ts
type GuardResult<T> = { ok: true; context: T } | { ok: false; response: Response };
```

### Canonical usage

```ts
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { requireOrgMembership } from '@/server/guards/requireOrgMembership';
import { requireProjectAccess } from '@/server/guards/requireProjectAccess';

type HandlerArgs = { request: Request; params: { orgId: string; projectId: string } };

export const handleGet = async ({ request, params }: HandlerArgs) => {
  const orgMembership = await requireOrgMembership(request, env, params.orgId);
  if (!orgMembership.ok) return orgMembership.response;

  const access = await requireProjectAccess(request, env, params.orgId, params.projectId);
  if (!access.ok) return access.response;

  // access.context: { userId, userEmail, orgId, projectId, projectName, projectRole }
  // ... handler work ...
};

export const Route = createFileRoute('/api/orgs/$orgId/projects/$projectId/members')({
  server: { handlers: { GET: handleGet } },
});
```

Order matters: run `requireOrgMembership` before `requireProjectAccess` so that a user without org membership gets the org-scoped error rather than a project-not-found error.

For mutations that affect billing, add `requireOrgWriteAccess` and / or `requireQuota` after the access check.

## Frontend routing

Frontend routes are **project-centric**, not org-slug-centric. There is no `:orgSlug` in URLs; projects know their org via the store and query cache.

| Route pattern                                                   | Purpose                  |
| --------------------------------------------------------------- | ------------------------ |
| `/dashboard`                                                    | Project list (user's)    |
| `/orgs/new`                                                     | Create a new org         |
| `/projects/:projectId`                                          | Project overview         |
| `/projects/:projectId/studies/:studyId/checklists/:checklistId` | Checklist editor         |
| `/projects/:projectId/studies/:studyId/reconcile/:c1Id/:c2Id`   | Checklist reconciliation |
| `/settings/*`                                                   | User settings / billing  |
| `/admin/*`                                                      | Admin-only               |

Route files live under `packages/web/src/routes/_app/_protected/` (authenticated layout).

### Resolving orgId from a project

Use `useProjectOrgId(projectId)` from `@/hooks/useProjectOrgId`:

```ts
import { useProjectOrgId } from '@/hooks/useProjectOrgId';

function ProjectHeader({ projectId }: { projectId: string }) {
  const orgId = useProjectOrgId(projectId);
  // ...
}
```

It resolves in this order: Yjs-synced project meta (`useProjectStore`), then the TanStack Query project-list cache. Returns `null` if neither is populated yet.

### Listing the user's orgs

Use `useOrgs()` from `@/hooks/useOrgs`:

```ts
const { orgs, isLoading, refetch } = useOrgs();
```

Backed by Better Auth's `authClient.organization.list()` plus auth-aware `enabled` gating.

## Invitation Flow

Project invitations use Better Auth's magic-link infrastructure and always run through `POST /api/invitations/accept`.

1. Project owner calls `POST /api/orgs/:orgId/projects/:projectId/invitations` with `{ email, role, grantOrgMembership?, orgRole? }`.
2. Server creates a `projectInvitations` row with a unique token and sends a magic link.
3. Invitee clicks the link, lands on `/complete-profile?invitation=TOKEN`, completes profile if needed.
4. Frontend calls `POST /api/invitations/accept` with the token.
5. Server validates: token exists, not expired, not accepted, authenticated user's email matches invitation email (case-insensitive, trimmed).
6. If `grantOrgMembership === true`, the server adds org membership with `orgRole` (if the user isn't already a member).
7. Server adds `projectMembers` with `role`.
8. Frontend redirects to the project.

## Active Organization

Better Auth tracks an `activeOrganizationId` on the session. The `POST /api/orgs/:orgId/set-active` endpoint updates it. The frontend does not currently use this as the primary source of truth for the "current org" -- project routes derive org from the project itself via `useProjectOrgId`. `activeOrganizationId` is still useful for billing and for some Better Auth plugin behaviors (subscriptions).

## Best Practices

### Backend

- **Use the guard functions**, not ad-hoc session + membership checks.
- **Check `result.ok` and return `result.response` on failure** -- the guards package up domain errors and status codes for you.
- **Order guards outside-in**: auth → org → project → entitlement → quota → handler.
- **Keep per-route rate limits colocated** in `@/server/rateLimit` and call `checkRateLimit` before the guards for routes that deserve it.

### Frontend

- **Don't route with org slugs** -- the URL contract is project-centric.
- **Use `useOrgs` / `useProjectOrgId`** rather than reading from Better Auth or fetching directly.
- **Gate UI on plan entitlement** via `@corates/shared/plans` helpers (e.g., `isUnlimitedQuota`) so billed features show disabled states rather than failing mid-flow.

## Related Guides

- [Authentication Guide](/guides/authentication) -- session, Better Auth setup, auth-store.
- [API Development Guide](/guides/api-development) -- handler layout, error handling, bindings.
- [Database Guide](/guides/database) -- schema and migrations.
