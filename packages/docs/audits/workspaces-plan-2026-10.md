# Workspaces implementation plan (issue #688)

Scoped 2026-10-02. "Org" in code is "workspace" in the UI. Linear is the reference model; where
this plan says "Linear", it means "do what Linear does unless CoRATES forces a difference".

## Where things stand

Production on 2026-10-02:

- 69 users, 70 workspaces, every one personal (`metadata.type = 'personal'`).
- 15 users belong to two or more workspaces, all through accepted project invitations. One
  workspace has no members at all (a leftover from a merged duplicate account).
- 18 projects across 14 workspaces.
- Slugs are `<name>-<8 hex>`, with no cleanup: `patricia-715bcbdb`, `dana-y--6e3030fe`, and
  `---e5d318c3` for a CJK name. No URL uses a slug yet, so slugs can still change for free.

In code:

- No workspace page, switcher, rename, slug edit, or member list. The issue says the
  settings and member-management server functions already exist. They do not: the only
  org-level code is the unused policy `requireOrgMemberRemoval`.
- Which workspace is "current" is decided three different ways:
  - Billing uses `session.activeOrganizationId`, else the first membership row. The client
    never sets it.
  - `CreateProjectModal` uses `orgs[0]` from an unordered list. For the 15 multi-workspace
    users, that can be someone else's workspace, and project creation then fails with
    `insufficient_org_role`. This is a live bug.
  - `MembersPanel` and `useProjectSetup` check seat quotas against the active workspace, not
    the open project's workspace.
- All Better Auth `/api/auth/organization/*` endpoints are reachable from the browser:
  create, update, delete, remove-member, update-member-role, leave, set-active.
  - `create` and `update` accept any slug of one character or more, including `admin` or
    `dashboard`.
  - `delete` cascades projects in D1 but never tears down the sync DO, the backups, or R2.
  - `remove-member` leaves the user's project memberships behind.
- The personal workspace is created in the Better Auth `hooks.after` middleware on the first
  session, before `/complete-profile`. It is skipped if the user already has any membership.
- `/dashboard` sits under the public `_app` layout. Signed-out visitors use it for local
  appraisals.

## Decisions already made

- "Workspace" means the tenant. The per-project sync Durable Object gets renamed.
- The workspace slug is the first path segment for everything inside the workspace, and
  project links move under it.
- Workspace settings are owner-only. Admin and member roles grant nothing at the workspace
  level yet.
