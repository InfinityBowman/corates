# E2E UI Flow Tests: Dual-Reviewer Workflow

## Context

We need to verify the full dual-reviewer research appraisal workflow end-to-end in a real browser. These e2e tests render the full React app (TanStack Router + all providers) inside the Vitest Browser Mode test frame, interact via Playwright locators, and verify the complete happy path against the real backend.

## POC Results (validated)

- `vitest-browser-react` renders React components in Chromium via Vitest Browser Mode
- The full TanStack Router app mounts using `createMemoryHistory` for route control
- `page.getByText()`, `page.getByRole()`, etc. find and interact with rendered content
- Custom `commands` run in Node and can call the backend API at localhost:8787
- `optimizeDeps.include` prevents Vite reload issues with the large dependency tree

## Prerequisites

- `pnpm dev:workers` running at localhost:8787 (backend with DEV_MODE=true)
- Chromium installed for Playwright (already installed)
- No frontend dev server needed -- the app renders directly in the test frame

## Architecture

### How the test runs

The test uses `vitest-browser-react`'s `render()` to mount the full React app inside the browser test frame. TanStack Router uses `createMemoryHistory` to start at any route. The app's `fetch` calls go to the real backend at localhost:8787 for API and WebSocket (Yjs sync).

### How auth works

Dev-only seed endpoints on the backend (behind `DEV_MODE`) create users, orgs, and sessions. The test calls these via Vitest custom `commands` (which run in Node). Session cookies are injected via `document.cookie` before rendering the app. The `AuthProvider` picks up the session from the cookie and authenticates the user.

### How user switching works

1. `cleanup()` the rendered app (unmounts React)
2. Clear cookies, localStorage, IndexedDB
3. Inject new user's session cookie via `document.cookie`
4. `render()` the app again with `createMemoryHistory` at the desired route

### How navigation works

TanStack Router handles all navigation internally. The test clicks links/buttons that trigger `router.navigate()`. For programmatic navigation in helpers, we can call `router.navigate({ to: '/path' })` on the router instance.

## Implementation Steps

### Step 1: Clean up old files

Delete from `packages/web/src/primitives/useProject/__tests__/`:

- `helpers.ts`
- `domain-operations.browser.test.ts`
- `checklist-handlers.browser.test.ts`
- `yjs-sync.browser.test.ts`
- `__screenshots__/` directory

Delete `packages/web/src/__e2e__/commands.d.ts` (no longer needed).

Keep `packages/web/vitest.browser.config.ts` (for future data-layer tests).

### Step 2: Add `testUtils` plugin to Better Auth config

File: `packages/workers/src/auth/config.ts`

```ts
import { testUtils } from 'better-auth/plugins';

// In the plugins array, conditionally:
...(env.DEV_MODE ? [testUtils()] : []),
```

### Step 3: Add seed endpoints to workers

File: `packages/workers/src/routes/test-seed.ts` (new)

Dev-only endpoints gated behind `DEV_MODE`:

- `POST /api/test/seed` -- Creates users, org, org members. Uses Better Auth test utils (`ctx.test.saveUser`, `ctx.test.saveOrganization`, `ctx.test.addMember`).
- `POST /api/test/session` -- Creates a session for a user via `ctx.test.login({ userId })`. Returns the session token cookie value.
- `POST /api/test/cleanup` -- Deletes test data by IDs.

Mount at `/api/test/*` in the main Hono router, gated behind `DEV_MODE`.

### Step 4: E2E test config (already created, needs minor updates)

File: `packages/web/vitest.e2e.config.ts`

Already created during POC with:

- `viteReact()` plugin for JSX
- `playwright()` provider, headless Chromium
- Custom `commands` for seedTestData, getSessionCookie, cleanupTestData
- Full `optimizeDeps.include` list
- Include pattern: `src/__e2e__/**/*.browser.test.{ts,tsx}`
- 120s test timeout

### Step 5: Create test helpers

Directory: `packages/web/src/__e2e__/helpers/`

**`app.tsx`** -- Creates and renders the full app:

```tsx
function createTestApp(initialPath: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const memoryHistory = createMemoryHistory({ initialEntries: [initialPath] });
  const router = createRouter({ routeTree, history: memoryHistory });
  return { TestApp, router, queryClient };
}
```

**`seed.ts`** -- Wraps `commands` calls:

- `seedDualReviewerScenario()` -- seeds User A, User B, org, returns IDs and cookie values

**`auth.ts`** -- Browser-side cookie management:

- `injectSessionCookie(token)` -- sets `better-auth.session_token` cookie
- `clearBrowserState()` -- clears cookies, localStorage, IndexedDB

