# React Migration Audit

**Date**: 2026-03-14 (last verified: 2026-03-16)
**Branch**: `react-migration`
**Scope**: 212+ changed files across components, hooks, stores, routes, and library code

---

## Priority 1 -- Fix Immediately (Runtime Breakage)

### 1. Test file imports `solid-js`

**File**: `packages/landing/src/lib/__tests__/form-errors.test.js` lines 6-7

The test passes SolidJS primitives to `createFormErrorSignals`, which itself uses SolidJS `produce`-style store setter syntax. Both the test and the function under test are unusable from React code as written. Requires rewriting `form-errors.js` and its test for React.

---

## Priority 2 -- Fix Before Merge (Type Safety and React Bugs)

### 3. Blanket `eslint-disable` hides stale closure risk in `useNotifications`

**File**: `packages/landing/src/hooks/useNotifications.ts` line 216

The effect body references `disconnect`, `cleanupTimers`, and `clearPongTimeout`, none of which are in the dependency array. The blanket `eslint-disable-line` suppression hides this. Additionally, notifications accumulate in state with no cap -- a memory leak for long-lived sessions.

### 8. `as any` bypasses Dexie type checking

**File**: `packages/landing/src/stores/localChecklistsStore.ts` lines 103, 117

The `LocalChecklist` index signature makes it structurally incompatible with the Dexie table type. Fix by aligning the interface with the Dexie schema type.

### 9. Five `(accounts as any[])` casts in `LinkedAccountsSection`

**File**: `packages/landing/src/components/settings/LinkedAccountsSection.tsx`

The `accounts` data from `useLinkedAccounts` is untyped. Fix by typing the linked accounts response from the hook.

### 28. ROB2 `OverallSection` useEffect may re-fire unnecessarily

**File**: `components/checklist/ROB2Checklist/OverallSection.tsx` line 41

`overallState` is in the dependency array of an effect that calls `onUpdate`. Fires unnecessarily on unrelated `overallState` changes. The ROBINS-I version already does this correctly with narrower deps.

### 35. Column definitions not wrapped in `useMemo` (TanStack Table)

**Files**: `admin/UserTable.tsx`, `admin/orgs.tsx`, `admin/projects.tsx`, `admin/billing.ledger.tsx`

Column arrays declared as plain variables inside component bodies. TanStack Table requires stable references. Wrap in `useMemo`.

---

## Priority 3 -- Fix Soon (Consistency and Maintainability)

### 11. Module-level mutable singletons in `useProjectList`

**File**: `packages/landing/src/hooks/useProjectList.ts` lines 11-13

`failedCleanupQueue` and `cleanupProjectLocalData` persist across renders and test runs.

### 15. `projectActionsStore/` is entirely untyped JavaScript

All 8 files remain `.js`. The Y.js `ops` object has no interface.

### 16. No auth/admin guard on admin query hooks

**File**: `packages/landing/src/hooks/useAdminQueries.ts`

Admin hooks have no `enabled` guard for auth/admin status. Will fire unauthenticated requests if used outside protected routes.

### 17. Index as key on dynamic violations list

**File**: `packages/landing/src/components/billing/PricingTable.tsx`

Violations array from API uses index as key.

### 18. `/check-email` redirect drops `email` search param

**File**: `packages/landing/src/lib/error-utils.ts` line 164

### 19. Render functions called twice instead of extracted components

**Files**: `Sidebar.tsx` (`renderSidebarContent`), `SettingsSidebar.tsx` (`renderNavContent`)

### 24. `<label>` elements not associated with inputs

**Files**: `AddStudiesForm.tsx`, `EditPdfMetadataModal.tsx`, `OutcomeManager.tsx`

### 25. Icon-only buttons lack `aria-label`

**Files**: `TodoStudyRow.tsx`, `OutcomeManager.tsx`

### 26. Unused props in `PreviousReviewersView`

`study`, `reconciliationProgress`, `getAssigneeName` declared but unused.

### 29. `PlanningSection` and `SectionA` accept `onUpdate` but never call it

Dead prop path -- callers pass handlers that are silently ignored.

### 31. ROB2 and ROBINS-I `SignallingQuestion` are near-identical duplicates

Extract a shared `BaseSignallingQuestion` in `checklist/common/`.

### 32. ROB2 and ROBINS-I `ScoringSummary` duplicate `ResourceLink` component

Move to `checklist/common/ResourceLink.tsx`.

### 33. `SplitPanelControls` toolbar buttons missing `aria-label`

Five icon-only buttons rely solely on `title`.

### 34. `DomainSection` has `<h3>` inside `<button>` (invalid HTML)

Both ROB2 and ROBINS-I versions.

### 36. Duplicate `formatDate` across 4+ admin files

Extract to shared admin utility.

### 37. Pagination shows "Showing 1 to 0 of 0" when empty

**Files**: `admin/index.tsx`, `admin/orgs.tsx`

### 38. Icon-only buttons missing `aria-label` in admin components

**Files**: `admin/GrantList.tsx`, `admin/SubscriptionList.tsx`

### 39. `GrantList` has confusingly-named `loading`/`isLoading` props

---

## Items Resolved

1 (dead code -- form-errors.js and test deleted), 2, 3 (documented deps, added 50-notification cap), 4, 5, 6, 7, 8 (removed index signature, Dexie boundary casts documented), 9 (typed LinkedAccount interface, removed all as any[] casts), 10, 12, 13, 14, 20, 21 (partially -- API layer complete, lib mostly done), 22, 23, 27, 28 (narrowed deps to overallState?.judgement), 30 (flicker fixed), 35 (all 4 admin files wrapped in useMemo)

---

## Summary

| Priority                               | Count  | Action                                                              |
| -------------------------------------- | ------ | ------------------------------------------------------------------- |
| Fix immediately (runtime breakage)     | 0      | All resolved                                                        |
| Fix before merge (type safety + React) | 0      | All resolved                                                        |
| Fix soon (consistency + a11y)          | 17     | Untyped JS (#15), missing guards (#16), index keys (#17), redirect (#18), render fns (#19), a11y (#24-25,33,38), unused props (#26,29), duplicates (#31-32,36), HTML (#34), pagination (#37), confusing props (#39), singletons (#11) |
| **Total**                              | **17** |                                                                     |
