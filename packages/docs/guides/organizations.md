# Organizations Guide

This guide covers the organization (workspace) model in CoRATES, including data architecture, API routes, role hierarchies, and frontend routing patterns.

## Overview

CoRATES uses a multi-tenant organization model where:

- **Organizations** (workspaces) are the top-level container for collaboration
- **Projects** belong to organizations and contain research data
- **Users** can belong to multiple organizations with different roles
- **Invitations** grant both org and project membership in a combined flow

This architecture enables team collaboration while maintaining clear access boundaries.

## Data Model

### Entity Hierarchy

```
Organization
    |
    +-- Projects (owned by org)
    |       |
    |       +-- Studies (in Durable Objects)
    |       |       |
    |       |       +-- Checklists
    |       |               |
    |       |               +-- Answers
    |       |
    |       +-- Project Members (access control)
    |
    +-- Org Members (org-level access)
```

### Storage Split

| Entity                       | Storage               | Purpose                          |
| ---------------------------- | --------------------- | -------------------------------- |
| Organizations                | D1 (SQLite)           | Org metadata, Better Auth plugin |
| Org Members                  | D1 (SQLite)           | Org membership, roles            |
| Projects (metadata)          | D1 (SQLite)           | Project info, access control     |
| Project Members              | D1 (SQLite)           | Project-level access control     |
| Project Invitations          | D1 (SQLite)           | Pending invitations with tokens  |
| Studies, Checklists, Answers | Durable Objects (Yjs) | Real-time collaborative content  |
| PDFs                         | R2                    | Large binary files               |

### Database Schema

#### Organization Table

```js
export const organization = sqliteTable('organization', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').unique(),
  logo: text('logo'),
  metadata: text('metadata'), // JSON string
  createdAt: integer('createdAt', { mode: 'timestamp' }),
});
```

#### Org Member Table

```js
export const member = sqliteTable('member', {
  id: text('id').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => user.id),
  organizationId: text('organizationId')
    .notNull()
    .references(() => organization.id),
  role: text('role').notNull().default('member'), // owner, admin, member
  createdAt: integer('createdAt', { mode: 'timestamp' }),
});
```

#### Projects Table

```js
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  orgId: text('orgId')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  createdBy: text('createdBy')
    .notNull()
    .references(() => user.id),
  createdAt: integer('createdAt', { mode: 'timestamp' }),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }),
});
```

#### Project Invitations Table

```js
export const projectInvitations = sqliteTable('project_invitations', {
  id: text('id').primaryKey(),
  orgId: text('orgId')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  projectId: text('projectId')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role').default('member'), // project role to assign
  orgRole: text('orgRole').default('member'), // org role if grantOrgMembership is true
  grantOrgMembership: integer('grantOrgMembership', { mode: 'boolean' }).default(false).notNull(),
  token: text('token').notNull().unique(),
  invitedBy: text('invitedBy')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
  acceptedAt: integer('acceptedAt', { mode: 'timestamp' }),
  createdAt: integer('createdAt', { mode: 'timestamp' }),
});
```

**Note:** Projects are always invite-only. By default, accepting an invitation grants project membership only. The `grantOrgMembership` field can be set to `true` by org admins/owners to also grant organization membership (for governance/billing purposes).

## Role Hierarchies

### Organization Roles

| Role     | Permissions                                                   |
| -------- | ------------------------------------------------------------- |
| `owner`  | Full control: delete org, manage all members, change any role |
| `admin`  | Manage members (except owners), update org settings           |
| `member` | View org, access assigned projects, create projects           |

**Hierarchy:** `owner > admin > member`

### Project Roles

| Role     | Permissions                                      |
| -------- | ------------------------------------------------ |
| `owner`  | Full control: delete project, manage all members |
| `member` | Edit project content, upload PDFs                |

**Hierarchy:** `owner > member`

## API Routes

### URL Structure

All org-scoped routes follow this pattern:

```
/api/orgs/:orgId/...
```

The frontend uses `orgSlug` in URLs for readability, but the API uses `orgId` for consistency.

