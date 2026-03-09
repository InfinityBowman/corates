# Web Package Migration: SolidJS to React (Unified Package)

## Strategy: Build into landing2, one package for everything

landing2 already has React 19, TanStack Start, TanStack Router (file-based), Tailwind v4, and Cloudflare Workers. Instead of creating a separate web2 package, migrate the SolidJS web app directly into landing2. One router handles landing pages AND the app.

Benefits:

- No separate build/deploy for landing vs app
- Shared layout primitives, auth, and navigation
- SSR for landing pages (SEO), client-side for app routes
- TanStack Start handles the Cloudflare Workers integration
- Already working -- just keep adding routes

The SolidJS `packages/web` stays untouched as reference until migration is complete, then gets deleted.

---

## Scope (what's being migrated from packages/web)

| Metric                                        | Count                                                                                     |
| --------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Source files (.ts/.tsx/.js/.jsx)              | 445                                                                                       |
| Lines of code                                 | ~89,000                                                                                   |
| Component files                               | 274                                                                                       |
| UI library components (Ark UI wrappers)       | 25 files, ~3,800 LOC                                                                      |
| Stores                                        | 5 (projectStore, adminStore, localChecklistsStore, pdfPreviewStore, projectActionsStore/) |
| Primitives (hooks)                            | 24 files                                                                                  |
| useProject (Yjs integration)                  | 14 files, ~3,770 LOC                                                                      |
| projectActionsStore (Yjs actions)             | 8 files, ~1,494 LOC                                                                       |
| Lib utilities                                 | 25 files (only 1 uses SolidJS primitives)                                                 |
| Test files                                    | 27                                                                                        |
| Files using `splitProps`                      | 21                                                                                        |
| Files importing `solid-js`                    | 275                                                                                       |
| Files importing `@solidjs/router`             | 62                                                                                        |
| Files using `@ark-ui/solid`                   | 19                                                                                        |
| Files using `solid-icons`                     | 7                                                                                         |
| Files using `createRoot` (reactive ownership) | 6                                                                                         |

**~30% of codebase is framework-agnostic** (lib/, constants/, config/, checklist-registry, Dexie setup) and can be copied with zero or trivial changes.

---

## Architecture Decisions

### State Management: Zustand (with immer middleware)

- projectStore already uses `produce` (immer-style mutations) -- Zustand + immer is a direct fit
- Singleton module pattern maps cleanly to Zustand's `create()` outside components
- adminStore is 90% API wrappers -- those become TanStack Query mutations, leaving only 4 signals for a tiny Zustand slice

### Routing: TanStack Router (file-based, already in landing2)

Already set up. App routes become new files under `src/routes/`.

### UI Components: Ark UI for React

`@ark-ui/solid` -> `@ark-ui/react` -- nearly identical API, mechanical swap.

### Library Swaps

| SolidJS                 | React                    | API similarity                |
| ----------------------- | ------------------------ | ----------------------------- |
| `@tanstack/solid-query` | `@tanstack/react-query`  | Near-identical                |
| `@tanstack/solid-table` | `@tanstack/react-table`  | Near-identical                |
| `@ark-ui/solid`         | `@ark-ui/react`          | Near-identical                |
| `solid-icons`           | `react-icons`            | Same icons, different imports |
| `solid-chartjs`         | `react-chartjs-2`        | Same Chart.js underneath      |
| `@sentry/solid`         | `@sentry/react`          | Direct swap                   |
| `@solidjs/router`       | `@tanstack/react-router` | Already in landing2           |

---

## Route Structure

