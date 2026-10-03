# Organizations Guide

This guide covers the organization model in CoRATES: how orgs, projects, members, and invitations fit together, and the server functions and guards used in the codebase today. The UI always calls an organization a **workspace**; code and tables keep `org`/`organization`.

## Overview

CoRATES is multi-tenant:

- **Organizations** are the top-level container. Billing attaches here.
- **Projects** belong to exactly one organization.
- **Users** can belong to multiple organizations with different roles.
- **Invitations** grant project membership, and accepting one always adds the user to the project's workspace.

Every project member is a workspace member. The project access guard requires workspace membership, and the collaborator quota counts workspace members, so a project member outside the workspace cannot exist. Removing someone from a project leaves them in the workspace (still holding a seat); removing them from the workspace takes them off every project in it.

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
- `projectInvitations` -- `orgId`, `projectId`, `email`, `role`, `orgRole`, `grantOrgMembership`, `token` (unique), `expiresAt`, `acceptedAt`, `emailSentAt`, `emailStatus`. Unique on (`projectId`, `email`).

`grantOrgMembership` on an invitation is written but not read: `acceptInvitation` always adds a missing workspace membership at the invitation's `orgRole`, which `createInvitation` always sets to `member`.

`organization.slug` is the workspace URL. Rules live in `@corates/shared` (`workspaceSlugSchema`, `RESERVED_WORKSPACE_SLUGS`): lowercase letters, digits and single hyphens, 2 to 40 characters, never a top-level route name. `pickAvailableWorkspaceSlug` (`@corates/workers/workspace-slug`) picks a free one from a name, numbering on collision. Personal workspaces are created on the first session with `metadata = {"type":"personal"}`.

## Role Hierarchies

### Organization

| Role     | What it grants                                                                |
| -------- | ----------------------------------------------------------------------------- |
| `owner`  | Workspace settings (name, URL), members, billing, and creating projects       |
| `admin`  | Nothing beyond `member` yet; kept in the schema for later                     |
| `member` | Access to the workspace projects they were invited to; cannot create projects |

Only the owner creates projects, because projects bill to the owner's plan.

Hierarchy: `owner > admin > member`. Use `hasOrgRole(actual, minRole)` from `@corates/workers/policies`.

### Project

| Role     | What it grants                                       |
| -------- | ---------------------------------------------------- |
| `owner`  | Full control: delete project, manage project members |
| `member` | Edit project content, upload PDFs                    |

Hierarchy: `owner > member`. Use `hasProjectRole(actual, minRole)` from `@corates/workers/policies`.

## Server functions

The app talks to the server through TanStack Start server functions (`packages/web/src/server/functions/*.functions.ts`), each taking `orgId` explicitly. Nothing reads the session's `activeOrganizationId`.

| Function                                                        | File                        | Auth                                  |
| --------------------------------------------------------------- | --------------------------- | ------------------------------------- |
| `getMyWorkspaces`                                               | `workspaces.functions.ts`   | Authenticated                         |
| `checkSlug`                                                     | `workspaces.functions.ts`   | Authenticated                         |
| `createWorkspace`                                               | `workspaces.functions.ts`   | Authenticated                         |
| `updateWorkspace` (name, slug)                                  | `workspaces.functions.ts`   | Workspace owner                       |
| `getWorkspaceMembers` (members, invites, seats)                 | `workspaces.functions.ts`   | Workspace member                      |
| `removeWorkspaceMember`                                         | `workspaces.functions.ts`   | Workspace owner                       |
| `createProject`                                                 | `org-projects.functions.ts` | Workspace owner + entitlement + quota |
| `updateProject`, `deleteProject`                                | `org-projects.functions.ts` | Project member / owner                |
| `addMemberToProject`, `removeMember`                            | `org-projects.functions.ts` | Project owner                         |
| `getInvitations`, `cancelInvitation`                            | `org-projects.functions.ts` | Project member / owner                |
| `getSubscription`, `getUsage`, `getInvoices`, `checkPlanChange` | `billing.functions.ts`      | Workspace member                      |
| `checkoutSubscription`, `openBillingPortal`                     | `billing.functions.ts`      | Workspace owner                       |