### Organization Routes

| Method   | Endpoint                      | Description               | Required Role |
| -------- | ----------------------------- | ------------------------- | ------------- |
| `GET`    | `/api/orgs`                   | List user's organizations | Auth          |
| `POST`   | `/api/orgs`                   | Create organization       | Auth          |
| `GET`    | `/api/orgs/:orgId`            | Get org details           | Org member    |
| `PUT`    | `/api/orgs/:orgId`            | Update org                | Org admin     |
| `DELETE` | `/api/orgs/:orgId`            | Delete org                | Org owner     |
| `POST`   | `/api/orgs/:orgId/set-active` | Set active org            | Org member    |

### Organization Member Routes

| Method   | Endpoint                             | Description      | Required Role       |
| -------- | ------------------------------------ | ---------------- | ------------------- |
| `GET`    | `/api/orgs/:orgId/members`           | List org members | Org member          |
| `POST`   | `/api/orgs/:orgId/members`           | Add member       | Org admin           |
| `PUT`    | `/api/orgs/:orgId/members/:memberId` | Update role      | Org admin           |
| `DELETE` | `/api/orgs/:orgId/members/:memberId` | Remove member    | Org admin (or self) |

### Project Routes (Org-Scoped)

| Method   | Endpoint                               | Description    | Required Role            |
| -------- | -------------------------------------- | -------------- | ------------------------ |
| `GET`    | `/api/orgs/:orgId/projects`            | List projects  | Org member               |
| `POST`   | `/api/orgs/:orgId/projects`            | Create project | Org member + entitlement |
| `GET`    | `/api/orgs/:orgId/projects/:projectId` | Get project    | Project member           |
| `PUT`    | `/api/orgs/:orgId/projects/:projectId` | Update project | Project member           |
| `DELETE` | `/api/orgs/:orgId/projects/:projectId` | Delete project | Project owner            |

### Project Member Routes

| Method   | Endpoint                                               | Description   | Required Role  |
| -------- | ------------------------------------------------------ | ------------- | -------------- |
| `GET`    | `/api/orgs/:orgId/projects/:projectId/members`         | List members  | Project member |
| `POST`   | `/api/orgs/:orgId/projects/:projectId/members`         | Add member    | Project owner  |
| `PATCH`  | `/api/orgs/:orgId/projects/:projectId/members/:userId` | Update role   | Project owner  |
| `DELETE` | `/api/orgs/:orgId/projects/:projectId/members/:userId` | Remove member | Project owner  |

### Project Invitation Routes

| Method   | Endpoint                                               | Description       | Required Role  |
| -------- | ------------------------------------------------------ | ----------------- | -------------- |
| `GET`    | `/api/orgs/:orgId/projects/:projectId/invitations`     | List invitations  | Project member |
| `POST`   | `/api/orgs/:orgId/projects/:projectId/invitations`     | Create invitation | Project owner  |
| `DELETE` | `/api/orgs/:orgId/projects/:projectId/invitations/:id` | Cancel invitation | Project owner  |

### PDF Routes (Org-Scoped)

| Method   | Endpoint                                                               | Description  | Required Role  |
| -------- | ---------------------------------------------------------------------- | ------------ | -------------- |
| `GET`    | `/api/orgs/:orgId/projects/:projectId/studies/:studyId/pdfs`           | List PDFs    | Project member |
| `POST`   | `/api/orgs/:orgId/projects/:projectId/studies/:studyId/pdfs`           | Upload PDF   | Project member |
| `GET`    | `/api/orgs/:orgId/projects/:projectId/studies/:studyId/pdfs/:fileName` | Download PDF | Project member |
| `DELETE` | `/api/orgs/:orgId/projects/:projectId/studies/:studyId/pdfs/:fileName` | Delete PDF   | Project member |

## Backend Middleware

### requireOrgMembership

Verifies the user is a member of the organization specified in the URL:

```js
import { requireOrgMembership, getOrgContext } from '../middleware/requireOrg.js';

// Basic usage - any org member
orgRoutes.get('/:orgId', requireOrgMembership(), async c => {
  const { orgId, orgRole, org } = getOrgContext(c);
  // ...
});

// With minimum role requirement
orgRoutes.put('/:orgId', requireOrgMembership('admin'), async c => {
  // Only org admins and owners can access
});
```

### requireProjectAccess

Verifies the user has access to the project. Must be used **after** `requireOrgMembership`:

```js
import { requireOrgMembership, requireProjectAccess, getProjectContext } from '../middleware/requireOrg.js';

// Basic usage - any project member
projectRoutes.get('/:projectId', requireOrgMembership(), requireProjectAccess(), async c => {
  const { projectId, projectRole, project } = getProjectContext(c);
  // ...
});

// With minimum role requirement
projectRoutes.put('/:projectId', requireOrgMembership(), requireProjectAccess('member'), async c => {
  // Only project members and owners can access
});
```

### Middleware Chain Order

```js
routes.post(
  '/',
  requireAuth, // 1. Verify logged in
  requireOrgMembership('admin'), // 2. Check org membership + role
  requireProjectAccess('owner'), // 3. Check project access + role
  requireEntitlement('project.update'), // 4. Check subscription entitlement
  validateRequest(projectSchemas.update), // 5. Validate request body
  async c => {
    /* handler */
  },
);
```

## Frontend Routing

### URL Structure

Frontend routes use `orgSlug` for human-readable URLs:

```
/orgs/:orgSlug/...
```

| Route                                                                         | Component             | Purpose                              |
| ----------------------------------------------------------------------------- | --------------------- | ------------------------------------ |
| `/orgs/new`                                                                   | CreateOrgPage         | Create new organization              |
| `/orgs/:orgSlug`                                                              | OrgProjectsPage       | Organization dashboard, project list |
| `/orgs/:orgSlug/projects/:projectId`                                          | ProjectView           | Project overview                     |
| `/orgs/:orgSlug/projects/:projectId/studies/:studyId/checklists/:checklistId` | ChecklistYjsWrapper   | Checklist editor                     |
| `/orgs/:orgSlug/projects/:projectId/studies/:studyId/reconcile/:c1/:c2`       | ReconciliationWrapper | Compare checklists                   |

### useOrgContext Primitive

Resolves the current organization from URL params:

```js
import { useOrgContext } from '@primitives/useOrgContext.js';

function MyComponent() {
  const {
    // Data
    orgSlug, // () => string - slug from URL
    currentOrg, // () => org object or null
    orgs, // () => array of user's orgs
    orgId, // () => string - resolved org ID
    orgName, // () => string - org name

    // Guard states
    isLoading, // () => boolean
    isError, // () => boolean
    hasNoOrgs, // () => boolean - user has no orgs
    orgNotFound, // () => boolean - slug doesn't match any org

    // Actions
    refetchOrgs, // () => void
  } = useOrgContext();

  return (
    <Show when={!isLoading() && !orgNotFound()}>
      <div>Current org: {orgName()}</div>
    </Show>
  );
}
```

### useOrgProjectContext Primitive

Combines org context with project context for project-level routes:

```js
import { useOrgProjectContext } from '@primitives/useOrgProjectContext.js';

function ProjectComponent() {
  const {
    // From org context
    orgSlug,
    orgId,
    orgName,
    currentOrg,
    isLoadingOrg,
    orgNotFound,
    hasNoOrgs,

    // Project context
    projectId, // () => string from URL
    basePath, // () => string - /orgs/:slug/projects/:id
    projectIdMissing, // () => boolean

    // Combined state
    isReady, // () => boolean - org resolved and project ID exists

    // Path builders
    getStudyPath, // (studyId) => string
    getChecklistPath, // (studyId, checklistId) => string
    getReconcilePath, // (studyId, c1Id, c2Id) => string
  } = useOrgProjectContext();

  return (
    <Show when={isReady()}>
      <a href={getStudyPath('study-123')}>View Study</a>
    </Show>
  );
}
```

### Path Builder Utilities

For building org-scoped URLs outside of components:

```js
import {
  buildOrgProjectPath,
  buildStudyPath,
  buildChecklistPath,
  buildReconcilePath,
} from '@primitives/useOrgProjectContext.js';

// /orgs/my-lab/projects/proj-123
buildOrgProjectPath('my-lab', 'proj-123');

// /orgs/my-lab/projects/proj-123/studies/study-456
buildStudyPath('my-lab', 'proj-123', 'study-456');

// /orgs/my-lab/projects/proj-123/studies/study-456/checklists/check-789
buildChecklistPath('my-lab', 'proj-123', 'study-456', 'check-789');
```

## Invitation Flow

Project invitations support optional organization membership granting:

### Creating an Invitation

1. Project owner calls `POST /api/orgs/:orgId/projects/:projectId/invitations`
2. Server creates invitation with:
   - `orgId`, `projectId`
   - `role` (project role to assign)
   - `orgRole` (org role if `grantOrgMembership` is true)
   - `grantOrgMembership` (boolean, default false)
3. Magic link email is sent to invitee

### Accepting an Invitation

1. User clicks magic link, lands on `/complete-profile?invitation=TOKEN`
2. Frontend calls `POST /api/invitations/accept` with token
3. Server validates:
   - Token exists and hasn't expired
   - Email matches authenticated user (case-insensitive, trimmed)
   - Invitation hasn't been accepted
4. If `grantOrgMembership` is true:
   - Server adds org membership with `orgRole` (if not already a member)
5. Server adds project membership with `role`
6. User is redirected to the project

### Flow Diagram

```
Inviter                    Server                    Invitee
   |                          |                          |
   |-- POST invitations -->   |                          |
   |                          |-- Send magic link -----> |
   |                          |                          |
   |                          |   <-- Click link --------|
   |                          |   <-- POST accept -------|
   |                          |                          |
   |                          |-- Validate token         |
   |                          |-- Check email match      |
   |                          |-- Add org member (if grantOrgMembership)
   |                          |-- Add project member     |
   |                          |-- Return success ------> |
   |                          |                          |
```

### Invitation Types

| grantOrgMembership | Behavior                                                                                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `false` (default)  | Only grants project membership. User can access this project but is not an org member.                                                                    |
| `true`             | Grants both org membership (with `orgRole`) and project membership. Use for team members who need org-level access (governance, billing, other projects). |

## Active Organization

Better Auth tracks the user's "active" organization in the session:

```js
// Set active org
await authClient.organization.setActive({ organizationId: orgId });

// Or via API
POST /api/orgs/:orgId/set-active
```

The `session.activeOrganizationId` is used by Better Auth for default organization context. The frontend uses URL-based routing (`/orgs/:orgSlug/...`) as the primary source of truth for current org.

## Best Practices

### Backend

- **Always use middleware** - Don't manually check org/project membership in handlers
- **Chain middleware correctly** - `requireAuth` -> `requireOrgMembership` -> `requireProjectAccess`
- **Use minimum roles** - Pass role to middleware: `requireOrgMembership('admin')`
- **Use context helpers** - `getOrgContext(c)` and `getProjectContext(c)` for clean access

### Frontend

- **Use primitives** - `useOrgContext` and `useOrgProjectContext` handle loading/error states
- **Check guard states** - Always check `isLoading()`, `orgNotFound()`, etc. before rendering
- **Use path builders** - Don't hardcode org-scoped URLs
- **Store last org** - Use `setLastOrgSlug()` to remember user's last org for redirect

### API Calls

```js
// Fetch projects for current org
const response = await fetch(`${API_BASE}/api/orgs/${orgId()}/projects`, {
  credentials: 'include',
});

// Create project in org
const response = await fetch(`${API_BASE}/api/orgs/${orgId()}/projects`, {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name, description }),
});
```

## Related Guides

- [Authentication Guide](/guides/authentication) - Better Auth setup and org plugin
- [API Development Guide](/guides/api-development) - Route patterns with org middleware
- [Database Guide](/guides/database) - Schema details and relationships
- [Primitives Guide](/guides/primitives) - Using org context primitives
