# Project setup wizard, second attempt

Status: plan, not started. Supersedes draft PR #579 (`feat/project-setup-wizard`), which is
abandoned. That branch is 47 commits behind main, conflicts in nine files, and bundled
schema, invitation and project-creation changes into one PR. It stays on the remote as a
reference only. Nothing is cherry-picked from it.

## Decisions

Fixed by the owner before this plan was written.

- Setup is a full-page route at `/projects/$projectId/setup`, owner-only, replacing the
  project view until finished or dismissed.
- The first shippable version has one step: add studies. Team invites and reviewer
  assignment come as later, separate PRs.
- Invitations, when they arrive, send immediately through the existing invite flow. There is
  no draft state and no send-on-finish. An invitee accepting while the owner is still in the
  wizard must just work.
- No step is ever forced, hidden or locked. Every step is always visible and the owner can
  jump to any of them in any order. A step that has nothing to do yet (assignment with no
  other members) shows an explanatory empty state, not a wall. Nothing is required to
  continue or to finish.
- There is no auto-assign of the owner as sole reviewer and no single-reviewer mode decided
  during setup.

## What the old branch got wrong

Listed so the second attempt does not repeat it.

- `setupSkipInvites` on the project row. An onboarding-only choice was stored as a project
  attribute, made at creation time in the modal, and the PR itself warned that nothing
  outside the wizard should read it. Dropped entirely.
- Owner auto-assigned as sole reviewer in step 3. A review-workflow decision hidden inside
  onboarding. Dropped.
- Steps that gated each other: "Continue" disabled until studies existed, step 2 hidden by
  a flag, step 3 only reachable in order. Setup should be a set of surfaces the owner moves
  between freely, with `setupStep` remembering where they were, not a funnel.
- Draft invitations with `sendEmail: false` plus a send-all on finish. Added a server
  function, a worker flag and a failure mode (completed but unsent) to avoid a problem that
  does not exist if invites send immediately. Dropped.
- The create-project modal lost its description field and gained an invite choice. The
  modal should only change in one way: navigate to `/setup` instead of the project.
- Three columns (`setupStatus`, `setupStep`, `setupSkipInvites`) where one nullable column
  carries the state.

## What is worth borrowing

Read for inspiration, then rewrite against main.

- The route-split pattern: `projects.$projectId.tsx` renders `Outlet` when the setup child
  route matches, and `AppLayout` hides the sidebar for the setup route with `useMatch`.
- `ProjectGate` wrapping the setup view so the sync workspace is connected before steps
  render, and the owner/non-in-progress guard that bounces everyone else to the project.
- Reusing `AddStudiesForm` with `alwaysExpanded` and `bare`, and the OAuth-redirect restore
  path via `formStatePersistence`, exactly as `AddStudiesSheet` does today.
- The e2e `createProject` helper leaving the wizard via a "Finish later" button.

## Data model

One column on `projects`:

```
setupStep: text('setupStep')   // null when setup is finished or dismissed
```

`createProject` sets it to `'studies'`. Finishing or dismissing sets it to null. Later PRs
add `'team'` and `'assign'` to the allowed values in `@corates/shared`. Existing projects
default to null and never see the wizard.

`setupStep` records where the owner last was so a reload or the resume banner lands them
there. It is never a gate: any step can be opened from any other.

This deliberately does not distinguish completed from dismissed. Nothing in the first
version needs the distinction, and a reopen affordance can be added later without it. If a
later PR needs it, add a second column then.

The value reaches the client through `getMyProjects` in `users.server.ts`, which already
feeds `useProjectMeta` in `workspace-data.ts`. Add `setupStep` and `role` to that projection.

## PR sequence

Each PR is independently mergeable and leaves main in a shippable state.

### PR 1: Setup route and the studies step

The whole first shippable version.

- Migration 0009 adding `projects.setupStep`. Generated with `drizzle-kit generate`, plus
  the test SQL via `db:generate:test`.
