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

| SolidJS                       | React                         | API similarity                                                 |
| ----------------------------- | ----------------------------- | -------------------------------------------------------------- |
| `@tanstack/solid-query`       | `@tanstack/react-query`       | Near-identical                                                 |
| `@tanstack/solid-table`       | `@tanstack/react-table`       | Near-identical                                                 |
| `@ark-ui/solid`               | `shadcn/ui` + `@ark-ui/react` | shadcn for most; Ark for editable, file-upload, steps, qr-code |
| `solid-icons`                 | `react-icons`                 | Same icons, different imports                                  |
| `solid-chartjs`               | `react-chartjs-2`             | Same Chart.js underneath                                       |
| `@sentry/solid`               | `@sentry/react`               | Direct swap                                                    |
| `@solid-primitives/scheduled` | Custom hook or `usehooks-ts`  | Used in 7 files for debounce/throttle                          |
| `better-auth/solid`           | `better-auth/react`           | `createAuthClient` + `useSession` swap                         |
| `@solidjs/router`             | `@tanstack/react-router`      | Already in landing                                             |

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
>
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
>
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

| SolidJS (Ark UI) | shadcn component | Notes                                                               |
| ---------------- | ---------------- | ------------------------------------------------------------------- |
| button.tsx       | `button`         | Use shadcn default variants and design tokens                       |
| dialog.tsx       | `dialog`         | Different composition API (no Positioner/Backdrop)                  |
| alert-dialog.tsx | `alert-dialog`   | Add custom AlertDialogIcon + AlertDialogAction extensions           |
| select.tsx       | `select`         | Different API; SimpleSelect convenience wrapper deferred to Phase 4 |
| tabs.tsx         | `tabs`           | No animated TabsIndicator (simpler approach)                        |
| menu.tsx         | `dropdown-menu`  | Ark Menu -> Radix DropdownMenu                                      |
| tooltip.tsx      | `tooltip`        | Direct replacement                                                  |
| popover.tsx      | `popover`        | Direct replacement                                                  |
| checkbox.tsx     | `checkbox`       | Direct replacement                                                  |
| switch.tsx       | `switch`         | Direct replacement                                                  |
| collapsible.tsx  | `collapsible`    | Direct replacement                                                  |
| progress.tsx     | `progress`       | Direct replacement                                                  |
| avatar.tsx       | `avatar`         | Add UserAvatar + getInitials convenience wrapper                    |
| toast.tsx        | `sonner`         | Replace console stub with Sonner; add showToast adapter             |
| pin-input.tsx    | `input-otp`      | Similar API, different component name                               |
| (new)            | `input`          | Base input component (needed by password-input and forms)           |
| (new)            | `label`          | Form labels                                                         |

### 2.2 Ark UI components (no shadcn equivalent)

These stay on `@ark-ui/react` with custom styled wrappers:

| Component          | Notes                                                            |
| ------------------ | ---------------------------------------------------------------- |
| editable.tsx       | Inline text editing -- no Radix/shadcn equivalent                |
| file-upload.tsx    | Drag-and-drop file upload with progress                          |
| steps.tsx          | Multi-step wizard UI                                             |
| qr-code.tsx        | QR code generation for 2FA setup                                 |
| password-input.tsx | Visibility toggle with full a11y -- @ark-ui/react/password-input |

### 2.3 Custom components (no library needed)

| Component       | Approach                                                                             |
| --------------- | ------------------------------------------------------------------------------------ |
| spinner.tsx     | Pure Tailwind `animate-spin` div with CVA variants (sm/md/lg/xl, default/white/gray) |
| flip-number.tsx | Already ported to React in landing package (uses countup.js). Move to components/ui/ |

### 2.4 Icon migration (this phase only)

Only update icon imports in files created/modified during Phase 2 (`packages/landing/src/components/ui/`). Page-level icon migration (80+ files) happens in Phase 4.