`removeWorkspaceMember` runs the project `removeMember` command for each of the person's projects in the workspace (which kicks their sync sessions and notifies them), cancels their pending invitations there, and then deletes the `member` row. It refuses to remove the owner, and refuses while the person is the only owner of a project.

The only org-scoped REST routes are the PDF routes under `/api/orgs/:orgId/projects/:projectId/studies/:studyId/pdfs`. Better Auth's own `/api/auth/organization/*` endpoints are closed (404) in `routes/api/auth/$.ts`, because they skip slug rules, seat counts and sync-session cleanup.

## Server guards

Server functions gate themselves with **guard functions** that return a tagged `{ ok, context | error }` union rather than throwing. Each guard lives in `packages/web/src/server/guards/`.

| Guard                   | Signature                                     | Purpose                                       |
| ----------------------- | --------------------------------------------- | --------------------------------------------- |
| `requireOrgMembership`  | `(session, db, orgId, minRole?)`              | Ensure caller is an org member, optional role |
| `requireProjectAccess`  | `(session, db, orgId, projectId, minRole?)`   | Ensure caller is a project member + role      |
| `requireOrgWriteAccess` | `(method, db, orgId)`                         | Billing-aware write gate                      |
| `requireEntitlement`    | `(db, orgId, entitlement)`                    | Plan/feature entitlement check                |
| `requireQuota`          | `(db, orgId, quotaKey, getUsage, requested?)` | Quota check against the resolved plan         |

On failure, `result.error` is a `DomainErrorException`; throw it.

### Canonical usage

```ts
export async function addProjectMember(session: Session, db: Database, orgId: OrgId, projectId: ProjectId) {
  const orgMembership = await requireOrgMembership(session, db, orgId);
  if (!orgMembership.ok) throw orgMembership.error;

  const access = await requireProjectAccess(session, db, orgId, projectId, 'owner');
  if (!access.ok) throw access.error;

  // access.context: { userId, userEmail, orgId, projectId, projectName, projectRole }
}
```

Order matters: run `requireOrgMembership` before `requireProjectAccess` so that a user without org membership gets the org-scoped error rather than a project-not-found error.

For mutations that affect billing, add `requireOrgWriteAccess` and / or `requireQuota` after the access check.

## Frontend routing

Everything inside a workspace lives under its slug, the first path segment (the Linear model). Account settings, which belong to the person, stay outside it. See [Frontend Route Structure](/architecture/diagrams/05-frontend-routes) for the full table, the redirects that keep old URLs working, and why a wrong slug on a project link is corrected rather than rejected.

| Route pattern                                                              | Purpose                                |
| -------------------------------------------------------------------------- | -------------------------------------- |
| `/:workspace`                                                              | Workspace home                         |
| `/:workspace/projects/:projectId`                                          | Project overview                       |
| `/:workspace/projects/:projectId/studies/:studyId/checklists/:checklistId` | Checklist editor                       |
| `/:workspace/projects/:projectId/studies/:studyId/reconcile/:c1Id/:c2Id`   | Checklist reconciliation               |
| `/:workspace/settings/general`, `members`, `billing`, `plans`              | Workspace settings, owner only         |
| `/settings/account/*`                                                      | Account settings                       |
| `/create-workspace`                                                        | Create a workspace (from the switcher) |
| `/admin/*`                                                                 | Admin-only                             |

The top-left sidebar menu (`AccountMenu`) is the workspace switcher: it shows the current workspace's name and lists the user's workspaces, Create workspace, and, for the owner, Workspace settings and Members. General edits the name and URL (`updateWorkspace`); Members shows seat usage, the people in the workspace with their projects, pending invitations with Cancel, and Remove (`removeWorkspaceMember`). The name and URL inputs share `useWorkspaceDraft` and `WorkspaceUrlField`, which checks availability as the user types.

