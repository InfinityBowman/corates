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

### UI Components: shadcn/ui (Radix) + Ark UI for React

Primary UI library is **shadcn/ui** (built on Radix UI primitives, Tailwind CSS, CVA). This replaces most `@ark-ui/solid` components. `@ark-ui/react` is kept as a fallback for components shadcn doesn't cover.

**shadcn/ui covers (use these):** button, dialog, alert-dialog, select, tabs, dropdown-menu, context-menu, tooltip, popover, checkbox, switch, collapsible, progress, avatar, toast (sonner), input-otp (pin-input equivalent), sheet (drawer)

**No shadcn equivalent (use @ark-ui/react):** editable, file-upload, steps, qr-code

**Custom components (no library needed):** spinner (simple Tailwind animation), password-input (input + toggle), flip-number (already custom)

### Library Swaps

| SolidJS                       | React                        | API similarity                         |
| ----------------------------- | ---------------------------- | -------------------------------------- |
| `@tanstack/solid-query`       | `@tanstack/react-query`      | Near-identical                         |
| `@tanstack/solid-table`       | `@tanstack/react-table`      | Near-identical                         |
| `@ark-ui/solid`               | `shadcn/ui` + `@ark-ui/react`| shadcn for most; Ark for editable, file-upload, steps, qr-code |
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

## Phase 0: Preparation -- COMPLETED (2026-03-14)

### 0.1 Add dependencies to landing -- DONE

All dependencies installed including all 28 @embedpdf packages, Preact + @preact/preset-vite (devDep).

### 0.2 Verify path aliases -- DONE

Using `@/` prefix for everything (Option 1). Added explicit `resolve.alias` in `vite.config.ts` for SSR build compatibility with the Cloudflare plugin (vite-tsconfig-paths alone did not resolve aliases in the SSR environment). Also added `allowJs: true` to tsconfig.json for importing copied JS files from TS code.

### 0.3 Copy framework-agnostic code into landing -- DONE

Copied 37+ files:
- `lib/` -- 24 utility files + 11 test files (all import aliases updated to `@/` prefix)
- `constants/` -- 2 files (errors.js, checklist-status.js)
- `config/` -- api.js, google.js copied; sentry.js rewritten for @sentry/react
- `checklist-registry/` -- 2 files (index.js, types.js)
- `primitives/` -- db.js, avatarCache.js, pdfCache.js
- `styles/ark-ui.css`

`queryClient.js` was rewritten: `@tanstack/solid-query` -> `@tanstack/react-query`, `@solid-primitives/scheduled` debounce replaced with inline implementation.

`bfcache-handler.js` was copied but still references old SolidJS `useBetterAuth` -- needs rewrite when wired up.

### 0.4 Set up vitest

Not yet done -- test infrastructure setup deferred to Phase 5.

**Checkpoint: landing builds and runs, all copied code compiles, no solid-js imports in active code paths.**

---

## Phase 1: Foundation (stores + auth) -- COMPLETED (2026-03-14)

Everything else depends on this layer. Build it first, test it standalone.

> **Implementation notes (2026-03-14):**
> All stores, auth, and layout routes are implemented and verified (build + typecheck + lint all pass).
> Key files created:
> - `stores/projectStore.ts` -- Zustand + immer, with exported selector functions
> - `stores/pdfPreviewStore.ts` -- simple Zustand store
> - `stores/localChecklistsStore.ts` -- Zustand + Dexie, auto-initializes on module load
> - `stores/adminStore.ts` -- tiny Zustand store + exported plain async API functions
> - `stores/authStore.ts` -- full auth Zustand store with all methods (signin, signup, 2FA, session management, offline fallback, cross-tab BroadcastChannel)
> - `api/auth-client.ts` -- `better-auth/react` client with all plugins
> - `components/auth/AuthProvider.tsx` -- syncs useSession() into Zustand, handles avatar caching, visibility refresh
> - `components/ui/toast.tsx` -- minimal stub providing showToast API (console-based, replace in Phase 2)
> - `routes/_app.tsx` -- QueryClientProvider + AuthProvider, ssr:false
> - `routes/_auth.tsx` -- auth layout with guest guard, ssr:false
> - `routes/_app/_protected.tsx` -- auth guard via beforeLoad
> - `routes/_app/dashboard.tsx`, `routes/_auth/signin.tsx`, `routes/_app/_protected/settings.tsx` -- placeholders
>
> **Discovered during implementation:**
> - `vite-tsconfig-paths` does not resolve `@/` aliases in the Cloudflare SSR build environment. Fixed with explicit `resolve.alias` in vite.config.ts.
> - `apiFetch.delete()` only accepts 2 args `(path, options)` not 3. The original SolidJS adminStore had 3-arg calls that silently dropped the body. Fixed in the React version.
> - ESLint `no-unused-vars` rule does not understand TypeScript interface method parameters. Suppressed with eslint-disable blocks around interface definitions.
> - `server-entry.ts` is unchanged -- all SPA routes still serve the SolidJS app.html. New TanStack Start routes are defined but unreachable until entries are removed from `SPA_ROUTE_PREFIXES`.

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