- The collaborator limit counts everyone in the workspace, including the owner (#867).
- Scope addition from the 2026-10-02 incident:
  - a members list that shows seat usage ("3 of 3 people, including you");
  - removing someone from the workspace frees a seat. Removing them from a project does not.

## Recommended answers to the open questions

**1. Naming collision.** Rename everything CoRATES owns on the sync side to "project sync":

| Now                                                                    | After                                                          |
| ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| `WorkspaceDO`                                                          | `ProjectSyncDO`                                                |
| binding `WORKSPACE`                                                    | `PROJECT_SYNC`                                                 |
| `sync/workspace.ts`                                                    | `sync/project-sync.ts`                                         |
| `project/workspace-data.ts`                                            | `project/project-data.ts`                                      |
| `useWorkspaceProjectId`                                                | `useSyncedProjectId`                                           |
| `projectWorkspace`, `teardownWorkspace`, `refreshOrgWorkspaceSessions` | `projectSync`, `teardownProjectSync`, `refreshOrgSyncSessions` |
| `backupWorkspaces`                                                     | `backupProjects`                                               |
| `restore-workspace.mjs`                                                | `restore-project.mjs`                                          |
| admin "Workspace Storage"                                              | "Sync storage"                                                 |

- The class rename needs a v6 `renamed_classes` migration in all three `wrangler.jsonc` blocks
  and in `wrangler.e2e.jsonc`. DO ids come from the raw projectId, so no data moves.
- `@cf-sync/*` keeps its own `createWorkspaceDO` / `createWorkspace` / `workspaceId` API.
  Those imports stay behind the one CoRATES wrapper module, which already exists
  (`sync/admin.ts`), so the word stops leaking into app code. Renaming the engine API is not
  worth an engine release.
- Leave the persisted names as they are:
  - the `workspace` field in R2 backup envelopes, since the restore script reads 60 days of
    them;
  - the engine's `meta.workspace_id` column.
    Add a one-line comment at each instead.
- Side effects to accept:
  - The Grafana panel grouped by `cloudflare_entrypoint="WorkspaceDO"` splits its history at
    deploy.
  - The `/health` JSON key `bindings.WORKSPACE` changes.

**2. Slug-first URLs and old links.** Linear's shape, adapted:

```
/$workspace                                  workspace home (today's dashboard, scoped)
/$workspace/projects/$projectId[/studies/...] project, checklist, reconcile
/$workspace/settings/general|members|billing|plans
/settings/account/profile|security|preferences|integrations   (outside the slug, see 5)
```

- **Old links keep working permanently, at almost no cost.** A projectId is globally unique, so
  the slug in a project URL is cosmetic. The project route looks up the project's real
  workspace and replaces the URL whenever the slug is wrong. That one rule covers:
  - the old `/projects/$id` links, which a small redirect route sends to the project with a
    placeholder slug;
  - project-added emails already sent;
  - stored notification hrefs;
  - bookmarks;
  - slug renames.
- Old `/settings/profile|security|preferences|integrations` redirect to `/settings/account/...`.
  Old `/settings/billing|plans` redirect to the last-used workspace's settings.
- `/dashboard` stays as it is for signed-out visitors (local appraisals). Signed-in visitors
  are redirected to `/<last-used workspace>`.
- "Last used" is stored in localStorage. Without it, the user goes to the workspace they own,
  then to the first by name.
- `/admin`, `/checklist`, `/invite/$token`, auth routes and marketing pages stay outside the
  slug.
- Because static routes outrank `/$workspace`, a workspace slugged `pricing` would be
  unreachable. Slugs need a reserved list covering every top-level path segment, plus a test
  that fails when a new top-level route is added without updating the list.
- `robots.txt` cannot match the new paths by prefix. App pages are `ssr: false` with noindex
  already, so the fix is a `/*/projects/` wildcard line and a note in `guides/SEO.md`.
- What breaks:
  - the documented project-centric route contract (`architecture/diagrams/05-frontend-routes.md`,
    `guides/organizations.md`), which gets rewritten;
  - about 20 link builders, most of them already behind `getChecklistPath` and
    `getReconcilePath` in `ProjectContext.tsx`;
  - 13 e2e specs, most through `shared-steps.ts`.

**3. Can the slug change?** Yes, owner-only, in General settings, as in Linear. The warning can
be milder than Linear's: project links keep working (see 2), and only links to the workspace
home or settings stop working. Those stop working without a redirect, matching Linear.

**4. Where naming happens.** Add a "Your workspace" step to `/complete-profile`, after the
existing three steps: name and URL, prefilled, with "Skip for now". This is Linear's onboarding
"create your workspace" step.

- The auto-created workspace stays as the fallback. The hook keeps creating it on first
  session, so no path ever lacks one.
- Invited users skip the step. They are joining someone else's workspace, as in Linear, and can
  rename their own later in settings.
- Existing users are never prompted.

**5. Account settings inside the slug?** No, a deliberate break from Linear.

- Profile, security, preferences and Google Drive are stored per user. A slugged URL would
  suggest they belong to one workspace, and give one page a separate URL for every workspace.
- Account settings live at `/settings/account/...`. Workspace settings live at
  `/<slug>/settings/...`.
- One settings sidebar shows both groups. The Workspace links point at the last-used
  workspace, and that group is shown only to its owner.
- Integrations moves to the Account group. The code stores it per user, even though today's
  nav files it under Workspace.

**6. Docs vs code.** The code is right on both counts. Update the docs.

- Only the workspace owner creates projects in a workspace. Members never do. This is confirmed
  by Jacob, 2026-10-02.
  - Projects bill to the owner's plan, and `pricing-model.md` and `freeProjectCap.ts` already
    say so. `organizations.md:47,84` say otherwise.
  - A member who wants their own project switches to their own workspace first.
- Accepting a project invitation always grants workspace membership. The seat model counts
  workspace members, and the project access guard requires workspace membership, so "project
  member without workspace membership" cannot work.
  - Fix `organizations.md:12,14,37,203`, `database.md:168` and the schema comment at
    `schema.ts:362`.
  - The `grantOrgMembership` column becomes dead. Note it, don't drop it.
- `authentication.md:404-424` claims the invite email must match the accepting account. The
  code only logs a mismatch. Fix that doc line too.

## Not in scope (unchanged from the issue)

- Admin and member permissions at the workspace level.
- Workspace-level invitations.
- Changes to project membership or the sync engine.
- Also out:
  - deleting a workspace;
  - a "leave workspace" action for members;
  - transferring ownership;
  - cleaning up the memberless workspace that account merges leave behind. That is noted
    here, but it is a separate fix in `account-merge.server.ts`.

## Build order

Five PRs. Each one ships alone and leaves main deployable.

### PR 1: rename the sync side (no behaviour change)

Mechanical, about 100 files: see the rename table in decision 1, the v6 migration, regenerated
`worker-configuration.d.ts`, the Grafana panel and alert titles, and the docs.

Verify:

- typecheck, unit tests, workers tests;
- `wrangler deploy --dry-run` accepts the migration chain for both configs;
- after the staging deploy, an existing staging project opens with its data.

### PR 2: workspace backend

- **Slug rules** in `@corates/shared`: lowercase `a-z0-9` and single hyphens, 3 to 40
  characters, not on the reserved list. Also a `slugify(name)` that strips diacritics,
  collapses and trims hyphens, and falls back to `workspace` for names with no Latin letters.
  Unit tests.
- **Personal workspace bootstrap** uses `slugify`, and adds `-2`, `-3` on collision instead of
  the uuid suffix.
- **One-time slug cleanup in production**, reslugging all 70 from their names. Run as a
  reviewed SQL batch, the same way as the Patricia override. This is safe only before PR 3
  ships.
- **New server functions**, all taking `orgId` explicitly and guarded with
  `requireOrgMembership`:
  - `getMyWorkspaces`: id, name, slug, role, ordered with owned first. Replaces the unordered
    `authClient.organization.list()`.
  - `createWorkspace`: replaces Better Auth create, so slug rules apply.
  - `updateWorkspace`: owner only; name and slug.
  - `getWorkspaceMembers`: members, plus pending project invitations to people not yet in the
    workspace, plus seat usage from `resolveOrgAccess`. This is the same count
    `countCollaboratorSeats` and `acceptInvitation` enforce.
  - `removeWorkspaceMember`: owner only, not self. It runs the existing project `removeMember`
    command for each of the user's projects in the workspace (sessions kicked, user notified),
    then deletes the member row, in that order, so a failure leaves them still counted rather
    than half removed. It refuses if they are the last owner of a project, the existing
    `requireSafeRemoval` rule.
- **Billing server functions take `orgId`** instead of reading the session. This fixes billing
  pages showing the wrong workspace. `useSubscription(orgId)` and `useMembers(orgId)` key on
  it.
- **Block `/api/auth/organization/*`** in `routes/api/auth/$.ts`. After this PR nothing in the
  client calls it, and server code uses Drizzle or `auth.api` directly.
  - This is a breaking change for any client of those endpoints. Only `CreateOrgPage` and
    `useOrgs` call them today, and both are replaced here.
- **Docs**: the decision-6 fixes, and the new functions in `organizations.md`.

### PR 3: slug-first routing

- `_app/_protected/$workspace.tsx` layout resolves the slug from the `getMyWorkspaces` query.
  An unknown slug, or one the user is not a member of, gets a "workspace not found" page.
  It provides the current workspace to children, and the URL is the single source of truth.
- Move the project, checklist, reconcile, billing and plans routes under it. Move the
  account pages to `/settings/account/...`. Add the `/projects/$id`, old `/settings/*` and
  signed-in `/dashboard` redirects from decision 2.
- The project route corrects a wrong slug with a replace navigation.
- **Link builders take the workspace slug**: `ProjectContext` paths, sidebar and dashboard
  rows, `ProgressSection`, the reconcile and checklist back links, and notification renderers.
  Also:
  - the post-accept navigation goes to `/<orgSlug>/projects/<id>`, since `acceptInvitation`
    already returns `orgSlug`;
  - Stripe success and cancel URLs.
- **Workspace home and sidebar project list** are filtered to the current workspace. Pending
  invitations and local appraisals still show in every workspace.
- **The New project button** shows only when the user owns the current workspace, and creates
  the project there. A member never sees it. The server already rejects non-owners
  (`org-projects.server.ts:44`). This fixes the `orgs[0]` bug, and it fixes seat checks reading the wrong
  workspace.
- **e2e**: update `shared-steps.ts` URL extraction and the direct `goto`s. Add one spec that
  opens an old `/projects/<id>` link.
- **Docs**: rewrite the route contract in `05-frontend-routes.md` and `organizations.md`, and
  update the `SEO.md` and `robots.txt` lines.

### PR 4: switcher and workspace settings UI

- **`AccountMenu` becomes the switcher**, as in Linear:
  - the trigger shows the workspace name;
  - the menu lists workspaces;
  - "Create workspace" (the existing `CreateOrgPage` restyled, moved to a reserved top-level
    path, with "organization" copy removed);
  - the existing account items.
- **Settings sidebar**: an Account group, and a Workspace group (General, Members, Billing,
  Plans) for the owner only.
- **General**: name, URL with the decision-3 warning.
- **Members**:
  - the seat line "N of M people, including you", with an upgrade link when full;
  - the member list with role and Remove (confirm dialog naming the projects they lose access
    to);
  - pending invites with Cancel.
- Verify each page in the browser with agent-browser against `pnpm dev`, on a free workspace
  at the limit.

### PR 5: naming at signup

- The "Your workspace" step in `/complete-profile` (decision 4). It is skipped when a pending
  invitation token exists.
- Update `organizations.md`.

## Risks to watch

- The DO class rename is the one change that is irreversible in production. It deploys
  through the normal staging, e2e, then production pipeline, so staging rehearses it on real
  DOs first.
- PR 3 changes every in-app URL. Users with an open tab are fine: the next navigation inside
  the old bundle hits a redirect route, and a stale chunk reloads.
- The slug cleanup must land before PR 3 deploys, or it becomes a URL-breaking rename.
