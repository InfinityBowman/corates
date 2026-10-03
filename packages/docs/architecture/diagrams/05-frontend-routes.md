# Frontend Route Structure

Application routing under TanStack Router (file-based). Routes are **project-centric**: no workspace slug appears in URLs, and Home at `/dashboard` lists every project the user is on, whichever workspace holds it. Files live under `packages/web/src/routes/`.

```mermaid
flowchart TD
    subgraph Public["_auth layout (public)"]
        signin["/signin"]
        signup["/signup"]
        verifyemail["/verify-email"]
        completeprofile["/complete-profile"]
        resetpw["/reset-password"]
    end

    subgraph App["_app layout"]
        dashboard["/dashboard<br/>(every project; signed out: local appraisals)"]
        localcheck["/checklist/:checklistId<br/>(local-only)"]

        subgraph Protected["_app/_protected (auth required)"]
            settings["/settings/*"]
            admin["/admin/*"]
            projectview["/projects/:projectId"]
            checklistview["/projects/:projectId/studies/:studyId/checklists/:checklistId"]
            reconcile["/projects/:projectId/studies/:studyId/reconcile/:c1/:c2"]
        end
    end

    signin --> dashboard
    signup --> completeprofile
    completeprofile --> dashboard
    dashboard --> projectview
    projectview --> checklistview
    checklistview --> reconcile
```

## Layouts

TanStack file-based conventions: an underscore prefix (`_app`, `_auth`) denotes a layout that wraps its children without contributing a path segment.

| Layout            | File                         | Purpose                                              |
| ----------------- | ---------------------------- | ---------------------------------------------------- |
| `_auth`           | `routes/_auth.tsx`           | Public flows; redirects to `/dashboard` if logged in |
| `_app`            | `routes/_app.tsx`            | Top-level app chrome                                 |
| `_app/_protected` | `routes/_app/_protected.tsx` | Auth guard via `beforeLoad` + `selectIsLoggedIn`     |

## Public routes (`_auth`)

| Route               | File                                | Purpose                   |
| ------------------- | ----------------------------------- | ------------------------- |
| `/signin`           | `routes/_auth/signin.tsx`           | Password, code, OAuth     |
| `/signup`           | `routes/_auth/signup.tsx`           | New account               |
| `/verify-email`     | `routes/_auth/verify-email.tsx`     | Email verification code   |
| `/complete-profile` | `routes/_auth/complete-profile.tsx` | Post-signup + invitations |
| `/reset-password`   | `routes/_auth/reset-password.tsx`   | Password recovery         |

## Authenticated routes (`_app/_protected`)

| Route                                                           | Purpose                                                       |
| --------------------------------------------------------------- | ------------------------------------------------------------- |
| `/dashboard`                                                    | Home: every project you are on, invitations, local appraisals |
| `/projects/:projectId`                                          | Project overview (studies, members)                           |
| `/projects/:projectId/studies/:studyId/checklists/:checklistId` | Checklist assessment                                          |
| `/projects/:projectId/studies/:studyId/reconcile/:c1Id/:c2Id`   | Reconcile two reviewers' checklists                           |
| `/settings/profile`, `security`, `preferences`, `integrations`  | Account settings, per person                                  |
| `/settings/workspace`, `members`, `billing`, `plans`            | Settings for the workspace the user owns                      |
| `/admin/*`                                                      | Admin-only dashboards and tools                               |

## Local-only routes

| Route                     | File                                     | Purpose                                                                  |
| ------------------------- | ---------------------------------------- | ------------------------------------------------------------------------ |
| `/checklist/:checklistId` | `routes/_app/checklist.$checklistId.tsx` | Local-only demo checklist, stored in Dexie/IndexedDB -- no auth required |

## URL contract

- **Project IDs, not slugs.** The URL contains `projectId`, not a workspace slug. The project's `orgId` is resolved from the store / query cache via `useProjectOrgId(projectId)`.
- **orgId does not appear in frontend URLs.** It only shows up in backend API paths (`/api/orgs/:orgId/...`).
- **Workspace settings are always the user's own workspace** (`useOwnedWorkspace`). New projects go there too.
- **Admin routes use explicit orgId/projectId/userId in the URL** for admin-only navigation, but those are not part of the public contract.

See the [Organizations Guide](/guides/organizations#frontend-routing) for the hooks (`useWorkspaces`, `useOwnedWorkspace`, `useProjectOrgId`) used to resolve context.
