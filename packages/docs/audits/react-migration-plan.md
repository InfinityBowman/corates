# Web Package Migration: SolidJS to React (Unified Package)

## Strategy: Build into packages/landing, one package for everything

packages/landing has React 19, TanStack Start, TanStack Router (file-based), Tailwind v4, and Cloudflare Workers. The old SolidStart landing app was replaced with TanStack Start + React. Instead of creating a separate package, migrate the SolidJS web app directly into packages/landing. One router handles landing pages AND the app.

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

### Routing: TanStack Router (file-based, already in landing)

Already set up. App routes become new files under `src/routes/`.

### UI Components: Ark UI for React

`@ark-ui/solid` -> `@ark-ui/react` -- nearly identical API, mechanical swap.

### Library Swaps

| SolidJS                       | React                        | API similarity                         |
| ----------------------------- | ---------------------------- | -------------------------------------- |
| `@tanstack/solid-query`       | `@tanstack/react-query`      | Near-identical                         |
| `@tanstack/solid-table`       | `@tanstack/react-table`      | Near-identical                         |
| `@ark-ui/solid`               | `@ark-ui/react`              | Near-identical                         |
| `solid-icons`                 | `react-icons`                | Same icons, different imports          |
| `solid-chartjs`               | `react-chartjs-2`            | Same Chart.js underneath               |
| `@sentry/solid`               | `@sentry/react`              | Direct swap                            |
| `@solid-primitives/scheduled` | Custom hook or `usehooks-ts` | Used in 7 files for debounce/throttle  |
| `better-auth/solid`           | `better-auth/react`          | `createAuthClient` + `useSession` swap |
| `@solidjs/router`             | `@tanstack/react-router`     | Already in landing                     |

---

## Route Structure

```
packages/landing/src/routes/
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

  _app.tsx                     # App shell layout (navbar + sidebar + QueryProvider, NO auth guard)
  _app/
    dashboard.tsx              # Public -- accessible without login
    checklist.tsx              # Public -- local checklists work offline
    checklist.$checklistId.tsx # Public

    _protected.tsx             # Auth guard layout -- all children require login
    _protected/
      orgs.new.tsx
      settings.tsx             # Settings layout
      settings/
        index.tsx
        profile.tsx
        integrations.tsx
        billing.tsx
        plans.tsx
        security.tsx
        notifications.tsx
      projects.$projectId.tsx  # Project layout (Yjs connection)
      projects.$projectId/
        index.tsx              # Project overview/tabs
        studies.$studyId.checklists.$checklistId.tsx
        studies.$studyId.reconcile.$checklist1Id.$checklist2Id.tsx
      admin.tsx                # Admin layout (lazy)
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

- `_auth.tsx` is a pathless layout route -- auth pages render without sidebar/navbar, includes guest guard (redirects logged-in users to /dashboard)
- `_app.tsx` is a pathless layout route -- wraps all app routes with sidebar, navbar, QueryClientProvider. Does NOT include auth guard (dashboard and local checklists are public)
- `_app/_protected.tsx` is a nested pathless layout with AuthGuard -- all children (settings, projects, admin, orgs) require login
- Landing pages stay at the top level -- no layout wrapper, SSR-friendly, minimal JS
- `projects.$projectId.tsx` is a layout route that establishes the Yjs WebSocket connection, child routes share it
- Admin routes under `_protected/admin.tsx` can use `lazy()` for code splitting

This matches the SolidJS app where `/dashboard` and `/checklist` are outside ProtectedGuard, while settings, projects, admin, and orgs are inside it.

### How \_app.tsx layout works

```tsx
// routes/_app.tsx -- app shell, NO auth guard
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { AppLayout } from '@/components/layout/AppLayout';
import { AuthProvider } from '@/components/auth/AuthProvider';

export const Route = createFileRoute('/_app')({
  // Disable SSR for all app routes -- they require browser APIs
  // (IndexedDB, WebSocket, localStorage, etc.)
  ssr: false,
  component: AppLayoutWrapper,
});