```
landing2/src/routes/
  __root.tsx                   # HTML shell, global meta (existing)
  index.tsx                    # Landing home (existing)
  about.tsx                    # Landing (existing)
  pricing.tsx                  # Landing (existing)
  contact.tsx                  # Landing (existing)
  privacy.tsx                  # Landing (existing)
  terms.tsx                    # Landing (existing)
  security.tsx                 # Landing (existing)
  resources/                   # Landing (existing)

  _auth.tsx                    # Auth layout (no sidebar, guest guard)
  _auth/
    signin.tsx
    signup.tsx
    check-email.tsx
    complete-profile.tsx
    reset-password.tsx

  _app.tsx                     # App layout (navbar + sidebar + QueryProvider + auth guard)
  _app/
    dashboard.tsx              # Also handles / for logged-in users
    checklist.tsx              # Local checklist (no project)
    checklist.$checklistId.tsx
    orgs.new.tsx
    settings.tsx               # Settings layout
    settings/
      index.tsx
      profile.tsx
      integrations.tsx
      billing.tsx
      plans.tsx
      security.tsx
      notifications.tsx
    projects.$projectId.tsx    # Project layout (Yjs connection)
    projects.$projectId/
      index.tsx                # Project overview/tabs
      studies.$studyId.checklists.$checklistId.tsx
      studies.$studyId.reconcile.$checklist1Id.$checklist2Id.tsx
    admin.tsx                  # Admin layout (lazy)
    admin/
      index.tsx
      users.tsx
      users.$userId.tsx
      orgs.tsx
      orgs.$orgId.tsx
      projects.tsx
      projects.$projectId.tsx
      storage.tsx
      billing.tsx
```

Key points:

- `_auth.tsx` is a pathless layout route -- auth pages render without sidebar/navbar
- `_app.tsx` is a pathless layout route -- wraps all app routes with sidebar, navbar, QueryClientProvider, auth guard
- Landing pages stay at the top level -- no layout wrapper, SSR-friendly, minimal JS
- `projects.$projectId.tsx` is a layout route that establishes the Yjs WebSocket connection, child routes share it
- Admin routes under `_app/admin.tsx` can use `lazy()` for code splitting

### How \_app.tsx layout works

```tsx
// routes/_app.tsx
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '~/lib/queryClient';
import { AppLayout } from '~/components/layout/AppLayout';
import { AuthGuard } from '~/components/auth/AuthGuard';

export const Route = createFileRoute('/_app')({
  component: AppLayoutWrapper,
});

function AppLayoutWrapper() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGuard>
        <AppLayout>
          <Outlet />
        </AppLayout>
      </AuthGuard>
    </QueryClientProvider>
  );
}
```

### Landing vs App: SSR boundary

TanStack Start gives you SSR by default. For app routes, you likely want client-only rendering (they need auth, IndexedDB, WebSocket, etc.). Use `ssr: false` on the `_app` layout:

```tsx
export const Route = createFileRoute('/_app')({
  // Disable SSR for all app routes -- they require browser APIs
  ssr: false,
  component: AppLayoutWrapper,
});
```

Landing pages keep SSR for SEO. This gives you the best of both worlds in one router.

---

## Phase 0: Preparation

### 0.1 Add dependencies to landing2

```bash
pnpm --filter @corates/landing2 add \
  zustand immer \
  @tanstack/react-query \
  @tanstack/react-table \
  @ark-ui/react \
  better-auth \
  chart.js react-chartjs-2 \
  @sentry/react \
  class-variance-authority clsx tailwind-merge \
  dexie \
  yjs y-websocket y-dexie \
  d3 \
  countup.js
```

Plus EmbedPDF packages (the full list from web/package.json). And Preact for the PDF viewer island.

### 0.2 Set up path aliases

Add aliases to landing2's tsconfig.json matching web's jsconfig.json:

```json
{
  "compilerOptions": {
    "paths": {
      "~/*": ["./src/*"],
      "~/components/*": ["./src/components/*"],
      "~/stores/*": ["./src/stores/*"],
      "~/primitives/*": ["./src/primitives/*"],
      "~/lib/*": ["./src/lib/*"],
      "~/api/*": ["./src/api/*"],
      "~/config/*": ["./src/config/*"]
    }
  }
}
```

### 0.3 Copy framework-agnostic code into landing2

Create these directories in landing2/src and copy from web/src:

```
landing2/src/
  lib/           <- copy all from web/src/lib/ (24 of 25 files are framework-agnostic)
  constants/     <- copy from web/src/constants/
  config/        <- copy from web/src/config/ (update sentry to @sentry/react)
  checklist-registry/  <- copy from web/src/checklist-registry/
  styles/        <- copy from web/src/styles/
```

Also copy framework-agnostic primitives:

- `primitives/db.js` (Dexie setup)
- `primitives/avatarCache.js`
- `primitives/pdfCache.js`

Verify they compile -- no `solid-js` imports should remain.

### 0.4 Set up vitest