## Phase 2: UI Component Library -- COMPLETED (2026-03-14)

Create `packages/landing/src/components/ui/` using shadcn/ui + @ark-ui/react for gaps.

### Design Decisions (2026-03-14)

- **Use shadcn design tokens**, not the custom semantic tokens from the SolidJS app. This means adopting shadcn's CSS variable system and default styling. Components will be visually consistent with the shadcn ecosystem and get theming support for free.
- **Use shadcn CLI** (`npx shadcn@latest add`) to install all shadcn components properly. Do not hand-write shadcn components.
- **Standard shadcn component APIs** -- no compatibility wrappers mapping old Ark UI sub-component names to shadcn equivalents. Page components in Phase 4 will use shadcn patterns directly.
- **Custom extensions** for app-specific patterns: `AlertDialogIcon` (danger/warning/info variants), `AlertDialogAction` (variant-based button colors), `UserAvatar` (convenience wrapper with initials), `showToast` API adapter over Sonner.
- **Password input** stays on `@ark-ui/react` (headless primitive handles visibility state and accessibility).
- **Icon migration** scoped to files created/modified in this phase only. Page-level icon migration happens in Phase 4.

### 2.0 Set up shadcn/ui

Initialize shadcn/ui in the landing package via `npx shadcn@latest init`. This creates `components.json`, installs Radix UI primitives, and sets up the `cn()` utility + CSS variables.

The existing `cn.ts` (copied from web in Phase 0) will be replaced by shadcn's version. The existing `z-index.ts` constants file is kept for app-level overlay stacking.

### 2.1 Install shadcn components via CLI

Use `npx shadcn@latest add <component>` for each. These replace the corresponding `@ark-ui/solid` wrappers:

| SolidJS (Ark UI)       | shadcn component         | Notes                                          |
| ---------------------- | ------------------------ | ---------------------------------------------- |
| button.tsx             | `button`                 | Use shadcn default variants and design tokens  |
| dialog.tsx             | `dialog`                 | Different composition API (no Positioner/Backdrop) |
| alert-dialog.tsx       | `alert-dialog`           | Add custom AlertDialogIcon + AlertDialogAction extensions |
| select.tsx             | `select`                 | Different API; SimpleSelect convenience wrapper deferred to Phase 4 |
| tabs.tsx               | `tabs`                   | No animated TabsIndicator (simpler approach)   |
| menu.tsx               | `dropdown-menu`          | Ark Menu -> Radix DropdownMenu                 |
| tooltip.tsx            | `tooltip`                | Direct replacement                             |
| popover.tsx            | `popover`                | Direct replacement                             |
| checkbox.tsx           | `checkbox`               | Direct replacement                             |
| switch.tsx             | `switch`                 | Direct replacement                             |
| collapsible.tsx        | `collapsible`            | Direct replacement                             |
| progress.tsx           | `progress`               | Direct replacement                             |
| avatar.tsx             | `avatar`                 | Add UserAvatar + getInitials convenience wrapper |
| toast.tsx              | `sonner`                 | Replace console stub with Sonner; add showToast adapter |
| pin-input.tsx          | `input-otp`              | Similar API, different component name           |
| (new)                  | `input`                  | Base input component (needed by password-input and forms) |
| (new)                  | `label`                  | Form labels                                    |

### 2.2 Ark UI components (no shadcn equivalent)

These stay on `@ark-ui/react` with custom styled wrappers:

| Component        | Notes                                                   |
| ---------------- | ------------------------------------------------------- |
| editable.tsx     | Inline text editing -- no Radix/shadcn equivalent       |
| file-upload.tsx  | Drag-and-drop file upload with progress                 |
| steps.tsx        | Multi-step wizard UI                                    |
| qr-code.tsx      | QR code generation for 2FA setup                        |
| password-input.tsx | Visibility toggle with full a11y -- @ark-ui/react/password-input |

### 2.3 Custom components (no library needed)

| Component          | Approach                                                  |
| ------------------ | --------------------------------------------------------- |
| spinner.tsx         | Pure Tailwind `animate-spin` div with CVA variants (sm/md/lg/xl, default/white/gray) |
| flip-number.tsx     | Already ported to React in landing package (uses countup.js). Move to components/ui/ |

### 2.4 Icon migration (this phase only)

Only update icon imports in files created/modified during Phase 2 (`packages/landing/src/components/ui/`). Page-level icon migration (80+ files) happens in Phase 4.

Key mapping: `solid-icons/fi` -> `react-icons/fi` (same names). `solid-icons/bi` -> `react-icons/bi` (drop `Regular`/`Solid` infix). `solid-icons/vs` -> `react-icons/vsc` (VS Code icons).

**Checkpoint: all UI components installed, build + typecheck + lint pass, shadcn design tokens active.**

