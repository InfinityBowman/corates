# Frontend Route Structure

Application routing under TanStack Router (file-based). Everything inside a workspace lives under the **workspace slug** as the first path segment (`/<slug>/...`), the Linear URL model. Files live under `packages/web/src/routes/`.

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
        dashboard["/dashboard<br/>(signed out: local appraisals;<br/>signed in: redirect to workspace)"]
        localcheck["/checklist/:checklistId<br/>(local-only)"]

        subgraph Protected["_app/_protected (auth required)"]
            account["/settings/account/*"]
            admin["/admin/*"]
            createorg["/create-workspace"]
            subgraph Workspace["/:workspace layout"]
                home["/:workspace"]
                projectview["/:workspace/projects/:projectId"]
                checklistview[".../studies/:studyId/checklists/:checklistId"]
                reconcile[".../studies/:studyId/reconcile/:c1/:c2"]
                wsettings["/:workspace/settings/*"]
            end
        end
    end

    signin --> dashboard
    signup --> completeprofile
    completeprofile --> dashboard
    dashboard --> home
    home --> projectview
    projectview --> checklistview
    checklistview --> reconcile
```

## Layouts

TanStack file-based conventions: an underscore prefix (`_app`, `_auth`) denotes a layout that wraps its children without contributing a path segment.

| Layout                       | File                                    | Purpose                                                                          |
| ---------------------------- | --------------------------------------- | -------------------------------------------------------------------------------- |
| `_auth`                      | `routes/_auth.tsx`                      | Public flows; redirects to `/dashboard` if logged in                             |
| `_app`                       | `routes/_app.tsx`                       | Top-level app chrome                                                             |
| `_app/_protected`            | `routes/_app/_protected.tsx`            | Auth guard via `beforeLoad` + `selectIsLoggedIn`                                 |
| `_app/_protected/$workspace` | `routes/_app/_protected/$workspace.tsx` | Resolves the slug against the user's workspaces; "Workspace not found" otherwise |

## Public routes (`_auth`)

| Route               | File                                | Purpose                                                                  |
| ------------------- | ----------------------------------- | ------------------------------------------------------------------------ |
| `/signin`           | `routes/_auth/signin.tsx`           | Password, code, OAuth                                                    |
| `/signup`           | `routes/_auth/signup.tsx`           | New account                                                              |
| `/verify-email`     | `routes/_auth/verify-email.tsx`     | Email verification code                                                  |
| `/complete-profile` | `routes/_auth/complete-profile.tsx` | Post-signup profile, then naming the workspace (skipped for invitations) |
| `/reset-password`   | `routes/_auth/reset-password.tsx`   | Password recovery                                                        |

## Authenticated routes (`_app/_protected`)

| Route                                                                      | Purpose                                                 |
| -------------------------------------------------------------------------- | ------------------------------------------------------- |
| `/:workspace`                                                              | Workspace home: its projects, your invitations          |
| `/:workspace/projects/:projectId`                                          | Project overview (studies, members)                     |
| `/:workspace/projects/:projectId/studies/:studyId/checklists/:checklistId` | Checklist assessment                                    |
| `/:workspace/projects/:projectId/studies/:studyId/reconcile/:c1Id/:c2Id`   | Reconcile two reviewers' checklists                     |
| `/:workspace/settings/general`, `members`, `billing`, `plans`              | Workspace settings; non-owners get an owner-only notice |
| `/settings/account/profile`, `security`, `preferences`, `integrations`     | Account settings, per person, outside any slug          |
| `/create-workspace`                                                        | Create a new workspace (from the switcher)              |
| `/admin/*`                                                                 | Admin-only dashboards and tools                         |

## Local-only routes

| Route                     | File                                     | Purpose                                                                  |
| ------------------------- | ---------------------------------------- | ------------------------------------------------------------------------ |
| `/checklist/:checklistId` | `routes/_app/checklist.$checklistId.tsx` | Local-only demo checklist, stored in Dexie/IndexedDB -- no auth required |

## URL contract

- **The slug comes first.** In-workspace routes are `/<slug>/...`. Slugs follow `workspaceSlugSchema` and never equal a top-level route (`RESERVED_WORKSPACE_SLUGS`, enforced by a test over the route files), because static routes outrank `/$workspace`.
- **The slug in a project URL is cosmetic.** A project id identifies its workspace, so the project route replaces a wrong slug with the project's own. Old links therefore keep working after a slug change, and `WorkspaceNotFound` forwards `/<unknown>/projects/...` the same way.
- **Old URLs redirect.** `/projects/*` and the signed-in `/dashboard` go to the same page in the default workspace (last used, else owned, else first; `pickDefaultWorkspace`). `/settings/profile|security|preferences|integrations` go to `/settings/account/...`, and `/settings/billing|plans` to the default workspace's settings, keeping the query string so in-flight Stripe returns still land.
- **The current workspace is the URL.** `useCurrentWorkspace()` reads the `workspace` param; outside a workspace URL (account settings) it falls back to the default.
- **Admin routes use explicit orgId/projectId/userId in the URL** for admin-only navigation, but those are not part of the public contract.

See the [Organizations Guide](/guides/organizations#frontend-routing) for the hooks (`useWorkspaces`, `useCurrentWorkspace`, `useProjectOrgId`) used to resolve context.