**`interactions.ts`** -- Reusable UI helpers:

- `createProject(page, name)`
- `addStudyManually(page, title, author, year)`
- `assignReviewers(page, reviewer1Name, reviewer2Name)`
- `fillAMSTAR2Checklist(page, answers)`
- `markChecklistComplete(page)`

### Step 6: Write the main test

File: `packages/web/src/__e2e__/dual-reviewer-flow.browser.test.tsx`

```
describe('Dual-Reviewer AMSTAR2 Workflow')

  beforeAll:
    - Seed User A, User B, org via commands
    - Get session cookies for both

  test('User A creates a project')
    - Inject User A cookie, render app at /dashboard
    - Click Create Project, fill name, submit
    - Assert: project name visible
    - Capture projectId from router state

  test('User A adds a study')
    - Navigate to All Studies tab
    - Add study manually
    - Assert: study appears in list

  test('User A assigns reviewers')
    - Open assign reviewers modal
    - Select User A as R1, User B as R2
    - Assert: reviewer names shown

  test('User A fills AMSTAR2 checklist')
    - Navigate to Todo tab
    - Create checklist, open it
    - Answer all 16 questions
    - Mark complete

  test('Switch to User B')
    - cleanup(), clearBrowserState()
    - Inject User B cookie
    - render() app at /dashboard
    - Assert: project visible

  test('User B fills their checklist')
    - Navigate to project, Todo tab
    - Create checklist, fill with different answers
    - Mark complete

  test('Reconciliation')
    - Navigate to Reconcile tab
    - Start reconciliation
    - Select reconciled answers
    - Finalize

  test('Verify completed')
    - Navigate to Completed tab
    - Assert: finalized checklist visible

  afterAll:
    - cleanupTestData
```

### Step 7: Add data-testid attributes as needed

Discover during implementation. Likely candidates:

- Tab triggers in ProjectView
- Mark Complete / Finalize buttons
- AMSTAR2 answer radio buttons
- Study cards

## Files to Create/Modify

| File                                                           | Action                                   |
| -------------------------------------------------------------- | ---------------------------------------- |
| `packages/workers/src/auth/config.ts`                          | Add testUtils plugin (conditional)       |
| `packages/workers/src/routes/test-seed.ts`                     | Create -- seed/session/cleanup endpoints |
| `packages/workers/src/index.ts` (or router)                    | Mount test-seed routes                   |
| `packages/web/vitest.e2e.config.ts`                            | Already created -- minor updates         |
| `packages/web/src/__e2e__/helpers/app.tsx`                     | Create                                   |
| `packages/web/src/__e2e__/helpers/seed.ts`                     | Create                                   |
| `packages/web/src/__e2e__/helpers/auth.ts`                     | Create                                   |
| `packages/web/src/__e2e__/helpers/interactions.ts`             | Create                                   |
| `packages/web/src/__e2e__/dual-reviewer-flow.browser.test.tsx` | Create                                   |
| Various components                                             | Add data-testid as needed                |

## Key Source Files (reference)

- `packages/workers/src/routes/orgs/dev-routes.ts` -- existing DEV_MODE route pattern
- `packages/workers/src/__tests__/helpers.ts` -- seed functions
- `packages/web/src/routes/__root.tsx` -- RootLayout (QueryClientProvider + AuthProvider + Outlet)
- `packages/web/src/routeTree.gen.ts` -- generated route tree
- `packages/web/src/routes/_auth/signin.tsx` -- #email-input, password form
- `packages/web/src/stores/authStore.ts` -- auth state, cached user
- `packages/web/src/components/project/CreateProjectModal.tsx` -- #project-name input
- `packages/web/src/components/project/all-studies-tab/AllStudiesTab.tsx`
- `packages/web/src/components/project/all-studies-tab/AssignReviewersModal.tsx`
- `packages/web/src/components/project/todo-tab/ToDoTab.tsx`
- `packages/web/src/components/project/reconcile-tab/ReconcileTab.tsx`
- `packages/web/src/components/project/reconcile-tab/ReconciliationWrapper.tsx`
- `packages/web/src/config/api.ts` -- API_BASE, getWsBaseUrl

## Bug Found During Data-Layer Testing

ROBINS-I auto-fill of sectionA.outcome Y.Text fails silently because the auto-fill runs on a detached Y.Map (answersYMap not yet added to the Y.Doc). Fix: move `checklistsMap.set(checklistId, checklistYMap)` before the auto-fill block in `packages/web/src/primitives/useProject/checklists/index.js` (line 193 should come before line 172).

## Verification

```bash
# Start backend
pnpm dev:workers

# Run e2e tests (no frontend dev server needed)
pnpm --filter web test:e2e
```
