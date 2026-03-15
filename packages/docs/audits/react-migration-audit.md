# React Migration Audit

**Date**: 2026-03-14
**Branch**: `react-migration`
**Scope**: 212 changed files (~33,500 lines) across components, hooks, stores, routes, and library code

---

## Priority 1 -- Fix Immediately (Runtime Breakage)

### ~~1. SolidJS navigate signature in `plan-redirect-utils.js`~~ FIXED

Fixed: Updated all three navigate calls to TanStack Router object signature and corrected the JSDoc.

### ~~2. Active SolidJS imports in `bfcache-handler.js`~~ FIXED

Fixed: Rewrote to use Zustand `useAuthStore.getState()` with `selectIsAuthLoading`, `selectUser`, and `sessionRefetch` instead of SolidJS `useBetterAuth` accessors.

### 3. Test file imports `solid-js`

**File**: `packages/landing/src/lib/__tests__/form-errors.test.js` lines 6-7

```js
import { createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';
```

The test passes SolidJS primitives to `createFormErrorSignals`, which itself uses SolidJS `produce`-style store setter syntax on line 169. Both the test and the function under test are unusable from React code as written.

### ~~4. Navigate to wrong destination in `complete-profile.tsx`~~ FIXED

Fixed: Both navigations changed from `navigate({ to: '/settings' as any })` to `navigate({ to: '/settings/plans' })`. Removes the `as any` cast and sends users to the correct destination after profile completion with a pending plan.

---

## Priority 2 -- Fix Before Merge (Type Safety and React Bugs)

### 5. Duplicate `fetchOrgs` functions share a query key

**Files**: `packages/landing/src/hooks/useOrgs.ts` lines 10-13, `packages/landing/src/hooks/useOrgContext.ts` lines 29-33

Both hooks define a private `fetchOrgs` function with identical implementations, both using query key `queryKeys.orgs.list` (value: `['orgs']`). TanStack Query deduplicates them into a single cache entry. If either implementation diverges in the future, the cache will silently serve stale data from whichever ran first.

**Fix**: Extract `fetchOrgs` to a shared module (e.g., `lib/api/orgs.ts`) and import in both hooks.

### ~~6. `useSubscription` casts to `Record<string, unknown>` six times~~ FIXED

Fixed: Defined `Subscription` interface, typed `fetchSubscription` with `apiFetch.get<Subscription>()`, removed all six `Record<string, unknown>` casts.

### 7. Blanket `eslint-disable` hides stale closure risk in `useNotifications`

**File**: `packages/landing/src/hooks/useNotifications.ts` line 216

```ts
}, [userId]); // eslint-disable-line react-hooks/exhaustive-deps
```

The effect body references `disconnect`, `cleanupTimers`, and `clearPongTimeout`, none of which are in the dependency array. While they are currently stable via `useCallback`, the blanket suppression hides this reasoning. If any dependency chain changes, the lint rule won't surface the bug.

Additionally, notifications are accumulated in state (`setNotifications(prev => [...])`) with no cap -- a memory leak for long-lived sessions.

### 8. `authClient as any` for optional method call

**File**: `packages/landing/src/stores/authStore.ts` line 341

```ts
const result = await (authClient as any).sendVerificationEmail?.({ email });
```

If the `as any` cast throws for a reason other than "method not found", the catch block swallows the real error and falls through to a raw `fetch` call. The method should be typed via Better Auth plugin types or narrowed to a known interface.

### 9. `session: any` prop on `SessionCard`

**File**: `packages/landing/src/components/settings/SessionManagement.tsx` line 79

```tsx
interface SessionCardProps {
  session: any;
  // ...
}
```

All field accesses (`.userAgent`, `.ipAddress`, `.token`, `.updatedAt`, `.createdAt`) are unverified. Lines 173, 176, 186 also cast `sessions` to `any[]`. Use Better Auth's session type.

### 10. `quotas as any` in `ProjectsSection`

**File**: `packages/landing/src/components/dashboard/ProjectsSection.tsx` line 133

```tsx
quotaLimit={(quotas as any)?.['projects.max']}
```

If `quotas['projects.max']` is ever an object rather than a number, `ContactPrompt` will render `[object Object]` in its message string.

### 11. `(result as any)?.twoFactorRequired` in signin

**File**: `packages/landing/src/routes/_auth/signin.tsx` line 122

```tsx
if ((result as any)?.twoFactorRequired) {
```

The return type of `authStore.signin` doesn't include `twoFactorRequired`. The property should be part of the store action's declared return type.