Add vitest + @testing-library/react to landing2 devDependencies. Copy test setup from web, adapting for React.

**Checkpoint: landing2 still builds and runs, new lib/config/constants files import cleanly, no solid-js in copied code.**

---

## Phase 1: Foundation (stores + auth)

Everything else depends on this layer. Build it first, test it standalone.

### 1.1 Migrate stores to Zustand

Create `landing2/src/stores/`:

**projectStore.ts** (most critical):

```ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface ProjectStoreState {
  projects: Record<string, ProjectData>;
  activeProjectId: string | null;
  connections: Record<string, ConnectionState>;
  projectStats: Record<string, ProjectStats>;
  // ... actions
}

export const useProjectStore = create<ProjectStoreState>()(
  immer((set, get) => ({
    projects: {},
    activeProjectId: null,
    connections: {},
    projectStats: loadPersistedStats(),

    setProjectData: (projectId, data) =>
      set(state => {
        if (!state.projects[projectId]) {
          state.projects[projectId] = { meta: {}, members: [], studies: [] };
        }
        if (data.meta !== undefined) state.projects[projectId].meta = data.meta;
        if (data.members !== undefined) state.projects[projectId].members = data.members;
        if (data.studies !== undefined) {
          state.projects[projectId].studies = data.studies;
          state.projectStats[projectId] = {
            ...computeProjectStats(data.studies),
            lastUpdated: Date.now(),
          };
          persistStats(state.projectStats);
        }
      }),

    // ... rest of actions, same logic, same produce-style mutations
  })),
);

// For non-React code (Yjs callbacks, etc.) that needs to read/write store
// without hooks -- use getState()/setState() directly
export const projectStoreApi = useProjectStore;
```

**pdfPreviewStore.ts**, **localChecklistsStore.ts** -- straightforward, same pattern.

**adminStore.ts** -- split into:

- `stores/adminStore.ts`: tiny Zustand store for `isAdmin`, `isAdminChecked`, `isImpersonating`, `impersonatedBy`
- Admin API functions stay as plain async functions (or become TanStack Query mutations later)

