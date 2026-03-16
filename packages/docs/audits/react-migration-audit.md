# React Migration Audit

how do large codebases manage complexity? i feel like making changes or tracking down bugs has become fairly difficult..maybe just look around an make write up an audit or something with recommendations and reasoning, if you use subagents use opus

**Date**: 2026-03-14
**Branch**: `react-migration`
**Scope**: 212+ changed files across components, hooks, stores, routes, and library code

---

## Priority 1 -- Fix Immediately (Runtime Breakage)

### 1. Test file imports `solid-js`

**File**: `packages/landing/src/lib/__tests__/form-errors.test.js` lines 6-7

```js
import { createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';
```

The test passes SolidJS primitives to `createFormErrorSignals`, which itself uses SolidJS `produce`-style store setter syntax on line 169. Both the test and the function under test are unusable from React code as written.

---

## Priority 2 -- Fix Before Merge (Type Safety and React Bugs)

### ~~2. Duplicate `fetchOrgs` functions share a query key~~ FIXED

### 3. Blanket `eslint-disable` hides stale closure risk in `useNotifications`

**File**: `packages/landing/src/hooks/useNotifications.ts` line 216

```ts
}, [userId]); // eslint-disable-line react-hooks/exhaustive-deps
```

The effect body references `disconnect`, `cleanupTimers`, and `clearPongTimeout`, none of which are in the dependency array. While they are currently stable via `useCallback`, the blanket suppression hides this reasoning. If any dependency chain changes, the lint rule won't surface the bug.

Additionally, notifications are accumulated in state (`setNotifications(prev => [...])`) with no cap -- a memory leak for long-lived sessions.

### ~~4. `authClient as any` for optional method call~~ FIXED

Fixed: Replaced `(authClient as any).sendVerificationEmail?.()` with `authClient.$fetch('/send-verification-email', ...)`. The `$fetch` method is typed on the client and hits the same endpoint. Also removed the double try/catch fallback since both paths were hitting the same API route.

### ~~5. `session: any` prop on `SessionCard`~~ FIXED

Fixed: Defined `Session` interface with `token`, `userAgent`, `ipAddress`, `updatedAt`, `createdAt`. Removed all `(sessions as any[])` casts and `(a: any, b: any)` sort callbacks.

### ~~6. `quotas as any` in `ProjectsSection`~~ FIXED

Fixed: Typed `quotas` as `Quotas` (from `@corates/shared/plans`) in `useSubscription`. Removed `as any` cast in both `ProjectsSection` and `OverviewTab`.

### ~~7. `(result as any)?.twoFactorRequired` in signin~~ FIXED

Fixed: Updated `authStore.signin` return type to `Promise<{ twoFactorRequired: true } | unknown>`. Call site uses type narrowing (`'twoFactorRequired' in result`) instead of `as any`.

### 8. `as any` bypasses Dexie type checking

**File**: `packages/landing/src/stores/localChecklistsStore.ts` lines 103, 117

```ts
await db.localChecklists.add(checklist as any);
await db.localChecklists.put(updatedChecklist as any);
```

The `LocalChecklist` index signature `[key: string]: unknown` makes it structurally incompatible with the Dexie table type. Fix by aligning the interface with the Dexie schema type.

### 9. Five `(accounts as any[])` casts in `LinkedAccountsSection`

**File**: `packages/landing/src/components/settings/LinkedAccountsSection.tsx` lines 138, 177, 179, 208, 210

The `accounts` data from `useLinkedAccounts` is untyped, forcing every usage to cast to `any[]` and each individual account to `(account: any)`.

**Fix**: Type the linked accounts response from the hook.

### ~~10. `null as any` arguments in `MergeAccountsDialog`~~ FIXED

Fixed: `account-merge.ts` now accepts `string | null` for both params. `MergeAccountsDialog` no longer uses `null as any` or `result: any`.

### 11. Module-level mutable singletons in `useProjectList`

**File**: `packages/landing/src/hooks/useProjectList.ts` lines 11-13

```ts
const failedCleanupQueue = new Set<string>();
let cleanupProjectLocalData: ((_id: string) => Promise<void>) | null = null;
```

These persist across React renders, component unmounts, and test runs. A project ID that permanently fails cleanup will be retried on every `fetchProjects` call for the tab's lifetime. In tests, state leaks between test runs.

### ~~12. `restrictionType` is always `'quota'` when user has no restriction~~ FIXED

### ~~13. Pervasive `any` in `ProjectContext` and project components~~ FIXED

Fixed: Defined `ProjectMember` interface in `ProjectContext.tsx` and exported it. Typed `members`, `getMember`, `projectOps` (as `Record<string, unknown>`). Updated `OverviewTab`, `StudyCard`, and `StudyCardHeader` to use `ProjectMember` instead of `any`. Remaining `any`: `ProjectView.tsx:84` (`getPendingProjectData` on store) and `projectOps` consumers (none currently).

### ~~14. `null as any` to satisfy typed parameters~~ FIXED

Fixed: Updated JSDoc types in `checklist-domain.js` for `shouldShowInTab`, `getStudiesForTab`, and `getChecklistCount` to accept `string | null` for userId. Removed all `null as any` casts in `ProjectView` and `OverviewTab`.