### 12. `as any` bypasses Dexie type checking

**File**: `packages/landing/src/stores/localChecklistsStore.ts` lines 103, 117

```ts
await db.localChecklists.add(checklist as any);
await db.localChecklists.put(updatedChecklist as any);
```

The `LocalChecklist` index signature `[key: string]: unknown` makes it structurally incompatible with the Dexie table type. Fix by aligning the interface with the Dexie schema type.

### 13. Five `(accounts as any[])` casts in `LinkedAccountsSection`

**File**: `packages/landing/src/components/settings/LinkedAccountsSection.tsx` lines 138, 177, 179, 208, 210

The `accounts` data from `useLinkedAccounts` is untyped, forcing every usage to cast to `any[]` and each individual account to `(account: any)`.

**Fix**: Type the linked accounts response from the hook.

### 14. `null as any` arguments in `MergeAccountsDialog`

**File**: `packages/landing/src/components/settings/MergeAccountsDialog.tsx` lines 120, 123, 126

```ts
let result: any;
result = await initiateMerge(null as any, normalizedOrcidId);
result = await initiateMerge(input, null as any);
```

`initiateMerge` should accept `null` natively in its signature instead of requiring `null as any`.

### 15. `project as any` and `study as any` prop casts

**Files**:

- `packages/landing/src/components/dashboard/ProjectsSection.tsx` line 189: `project={project as any}`
- `packages/landing/src/components/layout/sidebar/ProjectTreeItem.tsx` line 76: `study={study as any}`

Bypasses whatever interfaces `ProjectCard` and `StudyTreeItem` expect.

### 16. `(a: any, b: any)` and `(project: any)` in Dashboard activities

**File**: `packages/landing/src/components/dashboard/Dashboard.tsx` lines 44, 49

```ts
.sort((a: any, b: any) => ...)
.map((project: any) => ({ ... }))
```

The project array items are typed upstream but forced to `any` in the sort/map callbacks.

### 17. Suppressed `exhaustive-deps` on `canCreateProject` memo

**File**: `packages/landing/src/components/dashboard/Dashboard.tsx` lines 37-38

```ts
const canCreateProject = useMemo(() => {
  if (!isOnline || !isLoggedIn) return false;
  if (!hasEntitlement('project.create')) return false;
  return hasQuota('projects.max', { used: projects?.length || 0, requested: 1 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [isOnline, isLoggedIn, subscription, projects]);
```

`hasEntitlement` and `hasQuota` are functions from `useSubscription` that close over subscription state. They are not in the dependency array. The `subscription` object being listed is an indirect mitigation but it's a fragile assumption.

**Fix**: Include `hasEntitlement` and `hasQuota` in the deps, or derive the boolean value outside the memo.

### 18. Suppressed deps on route-change close effect

**Files**:

- `packages/landing/src/components/layout/Sidebar.tsx` lines 163-165
- `packages/landing/src/components/layout/SettingsSidebar.tsx` lines 93-95

```ts
useEffect(() => {
  if (mobileOpen) onCloseMobile();
}, [currentPath]); // eslint-disable-line react-hooks/exhaustive-deps
```

`mobileOpen` and `onCloseMobile` are captured as stale closures. Since `onCloseMobile` is `useCallback` with `[]` deps in `AppLayout`, adding it to the array has no performance cost.

### 19. Unmanaged `setTimeout` race in `pdfPreviewStore`

**File**: `packages/landing/src/stores/pdfPreviewStore.ts` lines 56-68

```ts
closePreview: () => {
  set({ isOpen: false });
  setTimeout(() => {
    set({ projectId: null, studyId: null, pdf: null, ... });
  }, 300);
},
```

If the user closes and immediately reopens the preview, the delayed `set` will null out the new preview's data. Track a timeout ID and cancel it on `openPreview`.

### 20. Module-level mutable singletons in `useProjectList`

**File**: `packages/landing/src/hooks/useProjectList.ts` lines 11-13

```ts
const failedCleanupQueue = new Set<string>();
let cleanupProjectLocalData: ((_id: string) => Promise<void>) | null = null;
```

These persist across React renders, component unmounts, and test runs. A project ID that permanently fails cleanup will be retried on every `fetchProjects` call for the tab's lifetime. In tests, state leaks between test runs.

---

## Priority 3 -- Fix Soon (Consistency and Maintainability)

### 21. `projectActionsStore/` is entirely untyped JavaScript

**Files**: All 8 files in `packages/landing/src/stores/projectActionsStore/` (`.js`)