Build in-workspace links with `@/lib/workspacePaths` (`workspaceHomePath`, `projectPath`, `workspaceSettingsPath`); inside a project, use `projectPath` and the path builders on `useProjectContext()`.

### Resolving orgId from a project

Use `useProjectOrgId(projectId)` from `@/hooks/useProjectOrgId`:

```ts
import { useProjectOrgId } from '@/hooks/useProjectOrgId';

function ProjectHeader({ projectId }: { projectId: string }) {
  const orgId = useProjectOrgId(projectId);
  // ...
}
```

It reads the D1 project list (`getMyProjects`) through React Query, falling back to the orgId cached in Dexie on a cold refresh. Returns `null` if neither is populated yet.

### Listing the user's workspaces

Use `useWorkspaces()` from `@/hooks/useWorkspaces` (owned first), and `useCurrentWorkspace()` for the one in the URL (or the default outside a workspace URL). `useSubscription(orgId?)` and `useWorkspaceMembers(orgId?)` default to the current workspace; pass the project's `orgId` inside a project so seat checks use the project's workspace.

## Invitation Flow

Every project add is an invitation: whether the owner picks an existing user or types an unknown email, the server creates a `projectInvitations` row and emails a link, and membership is only created when the recipient accepts. Direct membership writes are reserved for internal/test tooling (`addMember` command, dev routes).

1. Project owner calls `addMemberToProject` with `{ userId | email, role }`.
2. Server checks the collaborator quota (every workspace member, owner included, plus live invitations to people not yet in the workspace count as seats; inviting an existing workspace member takes none), then `createInvitation` applies the send caps from `INVITATION_LIMITS`: at most 20 live invitations per project, at most 30 created per inviter per hour, and one email per address per 10 minutes.
3. Server creates or updates the `projectInvitations` row (one per project and address) and queues an email carrying `/invite/<token>`. The result reports `delivery` as `queued`, `recently_sent` (inside the cooldown, no new email) or `not_sent` (queue failure or an address that cannot take mail); the invite modal's toast reflects it. An account matching the address also gets an `invitation.received` notification.
4. The queue consumer acks a permanently rejected address (Postmark 300/406) without retrying and marks the row `emailStatus = 'undeliverable'`; a dead-lettered message does the same. The pending-invitations list shows "Email could not be delivered" for that row.
5. Invitee opens the link, lands on `/invite/$token`, and signs up or signs in if needed.
6. Frontend calls `acceptInvitation` with the token.
7. Server validates: token exists, not expired, not accepted. The invited email is a delivery address, not an identity check: membership binds to whichever authenticated account accepts the token, so someone invited at an institutional alias can accept from an account keyed to a different address.
8. If the user is not yet in the workspace, the server adds them as `member`. This is the step that consumes a seat, so it is checked against `collaborators.org.max` inside the insert.
9. Server adds `projectMembers` with `role`.
10. Frontend opens the project at `/<slug>/projects/<id>`, using the `orgSlug` that `acceptInvitation` returns, or the dashboard when there is none.

## Best Practices

### Backend

- **Use the guard functions**, not ad-hoc session + membership checks.
- **Check `result.ok` and throw `result.error` on failure** -- the guards package up domain errors and status codes for you.
- **Take `orgId` as input** -- never derive the workspace from the session.
- **Order guards outside-in**: auth → org → project → entitlement → quota → handler.
- **Rate limit before the guards** for routes that deserve it; see Rate limiting in the API development guide for the pattern.

### Frontend

- **Put the workspace slug first** in every in-workspace link, via `@/lib/workspacePaths`.
- **Use `useWorkspaces` / `useProjectOrgId`** rather than reading from Better Auth or fetching directly.
- **Gate UI on plan entitlement** via `@corates/shared/plans` helpers (e.g., `isUnlimitedQuota`) so billed features show disabled states rather than failing mid-flow.

## Related Guides

- [Authentication Guide](/guides/authentication) -- session, Better Auth setup, auth-store.
- [API Development Guide](/guides/api-development) -- handler layout, error handling, bindings.
- [Database Guide](/guides/database) -- schema and migrations.