---

## Priority 3 -- Fix Soon (Consistency and Maintainability)

### 15. `projectActionsStore/` is entirely untyped JavaScript

**Files**: All 8 files in `packages/landing/src/stores/projectActionsStore/` (`.js`)

The entire subdirectory has no TypeScript types while the rest of the stores are `.ts`. The Y.js connection `ops` object has no interface -- a typo in a method name (e.g., `ops.createStudy` vs `ops.createStudies`) will silently return `undefined` at runtime with no compile-time error.

### 16. No auth/admin guard on admin query hooks

**File**: `packages/landing/src/hooks/useAdminQueries.ts` lines 28-49

`useAdminStats`, `useAdminUsers`, and `useAdminProjects` have no `enabled` guard for authentication or admin status. Other hooks like `useOrgs` and `useMembers` gate on `isLoggedIn`. If any admin hook is used outside a protected route context, it will fire unauthenticated requests.

### 17. Index as key on dynamic violations list

**File**: `packages/landing/src/components/billing/PricingTable.tsx` line 473

```tsx
{validationError.violations?.map((v: any, i: number) => (
  <div key={i} className="...">
```

The violations array comes from an API response. If violations are ever filtered or reordered, React will diff the elements incorrectly.

### 18. `/check-email` redirect drops `email` search param

**File**: `packages/landing/src/lib/error-utils.js` line 190

```js
navigate({ to: '/check-email', replace: true });
```

The target route (`_auth/check-email.tsx`) validates search params for `email`. This redirect drops it, causing the email field to fall back to `user?.email`, which may not be set in unauthenticated flows.

### 19. Render functions called twice instead of extracted components

**Files**:

- `packages/landing/src/components/layout/Sidebar.tsx` line 168 (`renderSidebarContent`)
- `packages/landing/src/components/layout/SettingsSidebar.tsx` line 97 (`renderNavContent`)

Both define inner functions that return JSX and call them twice (desktop + mobile portal). The two outputs share no component identity between re-renders, meaning state inside the sub-trees (scroll position, input values) is not shared. Extract as proper named components for DevTools inspectability and correct reconciliation.

### ~~20. Unused `members` prop in `ChartSection`~~ FIXED

### 21. Large surface area of untyped JS files

The following directories are still `.js` with no TypeScript safety:

- `stores/projectActionsStore/` (8 files)
- `primitives/` (13 files)
- Most of `lib/` (20+ files, though `apiFetch`, `bfcache-handler`, `plan-redirect-utils`, `error-utils` are now TS)
- `api/` (1 of 4 files -- `billing`, `account-merge`, `auth-client` are now TS)

These represent the majority of business logic surface area.

---

## Systemic Observations

### Remaining `as any` locations

`localChecklistsStore.ts:103,117`, `LinkedAccountsSection.tsx:138,177,179`, `ProjectView.tsx:84,87-89`.

### `eslint-disable` comments suppress real warnings

At least 2 remaining locations suppress `react-hooks/exhaustive-deps` with blanket disables. Each should either fix the deps or use a targeted comment explaining exactly why each omitted dep is safe.

---

## New Findings (commits `427502d7`, `c7e770e6` + staged -- project tabs migration)

### ~~22. `setState` called during render body in `ChecklistForm`~~ FIXED

Fixed: Replaced state + effect pattern with derived value. `outcomeId` is now computed from `selectedOutcomeId` -- if the selected outcome is no longer available, it resolves to `null` without triggering a re-render.

### ~~23. Unstable function factory in `CompletedTab` invalidates all child memos~~ FIXED

Fixed: Replaced `createReconciliationProgressGetter` factory with a single stable `getReconciliationProgress(studyId, outcomeId, type)` callback. The parent passes an inline arrow in JSX (still a new ref per render), but the core computation is stable via `useCallback`.

### 24. `<label>` elements not associated with inputs

**Files**:

- `components/project/add-studies/AddStudiesForm.tsx` line 96
- `components/project/all-studies-tab/EditPdfMetadataModal.tsx` lines 112, 125, 138, 155, 167
- `components/project/outcomes/OutcomeManager.tsx` lines 178, 229

Labels lack `htmlFor` and inputs lack `id`. Screen readers cannot associate labels with inputs, and clicking the label text does not focus the input.

### 25. Icon-only buttons lack `aria-label`

**Files**:

- `components/project/todo-tab/TodoStudyRow.tsx` lines 202-209, 251-256
- `components/project/outcomes/OutcomeManager.tsx` lines 269-274

Delete/edit/save buttons use only `title` (not reliably announced by screen readers) with no `aria-label`.

### 26. Unused props in `PreviousReviewersView`

**File**: `packages/landing/src/components/project/completed-tab/PreviousReviewersView.tsx` lines 15-23

`study`, `reconciliationProgress`, and `getAssigneeName` are declared in the interface and passed by callers but destructured away and never used.

### ~~27. Duplicate `sortedPdfs`/`citationLine` logic across three components~~ FIXED

Fixed: Extracted `sortStudyPdfs()` and `getCitationLine()` to `components/project/study-utils.ts`. All three study row components now import from the shared module.