function AppLayoutWrapper() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppLayout>
          <Outlet />
        </AppLayout>
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

```tsx
// routes/_app/_protected.tsx -- auth guard for protected routes
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/_protected')({
  beforeLoad: ({ context }) => {
    if (!context.auth?.isLoggedIn) {
      throw redirect({ to: '/signin' });
    }
  },
  component: () => <Outlet />,
});
```

### Landing vs App: SSR boundary

TanStack Start gives you SSR by default. The `ssr: false` on `_app` means all app routes are client-only (they need browser APIs). Landing pages keep SSR for SEO. This gives you the best of both worlds in one router.

---

## Phase 0: Preparation

### 0.1 Add dependencies to landing

Already in landing: `react`, `react-dom`, `react-icons`, `@tanstack/react-router`, `@tanstack/react-start`, `countup.js`, `@corates/shared`, `tailwindcss`.

Still need to add:

```bash
pnpm --filter landing add \
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
  d3
```

Plus EmbedPDF packages (the full list from web/package.json). And Preact + `@preact/preset-vite` for the PDF viewer island (devDep).

### 0.2 Verify path aliases

Landing already has `@/*` -> `./src/*` in tsconfig.json (matching web's jsconfig.json). The web app uses more specific aliases (`@components`, `@primitives`, `@api`, `@config`, `@lib`). Two options:

1. **Use `@/` prefix for everything** (simpler): `@/components/...`, `@/lib/...`, `@/stores/...`. This already works with the existing `@/*` alias.
2. **Add specific aliases** if you want shorter imports: add `@components/*`, `@lib/*`, etc. to both tsconfig.json and vite-tsconfig-paths will pick them up.

Option 1 is recommended -- less config, and `@/` is already set up. The web code already uses `@/` for most imports anyway. Also ensure `vite-tsconfig-paths` (already in landing devDeps) resolves these correctly.

### 0.3 Copy framework-agnostic code into landing

Create these directories in landing/src and copy from web/src:

```
packages/landing/src/
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

Add vitest + @testing-library/react to landing devDependencies. Copy test setup from web, adapting for React.

**Checkpoint: landing still builds and runs, new lib/config/constants files import cleanly, no solid-js in copied code.**

---

## Phase 1: Foundation (stores + auth)

Everything else depends on this layer. Build it first, test it standalone.

### 1.1 Migrate stores to Zustand

Create `packages/landing/src/stores/`:

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

Create `packages/landing/src/api/`:

**auth-client.ts** -- Better Auth client setup. The existing `auth-client.js` imports `createAuthClient` from `better-auth/solid` -- this must change to `better-auth/react`. The `useSession` hook exported from the client is framework-specific. The rest of the client config (plugins, fetchOptions) is framework-agnostic.

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

### 1.3 Set up app layout routes

Create `routes/_app.tsx`:

- QueryClientProvider
- AuthProvider (session sync, online/offline, BroadcastChannel)
- AppLayout (navbar + sidebar + Outlet)
- `ssr: false` (app routes need browser APIs)
- No auth guard here -- dashboard and local checklists are public

Create `routes/_app/_protected.tsx`:

- AuthGuard via `beforeLoad` -- redirect to /signin if not logged in
- All children (settings, projects, admin, orgs) require login

Create `routes/_auth.tsx`:

- Minimal layout for auth pages (no sidebar)
- Guest guard (redirect to /dashboard if already logged in)

Create placeholder routes:

- `_app/dashboard.tsx` -- renders "Dashboard placeholder"
- `_auth/signin.tsx` -- renders "Sign in placeholder"
- `_app/_protected/settings.tsx` -- renders "Settings placeholder"
- etc.

**Checkpoint: landing pages still work, navigating to /dashboard shows app layout with placeholder, auth flow works (login redirects, session persists).**

---

## Phase 2: UI Component Library

Create `packages/landing/src/components/ui/`:

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

Create `packages/landing/src/primitives/` (or `packages/landing/src/hooks/`):

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

5. Mount in `routes/_app/_protected/projects.$projectId.tsx` layout route -- child routes get the live Yjs connection

**This is the riskiest phase.** Test with two browser tabs editing the same checklist.

**Checkpoint: can open a project, see studies load from Yjs, edit a checklist, see real-time sync between tabs.**

---

## Phase 4: Pages (migrate route by route)

Start simple, build confidence, tackle complex last. Each route becomes a file in `packages/landing/src/routes/`.

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

- `_app/_protected/settings.tsx` (layout) + `_app/_protected/settings/*.tsx` (pages)
- Profile, billing, integrations, security, notifications
- Self-contained form pages

### 4.5 Organization + billing

- `_app/_protected/orgs.new.tsx`
- Billing components

### 4.6 Project view (complex)

- `_app/_protected/projects.$projectId.tsx` (layout -- Yjs connection)
- `_app/_protected/projects.$projectId/index.tsx` (overview, tab system)
- Study cards, add-studies flow, all-studies tab, completed tab, todo tab
- Heavy Yjs data consumption from projectStore via Zustand selectors

### 4.7 Checklists (most complex UI)

- `_app/_protected/projects.$projectId/studies.$studyId.checklists.$checklistId.tsx`
- AMSTAR2, ROB2, ROBINS-I checklist forms
- Complex conditional fields, scoring visualization, decision diagrams
- PDF viewer integration

### 4.8 Reconciliation (complex)

- `_app/_protected/projects.$projectId/studies.$studyId.reconcile.$c1Id.$c2Id.tsx`
- Multi-reviewer comparison, conflict resolution

### 4.9 Local checklists

- `_app/checklist.tsx`, `_app/checklist.$checklistId.tsx`
- Uses localChecklistsStore (Zustand) + Dexie

### 4.10 Admin (last, isolated)

- `_app/_protected/admin.tsx` (layout, lazy loaded) + `_app/_protected/admin/*.tsx`
- Charts: `solid-chartjs` -> `react-chartjs-2`
- Admin queries already migrated in Phase 3

### 4.11 PDF components

- The EmbedPDF Preact viewer is isolated -- keep as-is
- Create a React wrapper that mounts the Preact island (same pattern as current SolidJS wrapper)
- PDF preview panel uses pdfPreviewStore (Zustand)
- **Vite config note:** The web package uses `@preact/preset-vite` scoped to `**/preact/**` files alongside the SolidJS plugin. In landing, you'll need to add the Preact plugin similarly scoped, alongside `@vitejs/plugin-react`. Test that TanStack Start's Vite plugin doesn't conflict with dual React/Preact setup. If it does, consider converting the PDF viewer to React (it's small) or embedding it via iframe

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

- Verify all functionality works in landing
- Delete packages/web from workspace
- Update pnpm-workspace.yaml

### 6.2 Update build/deploy

- Single `pnpm --filter landing build` builds everything
- Single Cloudflare Workers deploy
- No more `copy-to-landing.js` script
- No more separate web build step
- Update landing's `build:prod` script (currently references `@corates/web`): remove the `pnpm --filter @corates/web build` step

### 6.3 Update documentation

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

Phase 0 is shorter since landing already exists. Claude Code can handle the mechanical parts (UI components, query hooks, icon swaps, simple page conversions) to significantly speed up Phases 2 and 4.

---

## What NOT to do

1. **Don't change business logic during migration** -- port first, refactor later
2. **Don't skip the dependency array audit** -- use eslint exhaustive-deps from the start
3. **Don't migrate the Preact PDF viewer** -- it's already isolated, just wrap it
4. **Don't try to make components work in both SolidJS and React** -- clean port, no bridges
5. **Don't do auth and Yjs at the same time** -- auth first (Phase 1), Yjs second (Phase 3). Auth needs to work before you can test anything else
6. **Don't SSR the app routes** -- use `ssr: false` on the `_app` layout. App routes need browser APIs (IndexedDB, WebSocket, localStorage). Landing pages get SSR for SEO