Key mapping: `solid-icons/fi` -> `react-icons/fi` (same names). `solid-icons/bi` -> `react-icons/bi` (drop `Regular`/`Solid` infix). `solid-icons/vs` -> `react-icons/vsc` (VS Code icons).

**Checkpoint: all UI components installed, build + typecheck + lint pass, shadcn design tokens active.**

> **Implementation notes (2026-03-14):**
>
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

### 4.2 App shell -- COMPLETED (2026-03-14)

- `components/layout/AppLayout.tsx`, `AppNavbar.tsx`, `Sidebar.tsx`, `SettingsSidebar.tsx`
- Cross-fade sidebar animation, mobile portal overlay
- `/dashboard` removed from SPA_ROUTE_PREFIXES

### 4.3 Dashboard -- COMPLETED (2026-03-14)

- 10 component files: Dashboard, DashboardHeader, ProjectsSection, ProjectCard, LocalAppraisalsSection, LocalAppraisalCard, ActivityFeed, QuickActions, useInitialAnimation, utils
- `/dashboard` served by React in production

### 4.4 Settings -- COMPLETED (2026-03-14)

All 6 settings pages migrated to React:

- `settings/profile.tsx` -- avatar upload, inline name editing (SimpleEditable), persona selector, academic info, account deletion
- `settings/integrations.tsx` -- Google Drive connect/disconnect with AlertDialog confirmation
- `settings/billing.tsx` -- subscription card, usage card, invoices list, payment issue banner, checkout redirect handling
- `settings/plans.tsx` -- pricing table with billing interval toggle, trial CTA, FAQ accordion, pending plan redirect
- `settings/security.tsx` -- password add/change, 2FA 4-step setup/disable, linked accounts with OAuth error handling and merge flow, session management with revocation
- `settings/notifications.tsx` -- toggle stubs (no backend persistence yet)

Supporting components created:

- `components/settings/` -- ProfileInfoSection, PersonaSection, AcademicInfoSection, DeleteAccountSection, GoogleDriveSettings, SecuritySettings, TwoFactorSetup, LinkedAccountsSection, AccountProviderCard, MergeAccountsDialog, SessionManagement
- `components/billing/` -- SubscriptionCard, UsageCard, InvoicesList, PaymentIssueBanner, PricingTable
- `api/account-merge.js` -- account merge API (copied from web, framework-agnostic)
- `lib/syncUtils.ts` -- shared profile sync utility

Key changes:

- `server-entry.ts` -- `/settings` removed from SPA_ROUTE_PREFIXES (React serves them)
- SolidJS `createResource` for sessions replaced with `useQuery`
- Ark UI Select/Dialog replaced with shadcn equivalents
- `window.confirm()` replaced with `AlertDialog`
- `TwoFactorSetup` derives `isEnabled` from store instead of local state
- All billing components use shadcn design tokens instead of hardcoded colors

### 4.5 Organization -- COMPLETED (2026-03-14)

- `_app/_protected/orgs.new.tsx` -- CreateOrgPage (name, slug, auto-generate)
- `/orgs` removed from SPA_ROUTE_PREFIXES
- Post-create navigates to /dashboard (org detail page not yet migrated)

### 4.6 Project view -- COMPLETED (2026-03-14)

Full project view migrated across 4 phases (A-D) with code reviews after each:

**Phase A -- Project shell + Overview Tab:**

- `ProjectView.tsx` -- layout shell, Yjs boot (via useProject), pending data processing (PDFs, refs, Google Drive files), 5-tab interface with URL-based tab state
- `ProjectContext.tsx` -- React context providing projectId, orgId, userRole, path builders, member helpers (stable useCallback separation)
- `ProjectHeader.tsx` -- inline-editable name/description via Ark UI Editable
- `PdfPreviewPanel.tsx` + `SlidingPanel.tsx` -- GPU-accelerated slide-in PDF viewer
- `SectionErrorBoundary.tsx` -- React class error boundary
- `OverviewTab.tsx` -- project progress (CircularProgress SVG), stats grid, inter-rater reliability, team members with add/remove, collapsible charts/tables sections
- `CircularProgress.tsx` -- pure SVG (replaced D3 dependency), uses CSS custom properties
- `AddMemberModal.tsx` -- user search with debounce, email invitation, role selection