**projectActionsStore/** (1,494 LOC):

- These are Yjs mutation functions that call `ydoc.getMap().set()` etc.
- They currently import `projectStore` -- update imports to use `useProjectStore.getState()`
- Otherwise nearly framework-agnostic, mostly just store reference updates

### 1.2 Migrate auth

Create `landing2/src/api/`:

**auth-client.ts** -- Better Auth client setup. The existing `auth-client.js` creates the client instance -- this is framework-agnostic, just copy and adjust if needed.

**better-auth-store.ts** -- this is the big one (935 LOC). Split into:

1. **Zustand store for auth state:**

```ts
export const useAuthStore = create<AuthState>()((set, get) => ({
  isOnline: navigator.onLine,
  cachedUser: loadCachedAuth(),
  cachedAvatarUrl: null,
  authError: null,
  // ... auth action methods (signin, signup, signout, etc.)
}));
```

2. **AuthProvider component** (replaces `createRoot` + `createEffect`):

```tsx
// components/auth/AuthProvider.tsx
export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Better Auth's React useSession() hook
  const session = useSession();

  // Sync session -> Zustand store + localStorage cache
  useEffect(() => {
    if (session.data?.user) {
      useAuthStore.getState().setCachedUser(session.data.user);
      saveCachedAuth(session.data.user);
    }
  }, [session.data]);

  // Online/offline listeners
  useEffect(() => {
    const onOnline = () => useAuthStore.setState({ isOnline: true });
    const onOffline = () => useAuthStore.setState({ isOnline: false });
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // BroadcastChannel, visibility change listeners -- same vanilla JS logic

  return <>{children}</>;
}
```

3. Mount `<AuthProvider>` inside `_app.tsx` layout route.

BroadcastChannel, visibility change listeners, cross-tab sync -- these are vanilla JS and transfer directly. The auth API methods (signin, signup, etc.) are async functions calling `authClient` -- framework-agnostic, just update state setters to use Zustand.

### 1.3 Set up app layout route

Create `routes/_app.tsx`:

- QueryClientProvider
- AuthProvider
- AuthGuard (redirect to /signin if not logged in)
- AppLayout (navbar + sidebar + Outlet)

Create `routes/_auth.tsx`:

- Minimal layout for auth pages (no sidebar)
- Guest guard (redirect to /dashboard if already logged in)

Create placeholder routes:

- `_app/dashboard.tsx` -- renders "Dashboard placeholder"
- `_auth/signin.tsx` -- renders "Sign in placeholder"
- etc.

**Checkpoint: landing pages still work, navigating to /dashboard shows app layout with placeholder, auth flow works (login redirects, session persists).**

---

## Phase 2: UI Component Library

Create `landing2/src/components/ui/`:

### 2.1 Migrate Ark UI wrappers (25 files, ~3,800 LOC)

Conversion pattern for each file:

```tsx
// Before (SolidJS)
import type { Component, ComponentProps } from 'solid-js'
import { splitProps } from 'solid-js'
import { Dialog as ArkDialog } from '@ark-ui/solid'

const Button: Component<ButtonProps> = (props) => {
  const [local, others] = splitProps(props, ['variant', 'size', 'class'])
  return <button class={cn(...)} {...others} />
}

// After (React)
import { Dialog as ArkDialog } from '@ark-ui/react'

function Button({ variant, size, className, ...rest }: ButtonProps) {
  return <button className={cn(...)} {...rest} />
}
```

Changes per file:

- `splitProps(props, [...])` -> destructure `const { a, b, ...rest } = props`
- `class=` -> `className=`
- `<Show when={x}>` -> `{x && ...}`
- `<For each={items}>{(item) => ...}</For>` -> `{items.map(item => ...)}` with `key` prop
- `Component<Props>` -> function component with typed props
- `props.children` -> destructured `children`
- `@ark-ui/solid` -> `@ark-ui/react`

**Order (most-used first):** button, spinner, toast, dialog, alert-dialog, select, tabs, menu, tooltip, popover, checkbox, switch, editable, collapsible, file-upload, steps, pin-input, password-input, progress, qr-code, avatar, flip-number

### 2.2 Icon migration

7 files: `solid-icons/bi` -> `react-icons/bi`, `solid-icons/fi` -> `react-icons/fi`, etc. Same icon names.

**Checkpoint: all UI components render, can be imported from routes.**

---

## Phase 3: Primitives (Hooks)

Create `landing2/src/primitives/` (or `landing2/src/hooks/`):

### 3.1 TanStack Query hooks (near-1:1 swap)

These are the easiest -- `createQuery` -> `useQuery`, `createMutation` -> `useMutation`:

- useAdminQueries
- useMyProjectsList
- useProjectList
- useOrgs
- useMembers
- useSubscription
- useNotifications
- useLinkedAccounts

### 3.2 Signal-based hooks -> React hooks

- `useDebouncedSignal` -> `useDebouncedValue` (useState + useEffect with timeout)
- `useOnlineStatus` -> `useSyncExternalStore` or useState + event listeners
- `useOAuthError` -> useState + useEffect reading URL params
- `useOrgContext` -> Zustand selector or React context
- `useOrgProjectContext` -> same
- `useMembershipSync` -> useEffect with WebSocket/polling
- `useReconciliationPresence` -> useEffect with presence tracking
- `useProjectData` -> useEffect + Zustand selectors
- `useProjectOrgId` -> derived from route params + store

### 3.3 Yjs integration (3,770 LOC -- highest complexity)

`useProject/` manages WebSocket connection, Yjs doc observation, and store updates.

**Key insight:** most of the Yjs code is vanilla JS callbacks. The SolidJS parts are:

- `createSignal` for connection state -> Zustand actions on projectStore
- `createRoot` wrapping -> not needed in React
- `onCleanup` -> useEffect cleanup return

Migration approach:

1. Copy the handler files (AMSTAR2, ROB2, ROBINS-I scoring) -- they're pure logic, framework-agnostic
2. Copy sync.js, studies.js, pdfs.js, etc. -- update `projectStore.setProjectData()` calls to `useProjectStore.getState().setProjectData()`
3. Convert `connection.js` -- createSignal for connection state -> Zustand actions
4. Convert `index.js` -- the main `useProject()` hook. In React:

```tsx
function useProject(projectId: string) {
  const ydocRef = useRef<Y.Doc | null>(null);

  useEffect(() => {
    if (!projectId) return;
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // Set up WebSocket provider, observers, etc.
    // All the existing vanilla JS callback logic
    const cleanup = setupProjectSync(ydoc, projectId);

    return () => {
      cleanup();
      ydoc.destroy();
    };
  }, [projectId]);

  return ydocRef;
}
```

5. Mount in `routes/_app/projects.$projectId.tsx` layout route -- child routes get the live Yjs connection

**This is the riskiest phase.** Test with two browser tabs editing the same checklist.

**Checkpoint: can open a project, see studies load from Yjs, edit a checklist, see real-time sync between tabs.**

---

## Phase 4: Pages (migrate route by route)

Start simple, build confidence, tackle complex last. Each route becomes a file in `landing2/src/routes/`.

### 4.1 Auth pages (simplest)

- `_auth/signin.tsx`, `signup.tsx`, `check-email.tsx`, `complete-profile.tsx`, `reset-password.tsx`
- Form state, auth store calls, simple UI
- Replace each placeholder from Phase 1

### 4.2 App shell (needed for everything else)

- `components/layout/AppLayout.tsx` -- navbar + sidebar + main content area
- `components/layout/Navbar.tsx`
- `components/layout/Sidebar.tsx`
- These use route location, auth state, project list -- all available from previous phases

### 4.3 Dashboard

- `_app/dashboard.tsx` -- project list, stats cards
- Uses useMyProjectsList, projectStore.getProjectStats()
- Read-only views, straightforward

### 4.4 Settings

- `_app/settings.tsx` (layout) + `_app/settings/*.tsx` (pages)
- Profile, billing, integrations, security, notifications
- Self-contained form pages

### 4.5 Organization + billing

- `_app/orgs.new.tsx`
- Billing components

### 4.6 Project view (complex)

- `_app/projects.$projectId.tsx` (layout -- Yjs connection)
- `_app/projects.$projectId/index.tsx` (overview, tab system)
- Study cards, add-studies flow, all-studies tab, completed tab, todo tab
- Heavy Yjs data consumption from projectStore via Zustand selectors

### 4.7 Checklists (most complex UI)

- `_app/projects.$projectId/studies.$studyId.checklists.$checklistId.tsx`
- AMSTAR2, ROB2, ROBINS-I checklist forms
- Complex conditional fields, scoring visualization, decision diagrams
- PDF viewer integration

### 4.8 Reconciliation (complex)

- `_app/projects.$projectId/studies.$studyId.reconcile.$c1Id.$c2Id.tsx`
- Multi-reviewer comparison, conflict resolution

### 4.9 Local checklists

- `_app/checklist.tsx`, `_app/checklist.$checklistId.tsx`
- Uses localChecklistsStore (Zustand) + Dexie

### 4.10 Admin (last, isolated)

- `_app/admin.tsx` (layout, lazy loaded) + `_app/admin/*.tsx`
- Charts: `solid-chartjs` -> `react-chartjs-2`
- Admin queries already migrated in Phase 3

### 4.11 PDF components

- The EmbedPDF Preact viewer is isolated -- keep as-is
- Create a React wrapper that mounts the Preact island (same pattern as current SolidJS wrapper)
- PDF preview panel uses pdfPreviewStore (Zustand)

---

## Phase 5: Tests

### 5.1 Set up test infrastructure

- `@testing-library/react` (replaces `@solidjs/testing-library`)
- Same `render()`, `screen`, `fireEvent`, `waitFor` patterns
- Test setup file with Zustand store resets between tests

### 5.2 Migrate test files (27 files)

- Import swaps, provider wrappers
- Framework-agnostic tests (lib/, checklist-registry/) may need no changes
- Component tests need React render wrappers

---

## Phase 6: Cleanup and Cutover

### 6.1 Remove packages/web

- Verify all functionality works in landing2
- Delete packages/web from workspace
- Update pnpm-workspace.yaml

### 6.2 Rename landing2 -> the main package

- Or keep the name, doesn't matter functionally

### 6.3 Update build/deploy

- Single `pnpm --filter @corates/landing2 build` builds everything
- Single Cloudflare Workers deploy
- No more `copy-to-landing.js` script
- No more separate web build step

### 6.4 Update documentation

- CLAUDE.md, AGENTS.md, STATUS.md
- Remove references to packages/web
- Update build commands

---

## Conversion Patterns Cheat Sheet

| SolidJS                                   | React                                               |
| ----------------------------------------- | --------------------------------------------------- |
| `createSignal(x)`                         | `useState(x)`                                       |
| `createEffect(() => { ... })`             | `useEffect(() => { ... }, [deps])` -- must add deps |
| `createMemo(() => expr)`                  | `useMemo(() => expr, [deps])` -- must add deps      |
| `onMount(() => { ... })`                  | `useEffect(() => { ... }, [])`                      |
| `onCleanup(() => { ... })`                | return cleanup from `useEffect`                     |
| `<Show when={x}>`                         | `{x && ...}` or `{x ? a : b}`                       |
| `<For each={items}>{(item) => ...}</For>` | `{items.map(item => ...)}` + `key` prop             |
| `<Switch><Match when={a}>`                | Ternary chain or if/else                            |
| `<Index each={items}>`                    | `{items.map((item, i) => ...)}`                     |
| `<Dynamic component={C}>`                 | `<C {...props} />`                                  |
| `<Portal>`                                | `createPortal(children, document.body)`             |
| `splitProps(props, ['a', 'b'])`           | `const { a, b, ...rest } = props`                   |
| `props.field` (no destructure)            | Destructure freely                                  |
| `class=`                                  | `className=`                                        |
| `classList={{ active: x() }}`             | `className={clsx({ active: x })}`                   |
| `ref={el => ...}`                         | `useRef()` or callback ref                          |
| `createRoot(() => { ... })`               | Not needed                                          |
| `signal()` (call to read)                 | Just `value` (variable reference)                   |

**Critical: dependency arrays.** SolidJS auto-tracks deps. React requires explicit `[deps]` in useEffect/useMemo/useCallback. Use `eslint-plugin-react-hooks` with `exhaustive-deps` rule from day one.

---

## Risk Assessment

### High Risk

- **Yjs integration** (useProject/, projectActionsStore/) -- real-time collaboration, subtle timing bugs
- **Auth store** (better-auth-store.js) -- offline caching, cross-tab sync, many edge cases
- **Dependency arrays** -- #1 source of bugs in Solid-to-React migrations

### Medium Risk

- **Store migration** -- projectStore nested proxy updates via produce
- **Router** -- 62 files, auth guards, lazy loading, nested routes
- **Reconciliation UI** -- complex derived state from Yjs

### Low Risk

- **UI components** -- mechanical Ark UI swap
- **TanStack Query hooks** -- near-identical API
- **Lib utilities** -- almost all framework-agnostic
- **Landing pages** -- already done, untouched
- **Tests** -- mechanical conversion

---

## Estimated Effort

| Phase                | Effort         | Can parallelize?               |
| -------------------- | -------------- | ------------------------------ |
| Phase 0: Preparation | 0.5 days       | --                             |
| Phase 1: Foundation  | 3-4 days       | --                             |
| Phase 2: UI Library  | 2 days         | Yes (with Phase 3)             |
| Phase 3: Primitives  | 3-4 days       | Yes (with Phase 2)             |
| Phase 4: Pages       | 5-7 days       | Partially (independent routes) |
| Phase 5: Tests       | 2 days         | Yes (with Phase 4)             |
| Phase 6: Cleanup     | 0.5 days       | --                             |
| **Total**            | **~2-3 weeks** |                                |

Phase 0 is shorter since landing2 already exists. Claude Code can handle the mechanical parts (UI components, query hooks, icon swaps, simple page conversions) to significantly speed up Phases 2 and 4.

---

## What NOT to do

1. **Don't change business logic during migration** -- port first, refactor later
2. **Don't skip the dependency array audit** -- use eslint exhaustive-deps from the start
3. **Don't migrate the Preact PDF viewer** -- it's already isolated, just wrap it
4. **Don't try to make components work in both SolidJS and React** -- clean port, no bridges
5. **Don't do auth and Yjs at the same time** -- auth first (Phase 1), Yjs second (Phase 3). Auth needs to work before you can test anything else
6. **Don't SSR the app routes** -- use `ssr: false` on the `_app` layout. App routes need browser APIs (IndexedDB, WebSocket, localStorage). Landing pages get SSR for SEO