> **Implementation notes (2026-03-14):**
> - shadcn/ui initialized with `radix-nova` style, neutral base color, CSS variables enabled
> - 18 shadcn components installed via CLI: button, dialog, alert-dialog, select, tabs, dropdown-menu, tooltip, popover, checkbox, switch, collapsible, progress, avatar, sonner, input-otp, input, label
> - shadcn's `cn()` utility at `src/lib/utils.ts` replaces the old copied `cn.ts`
> - shadcn added Geist font -- overridden back to Inter in `@theme inline` block
> - `sonner.tsx` fixed: removed `next-themes` dependency (not used), hardcoded `theme="light"`
> - `toast.tsx` replaced: old console stub replaced with Sonner-backed adapter preserving `showToast.success/error/warning/info/loading/dismiss/update` API with 2-second deduplication
> - Custom extensions added: `AlertDialogIcon` (danger/warning/info variant coloring), `UserAvatar` + `getInitials` (convenience wrapper)
> - 5 Ark UI components ported to `@ark-ui/react`: editable (with SimpleEditable), file-upload, steps, qr-code, password-input
> - Custom components: `spinner.tsx` (CVA variants: sm/md/lg/xl, default/white/gray + PageLoader/LoadingPlaceholder/ButtonSpinner composites), `flip-number.tsx` (copied from existing React landing component)
> - `z-index.ts` copied from web for overlay stacking constants
> - All components use `lucide-react` icons (shadcn default) or `react-icons` -- zero `solid-icons` imports

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

### 4.1 Auth pages -- COMPLETED (2026-03-14)

All 5 auth pages migrated to React and serving in production:
- `_auth/signin.tsx` -- password/magic-link tab animation, 2FA inline, OAuth (Google/ORCID)
- `_auth/signup.tsx` -- OAuth + magic link, invitation/plan capture from URL
- `_auth/check-email.tsx` -- email verification polling, visibility change detection
- `_auth/reset-password.tsx` -- dual-form (request reset / set new password with strength indicator)
- `_auth/complete-profile.tsx` -- 3-step wizard (name/title, institution, persona), OAuth name autofill, invitation acceptance, plan redirect

Supporting components created:
- `components/auth/` -- ErrorMessage, AuthButtons, SocialAuthButtons, LastLoginHint, StrengthIndicator, TwoFactorVerify, MagicLinkForm, RoleSelector
- `hooks/useOAuthError.ts` -- OAuth error URL cleanup
- `hooks/useBfcacheReset.ts` -- shared bfcache loading state reset
- `api/billing.js` -- billing API (copied, framework-agnostic)

Key changes:
- `server-entry.ts` -- auth routes removed from SPA_ROUTE_PREFIXES (React serves them)
- `_auth.tsx` layout -- guest guard with exemptions for /reset-password, /complete-profile, /check-email
- `__root.tsx` -- providers (QueryClientProvider, AuthProvider, Toaster) hoisted here
- `lib/config.ts` -- signIn/signUp URLs changed to relative paths (same-origin navigation)
- `lib/error-utils.js` -- navigate calls updated to TanStack Router object form
- Navbar -- Sign In/Sign Up links use TanStack `<Link>` for client-side navigation
- All auth components use shadcn design tokens (no hardcoded blue)
- `selectUser` selector fixed to avoid object spread (was causing infinite re-render loop)

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

| Phase                | Effort         | Can parallelize?               | Status                |
| -------------------- | -------------- | ------------------------------ | --------------------- |
| Phase 0: Preparation | 0.5 days       | --                             | DONE (2026-03-14)     |
| Phase 1: Foundation  | 3-4 days       | --                             | DONE (2026-03-14)     |
| Phase 2: UI Library  | 2 days         | Yes (with Phase 3)             | DONE (2026-03-14)     |
| Phase 3: Primitives  | 3-4 days       | Yes (with Phase 2)             | DONE (2026-03-14)     |
| Phase 4: Pages       | 5-7 days       | Partially (independent routes) | 4.1 auth DONE         |
| Phase 5: Tests       | 2 days         | Yes (with Phase 4)             | Not started           |
| Phase 6: Cleanup     | 0.5 days       | --                             | Not started           |
| **Total**            | **~2-3 weeks** |                                | **Phases 0-2 + 4.1 done** |

Phase 0 is shorter since landing already exists. Claude Code can handle the mechanical parts (UI components, query hooks, icon swaps, simple page conversions) to significantly speed up Phases 2 and 4.

---

## What NOT to do

1. **Don't change business logic during migration** -- port first, refactor later
2. **Don't skip the dependency array audit** -- use eslint exhaustive-deps from the start
3. **Don't migrate the Preact PDF viewer** -- it's already isolated, just wrap it
4. **Don't try to make components work in both SolidJS and React** -- clean port, no bridges
5. **Don't do auth and Yjs at the same time** -- auth first (Phase 1), Yjs second (Phase 3). Auth needs to work before you can test anything else
6. **Don't SSR the app routes** -- use `ssr: false` on the `_app` layout. App routes need browser APIs (IndexedDB, WebSocket, localStorage). Landing pages get SSR for SEO