**Phase B -- All Studies Tab:**

- `AllStudiesTab.tsx` -- expandable study cards, form state restoration after OAuth redirect
- `StudyCard.tsx` + `StudyCardHeader.tsx` -- editable name, reviewer avatars with tooltips, actions dropdown menu
- `StudyPdfSection.tsx` -- PDF upload with validation, tag management, Google Drive import
- `PdfListItem.tsx` + `PdfTagBadge.tsx` -- shared PDF row components with view/download/delete/tag actions
- `AssignReviewersModal.tsx` -- reviewer 1/2 selection with duplicate prevention
- `EditPdfMetadataModal.tsx` -- citation metadata editing with year validation

**Phase C -- Todo + Completed Tabs:**

- `ToDoTab.tsx` -- studies assigned to current user, checklist creation flow
- `TodoStudyRow.tsx` -- single/multi checklist modes, inline create form, delete confirmation
- `ChecklistForm.tsx` -- type/outcome selection with availability filtering
- `CompletedTab.tsx` -- reconciliation progress-aware display
- `CompletedStudyRow.tsx` -- single/multi outcome modes with "View Previous" button
- `CompletedOutcomeRow.tsx` -- per-outcome status and reconciliation actions

**Phase D -- Reconcile Tab listing:**

- `ReconcileTab.tsx` -- studies in reconciliation workflow
- `ReconcileStudyRow.tsx` -- READY/WAITING sections for multi-outcome, inline controls for single-outcome
- `ReconcileStatusTag.tsx` -- "Ready" or "Waiting for {reviewer}" badge

**Stubs filled (2026-03-14):**

- `AddStudiesForm` -- full 4-tab form (Upload PDFs, Import References, DOI/PMID, Google Drive) with 3 UI modes (collapsible card, always expanded, empty project dropzone), drag-and-drop, submit/cancel, OAuth state restoration. 8 files total:
  - `PdfUploadSection.tsx` -- Ark FileUpload dropzone, pending/error list with retry
  - `ReferenceImportSection.tsx` -- RIS/BibTeX/ENW import, PDF matching status badges, checkbox list
  - `DoiLookupSection.tsx` -- identifier lookup, results split by PDF availability, manual PDF upload with tooltips
  - `StagedStudiesSection.tsx` -- unified staging area showing merged/deduplicated studies
  - `GoogleDriveSection.tsx` -- thin wrapper around GoogleDrivePickerLauncher for multiselect
  - `GoogleDrivePickerLauncher.tsx` -- connection status check, OAuth connect flow, Google Picker SDK launch
  - `GoogleDrivePickerModal.tsx` -- single-study import modal using Dialog + launcher
- `useAddStudies` hook -- full coordinator with 4 sub-hooks (pdfs, references, lookup, drive), matching effects, deduplication, serialization
- `ReviewerAssignment` -- full 634 LOC with percentage distribution, preview, conflict resolution
- `OutcomeManager` -- full CRUD with inline editing, AlertDialog for delete
- `AMSTAR2ResultsTable` -- full results table with summary statistics
- `ScoreTag` -- score display with type-aware styling

**Remaining stubs (not yet filled):**

- `ChartSection` -- D3 chart visualizations (AMSTARRobvis, AMSTARDistribution, ChartSettingsModal). Cosmetic, not blocking.
- `PreviousReviewersView` -- GenericChecklist now migrated, can be filled in
- `EmbedPdfViewer` -- Preact PDF viewer island migration

Key decisions:

- `/projects` NOT yet removed from SPA_ROUTE_PREFIXES -- remaining stubs are cosmetic/blocked, can be removed soon
- `projectActionsStore` accessed via `as any` cast due to JS module without type declarations
- `CircularProgress` rewritten as pure SVG instead of porting the D3 imperative version
- Pending data read via `useState` lazy initializer to prevent StrictMode data loss
- Manual `connect()`/`disconnect()` removed from ProjectView -- `useProject` manages its own lifecycle
- Drag-and-drop handlers use refs to avoid stale closures (registered once, read current values via refs)
- OAuth state restoration expands form unconditionally (restoreState enqueues React state updates that haven't committed)
- Checkbox inside clickable rows uses onClick stopPropagation to prevent double-fire

### 4.7 Checklists -- COMPLETED (2026-03-15)

All three checklist types migrated across 5 sub-phases (A-E) with code reviews after each:

**Phase A -- Infrastructure:**

- `common/LocalTextAdapter.js` -- Y.Text shim for offline mode (copied, framework-agnostic)
- `common/NoteEditor.tsx` -- Y.Text-bound textarea, collapsible + inline modes
- `SplitScreenLayout.tsx` + `SplitPanelControls.tsx` -- resizable split panel with PDF viewer toggle
- `GenericChecklist.tsx` -- type dispatcher (AMSTAR2/ROB2/ROBINS-I)
- `ChecklistWithPdf.tsx` -- layout wrapper combining checklist + PDF viewer

**Phase B -- AMSTAR2 (958 LOC original):**

- `AMSTAR2Checklist.tsx` -- all 16 questions with extracted helper functions for column/radio logic
- Q1 (3-column special case) uses inline handler; Q9/Q11 (split questions) are dedicated components
- `checklist-map.js` copied, `checklist.js` updated with missing exports (isAMSTAR2Complete)

**Phase C -- ROB2 (7 sub-components, ~1,340 LOC):**

- `ROB2Checklist.tsx`, `DomainSection.tsx`, `DomainJudgement.tsx`, `PreliminarySection.tsx`, `OverallSection.tsx`, `ScoringSummary.tsx`, `SignallingQuestion.tsx`
- Auto-scoring only (no manual override), aim-based domain selection (assignment vs. adhering)

**Phase D -- ROBINS-I (12 sub-components, ~1,545 LOC):**

- `ROBINSIChecklist.tsx`, `DomainSection.tsx`, `DomainJudgement.tsx`, `OverallSection.tsx`, `ScoringSummary.tsx`, `SignallingQuestion.tsx`, `PlanningSection.tsx`, `SectionA.tsx`, `SectionB.tsx`, `SectionC.tsx`, `SectionD.tsx`
- Auto/Manual mode toggle, stop-assessment gating from Section B, isPerProtocol domain selection, subsection support (Domain 3)

**Phase E -- Wrappers + Routes:**

- `ChecklistYjsWrapper.tsx` -- project-mode Yjs bridge with PDF loading, completion flow, annotation support
- `LocalChecklistView.tsx` -- offline mode with debounced IndexedDB save and LocalTextAdapter
- `CreateLocalChecklist.tsx` -- local checklist creation form with PDF upload
- `routes/_app/checklist.tsx` + `routes/_app/checklist.$checklistId.tsx` -- local checklist routes
- `routes/_app/_protected/projects.$projectId/studies.$studyId.checklists.$checklistId.tsx` -- project checklist route

Key decisions:

- OverallSection auto-persist uses narrowed deps (overallState?.judgement not full object) to avoid re-triggering on direction changes
- SignallingQuestion NA-to-NI coercion uses narrowed deps (answer?.answer not full answer object)
- DomainSection completionStatus uses `!= null` to correctly exclude undefined answers
- SectionC radio names use `useId()` to prevent collision across instances
- Store methods accessed via `getStoreActions()` at call sites, not destructured at render time
- ChecklistWithPdf shows PDF panel when pdfData is available (`showSecondPanel={!!pdfData}`)
- AMSTAR2 QUESTION_CONFIGS excludes Q1 (3-column special case handled inline)

### 4.8 Reconciliation child routes -- COMPLETED (2026-03-15)

44 files migrated across 6 sub-phases:

**4.8A - Presence system + shared components (5 files):**
- `useReconciliationPresence.ts` hook (Yjs awareness protocol, cursor tracking, user-by-page grouping)
- `userColors.js` (already existed from earlier phase)
- `PresenceAvatars.tsx`, `RemoteCursors.tsx`, `QuestionPresenceIndicator.tsx`

**4.8B - Route + ReconciliationWrapper (2 files):**
- Route: `studies.$studyId.reconcile.$checklist1Id.$checklist2Id.tsx`
- `ReconciliationWrapper.tsx` (Yjs lifecycle, PDF loading, reconciled checklist creation with race condition handling, type dispatch to AMSTAR2/ROB2/ROBINS-I)

**4.8C - AMSTAR2 reconciliation (10 files):**
- `ReconciliationWithPdf.tsx` (split-screen wrapper with presence)
- `ChecklistReconciliation.tsx` (main question-page navigation, answer writing to Yjs, auto-fill, navbar store bridge)
- `ReconciliationQuestionPage.tsx` + `MultiPartQuestionPage.tsx` (q9/q11 multi-part)
- `AnswerPanel.tsx`, `NotesCompareSection.tsx`, `SummaryView.tsx`, `Footer.tsx`
- `Navbar.tsx`, `navbar-utils.js`

**4.8D - ROB2 reconciliation (14 files):**
- `ROB2ReconciliationWithPdf.tsx`, `ROB2Reconciliation.tsx`
- `ROB2Navbar.tsx`, `NavbarDomainPill.tsx`, `ROB2SummaryView.tsx`
- `navbar-utils.js`, `index.ts`
- pages: `PreliminaryPage.tsx`, `SignallingQuestionPage.tsx`, `DomainDirectionPage.tsx`, `OverallDirectionPage.tsx`
- panels: `ROB2AnswerPanel.tsx`, `DirectionPanel.tsx`, `JudgementPanel.tsx`

**4.8E - ROBINS-I reconciliation (14 files):**
- `RobinsIReconciliationWithPdf.tsx`, `RobinsIReconciliation.tsx`
- `RobinsINavbar.tsx`, `NavbarDomainPill.tsx`, `RobinsISummaryView.tsx`
- `navbar-utils.js`, `index.ts`
- pages: `SectionBQuestionPage.tsx`, `DomainQuestionPage.tsx`, `DomainJudgementPage.tsx`, `OverallJudgementPage.tsx`
- panels: `RobinsAnswerPanel.tsx`, `DirectionPanel.tsx`, `JudgementPanel.tsx`

**Key patterns and fixes:**
- Navbar store bridge: SolidJS `createStore` replaced with React `useState` + setter callback
- Presence hook: custom throttle replacing `@solid-primitives/scheduled`, `getAwareness` stabilized with `useMemo` to prevent effect churn
- Module-level helper functions to avoid React TDZ issues (`answersEqual`, `multiPartEqual`, `singleAnswerEqual`)
- ROBINS-I update functions refactored to send only changed fields (avoid spreading state over Y.Text objects)
- `handleReset` positioned before `useEffect` that references it to prevent TDZ crash

### 4.9 Local checklists -- COMPLETED (2026-03-15)

Migrated together with Phase 4.7 since they share checklist form components:

- `routes/_app/checklist.tsx` and `routes/_app/checklist.$checklistId.tsx` route files
- `LocalChecklistView.tsx` wrapper with debounced IndexedDB persistence
- `CreateLocalChecklist.tsx` creation form
- `localChecklistsStore` (Zustand + Dexie) was already migrated in Phase 1

### 4.10 Admin (last, isolated)

- `_app/_protected/admin.tsx` (layout, lazy loaded) + `_app/_protected/admin/*.tsx`
- Admin queries already migrated in Phase 3
- Admin chart components (LineChart, BarChart, DoughnutChart) already migrated using Recharts

### Charts -- COMPLETED (2026-03-15)

**D3 charts (project overview):**
- `AMSTARRobvis.tsx` - D3 traffic light heatmap with `useLayoutEffect` for text measurement (avoids margin flash)
- `AMSTARDistribution.tsx` - D3 horizontal stacked bar chart with ResizeObserver
- `ChartSettingsModal.tsx` - Pure UI modal for labels, titles, greyscale toggle, SVG/PNG export
- `ChartSection.tsx` - Orchestrator replacing stub, with `exportChart` utility (framework-agnostic SVG/PNG export)
- `forwardRef` + `useImperativeHandle` pattern for SVG element export access

**Admin charts (Recharts, replacing solid-chartjs/Chart.js):**
- `LineChart.tsx` - Recharts `ResponsiveContainer` + `LineChart` (declarative JSX API)
- `BarChart.tsx` - Recharts `BarChart` with per-bar `Cell` colors
- `DoughnutChart.tsx` - Recharts `PieChart` + `Pie` with inner radius for doughnut effect
- Added `recharts@^3.8.0` dependency (replacing `solid-chartjs` and eventually `chart.js`/`react-chartjs-2`)

### 4.11 PDF components -- COMPLETED (2026-03-15)

- Copied Preact island source (`preact/src/`) from web to landing under `components/pdf/embedpdf/preact/`
- Created React wrapper `EmbedPdfViewer.tsx` that mounts Preact component via `render(h(...))` in useEffect
- Added `@preact/preset-vite` to `vite.config.ts` scoped to `**/preact/**` files, excluded from React plugin
- Removed `/projects` from `SPA_ROUTE_PREFIXES` in `server-entry.ts` so React serves project routes

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

| Phase                | Effort         | Can parallelize?               | Status                     |
| -------------------- | -------------- | ------------------------------ | -------------------------- |
| Phase 0: Preparation | 0.5 days       | --                             | DONE (2026-03-14)          |
| Phase 1: Foundation  | 3-4 days       | --                             | DONE (2026-03-14)          |
| Phase 2: UI Library  | 2 days         | Yes (with Phase 3)             | DONE (2026-03-14)          |
| Phase 3: Primitives  | 3-4 days       | Yes (with Phase 2)             | DONE (2026-03-14)          |
| Phase 4: Pages       | 5-7 days       | Partially (independent routes) | 4.1-4.7, 4.9 DONE          |
| Phase 5: Tests       | 2 days         | Yes (with Phase 4)             | Not started                |
| Phase 6: Cleanup     | 0.5 days       | --                             | Not started                |
| **Total**            | **~2-3 weeks** |                                | **Phases 0-4.7, 4.9 done** |

Phase 0 is shorter since landing already exists. Claude Code can handle the mechanical parts (UI components, query hooks, icon swaps, simple page conversions) to significantly speed up Phases 2 and 4.

---

## What NOT to do

1. **Don't change business logic during migration** -- port first, refactor later
2. **Don't skip the dependency array audit** -- use eslint exhaustive-deps from the start
3. **Don't migrate the Preact PDF viewer** -- it's already isolated, just wrap it
4. **Don't try to make components work in both SolidJS and React** -- clean port, no bridges
5. **Don't do auth and Yjs at the same time** -- auth first (Phase 1), Yjs second (Phase 3). Auth needs to work before you can test anything else
6. **Don't SSR the app routes** -- use `ssr: false` on the `_app` layout. App routes need browser APIs (IndexedDB, WebSocket, localStorage). Landing pages get SSR for SEO