---

## New Findings (staged -- checklist components migration)

### 28. ROB2 `OverallSection` useEffect may re-fire unnecessarily

**File**: `components/checklist/ROB2Checklist/OverallSection.tsx` lines 33-37

`overallState` is in the dependency array of an effect that calls `onUpdate({ ...overallState, ... })`. When `onUpdate` causes the parent to update `overallState`, the effect re-runs. The guard prevents infinite loops but fires unnecessarily on unrelated `overallState` changes (e.g. `direction`). The ROBINS-I version avoids this correctly with a ref.

**Fix**: Use `overallState?.judgement` as the narrow dep and a ref for spreading the latest state.

### 29. `PlanningSection` and `SectionA` accept `onUpdate` but never call it

**Files**:

- `components/checklist/ROBINSIChecklist/PlanningSection.tsx` line 16
- `components/checklist/ROBINSIChecklist/SectionA.tsx` line 15

Both declare `onUpdate` in their prop interfaces but destructure it away. Any caller relying on `onUpdate` to persist state to a non-Yjs store will be silently broken.

### 30. `SplitScreenLayout` effect syncs `showSecondPanel` with inconsistent default

**File**: `components/checklist/SplitScreenLayout.tsx` lines 34-40

`useState` initializes from prop (default `false`), but the sync effect uses `?? true`. On initial render when prop is `undefined`, state is `false` then immediately set to `true`, causing a flicker.

### 31. ROB2 and ROBINS-I `SignallingQuestion` are near-identical duplicates

**Files**: `ROB2Checklist/SignallingQuestion.tsx`, `ROBINSIChecklist/SignallingQuestion.tsx`

The only differences are prop name (`getRob2Text` vs `getRobinsText`) and ROBINS-I renders `question.note`. Extract a shared `BaseSignallingQuestion` in `checklist/common/`.

### 32. ROB2 and ROBINS-I `ScoringSummary` duplicate `ResourceLink` component

**Files**: `ROB2Checklist/ScoringSummary.tsx` lines 170-187, `ROBINSIChecklist/ScoringSummary.tsx` lines 196-213

Byte-for-byte identical `ResourceLink` component. Move to `checklist/common/ResourceLink.tsx`.

### 33. `SplitPanelControls` toolbar buttons missing `aria-label`

**File**: `components/checklist/SplitPanelControls.tsx` lines 81-145

Five icon-only buttons rely solely on `title`. Add `aria-label` matching each `title` text.

### 34. `DomainSection` has `<h3>` inside `<button>` (invalid HTML)

**Files**: `ROB2Checklist/DomainSection.tsx` lines 75-109, `ROBINSIChecklist/DomainSection.tsx` lines 125-162

Interactive elements must not contain heading elements per the HTML content model spec.

---

## New Findings (admin pages migration)

### 35. Column definitions not wrapped in `useMemo` (unstable references for TanStack Table)

**Files**: `admin/UserTable.tsx:63`, `admin/orgs.tsx:71`, `admin/projects.tsx:109`, `admin/billing.ledger.tsx:138`

Column arrays are declared as plain variables inside component bodies. TanStack Table requires stable column references to avoid recalculating its internal model on every render. Wrap in `useMemo`.

### 36. Duplicate `formatDate` function across 4 admin files

**Files**: `admin/UserTable.tsx:44`, `admin/GrantList.tsx:24`, `admin/SubscriptionList.tsx:34`, `admin/SubscriptionDialog.tsx:41`

Nearly identical `formatDate` utility defined in each file. Extract to a shared admin utility.

### 37. Pagination shows "Showing 1 to 0 of 0" when result set is empty

**Files**: `admin/index.tsx:125`, `admin/orgs.tsx:193`

When total is 0, the pagination text computes `(page - 1) * limit + 1` which renders as "Showing 1 to 0 of 0". Guard with `total > 0`.

### 38. Icon-only buttons missing `aria-label` in admin components

**Files**: `admin/GrantList.tsx:86` (revoke button), `admin/SubscriptionList.tsx:201-215` (edit/cancel buttons)

Buttons render only icons with no accessible text. `title` attribute is not reliably announced by screen readers.

### 39. `GrantList` has confusingly-named `loading`/`isLoading` props

**File**: `admin/GrantList.tsx:18-21`

Both `loading` and `isLoading` are boolean props. `loading` controls button disabled state, `isLoading` controls the spinner. Confusing API surface.

---

## Summary

| Priority                               | Count  | Action                                                                                                                                    |
| -------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Fix immediately (runtime breakage)     | 1      | SolidJS form-errors test                                                                                                                  |
| Fix before merge (type safety + React) | 8      | `as any` casts, stale closure risk, effect re-fire (#28), dead props (#29), flicker (#30), unstable columns (#35)                         |
| Fix soon (consistency + a11y)          | 18     | Untyped JS, missing guards, render fns, redirect, a11y (#24-25,33,38), unused props (#26), duplicates (#31-32,36), invalid HTML (#34), pagination (#37), confusing props (#39) |
| **Total**                              | **27** |                                                                                                                                           |