- `PROJECT_SETUP_STEPS = ['studies']` and the `ProjectSetupStep` type in
  `packages/shared/src/project-setup.ts`.
- `createProject` worker command sets `setupStep: 'studies'`. No new params.
- `getMyProjects` returns `setupStep` and `role`. `useProjectMeta` exposes both.
- `updateProjectSetup` server function, owner-only, accepting `setupStep: string | null`.
- Route `projects.$projectId.setup.tsx`. Parent route renders `Outlet` when it matches.
  `AppLayout` hides the sidebar on it.
- `ProjectSetupView`: `ProjectGate`, then guard (not owner or `setupStep === null` means
  navigate to the project), then the studies step. Header with project name, a step
  label that is a single item for now, and two exits: "Continue to project" (sets
  `setupStep` null, navigates) and "Finish later" (navigates without changing state, so
  the banner in PR 2 can resume it). Both are always enabled; an empty project can finish.
- Studies step hosts `AddStudiesForm` the way `AddStudiesSheet` does, with the OAuth
  restore path. Below the form, a list of studies added so far from `useAllStudies`.
- `CreateProjectModal` navigates to `/projects/$projectId/setup`. Nothing else changes.
- e2e `createProject` helper clicks "Finish later" and asserts it landed on the project.

Verify: typecheck, lint, web unit tests, server tests for `updateProjectSetup` owner guard,
e2e project workflow spec passes. Manual: create project, add a PDF, continue, project shows
the study. Reload mid-setup resumes. Non-owner opening `/setup` lands on the project.

Note the overlap with the existing empty state: `AllStudiesTab` already renders an inline
`AddStudiesForm` when a project has no studies. After PR 1 a brand-new project shows the
add-studies form twice in a row if the owner clicks "Finish later" without adding anything.
That is acceptable for the first version. Whether the inline empty state stays once the
wizard exists is a decision for after PR 1 ships.

### PR 2: Resume banner

- Overview tab banner when `setupStep !== null` and the viewer is the owner: "Finish
  setting up this project" linking to `/setup`, and a "Dismiss" action that sets
  `setupStep` null.

Verify: banner appears after "Finish later", disappears after dismiss or finish.

### PR 3: Team step

- Add `'team'` to `PROJECT_SETUP_STEPS`. The step label becomes a rail where every step
  is a link; clicking one writes `setupStep` and shows it. Back/next are conveniences on
  top of that, never the only way through.
- The step hosts the existing invite UI from the project header (`ProjectHeaderActions`
  invite sheet contents), sending immediately via `createInvitation`. A list of pending
  invitations and joined members from `getInvitations` and `useProjectMembers`.
- Immediate acceptance: the invitee lands on `/dashboard` from `invite.$token.tsx` and
  then opens the project. The project route guard sends non-owners to the project view,
  so they never see the wizard. The owner's member list updates through the sync
  workspace. No new handling expected. Confirm this in e2e with two users.

Verify: e2e with user A in the wizard, user B accepting, A's list shows B without reload.

### PR 4: Assign step

- Add `'assign'` to `PROJECT_SETUP_STEPS`. Always present in the rail. With only the
  owner as a member it shows an empty state explaining that assignment needs a second
  reviewer, with a link back to the team step. With two or more members it hosts the
  existing bulk `ReviewerAssignment` inline.

Verify: solo owner can open the step and read the empty state. Two members see the
assignment UI and assignments persist.

### Later, undecided

- Completion screen with counts.
- Reopen setup from the project actions menu after it is finished.
- Per-study checklist choice during setup.
- Removing the inline empty-state form from `AllStudiesTab` once the wizard covers it.

## Out of scope for every PR above

- Any project-level flag that survives setup other than `setupStep`.
- Single-reviewer mode, claim-from-pool, reviewers-per-study.
- Assigning studies to invitees who have not accepted.
- Changing what the create-project modal collects.