The entire subdirectory has no TypeScript types while the rest of the stores are `.ts`. The Y.js connection `ops` object has no interface -- a typo in a method name (e.g., `ops.createStudy` vs `ops.createStudies`) will silently return `undefined` at runtime with no compile-time error.

### 22. No auth/admin guard on admin query hooks

**File**: `packages/landing/src/hooks/useAdminQueries.ts` lines 28-49

`useAdminStats`, `useAdminUsers`, and `useAdminProjects` have no `enabled` guard for authentication or admin status. Other hooks like `useOrgs` and `useMembers` gate on `isLoggedIn`. If any admin hook is used outside a protected route context, it will fire unauthenticated requests.

### 24. Index as key on dynamic violations list

**File**: `packages/landing/src/components/billing/PricingTable.tsx` line 473

```tsx
{validationError.violations?.map((v: any, i: number) => (
  <div key={i} className="...">
```

The violations array comes from an API response. If violations are ever filtered or reordered, React will diff the elements incorrectly.

### 25. `/check-email` redirect drops `email` search param

**File**: `packages/landing/src/lib/error-utils.js` line 190

```js
navigate({ to: '/check-email', replace: true });
```

The target route (`_auth/check-email.tsx`) validates search params for `email`. This redirect drops it, causing the email field to fall back to `user?.email`, which may not be set in unauthenticated flows.

### 26. Render functions called twice instead of extracted components

**Files**:

- `packages/landing/src/components/layout/Sidebar.tsx` line 168 (`renderSidebarContent`)
- `packages/landing/src/components/layout/SettingsSidebar.tsx` line 97 (`renderNavContent`)

Both define inner functions that return JSX and call them twice (desktop + mobile portal). The two outputs share no component identity between re-renders, meaning state inside the sub-trees (scroll position, input values) is not shared. Extract as proper named components for DevTools inspectability and correct reconciliation.

### ~~27. `apiFetch.delete` body handling inconsistency~~ FIXED

Fixed: `apiFetch` has been converted to TypeScript (`apiFetch.ts`). The `delete` method now accepts body via the options object with full type safety. The type signatures make the API surface explicit.

---

## Systemic Observations

### ~~`as any` from `apiFetch`~~ FIXED

`apiFetch` has been converted to TypeScript with full generic support (`apiFetch.get<T>()`). All 16 call-site type errors have been resolved by adding proper types:

- `useMyProjectsList`: exports `Project` interface, fetches as `Project[]`
- `useSubscription`: exports `Subscription` interface, removed all 6 `Record<string, unknown>` casts
- `InvoicesList`: typed `InvoicesResponse` with `Invoice` interface
- `adminStore`: typed `SessionResponse` for session checks
- `complete-profile`: typed invitation accept response inline

Remaining `as any` locations (not caused by `apiFetch`): `authStore.ts:341`, `localChecklistsStore.ts:103,117`, `SessionManagement.tsx:79`, `signin.tsx:122`, `MergeAccountsDialog.tsx:120,123,126`, `LinkedAccountsSection.tsx:138,177,179`, `ProjectsSection.tsx:189`, `ProjectTreeItem.tsx:76`.

### `eslint-disable` comments suppress real warnings

At least 4 locations suppress `react-hooks/exhaustive-deps` with blanket disables. Each should either fix the deps or use a targeted comment explaining exactly why each omitted dep is safe.

### Large surface area of untyped JS files

The following directories are still `.js` with no TypeScript safety:

- `stores/projectActionsStore/` (8 files)
- `primitives/` (13 files)
- Most of `lib/` (20+ files, though `apiFetch`, `bfcache-handler`, `plan-redirect-utils` are now TS)
- `api/` (3 of 4 files)

These represent the majority of business logic surface area.

---

## Summary

| Priority                                    | Count                                                             | Action                                                                                                              |
| ------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| ~~Fix immediately (runtime breakage)~~      | ~~4~~ 1 remaining                                                 | ~~SolidJS navigate signatures~~, ~~SolidJS bfcache imports~~, SolidJS form-errors test, ~~wrong route destination~~ |
| Fix before merge (type safety + React bugs) | ~~16~~ 15 remaining                                               | `as any` casts, stale closures, suppressed lint rules, race conditions (~~useSubscription casts fixed~~)            |
| ~~Fix soon (consistency)~~                  | ~~7~~ 6 remaining                                                 | Untyped JS files, mixed icon libs, missing guards, module singletons, ~~apiFetch inconsistency~~                    |
| **Total**                                   | **22 remaining** (5 fixed + `apiFetch` typed with all call sites) |                                                                                                                     |
