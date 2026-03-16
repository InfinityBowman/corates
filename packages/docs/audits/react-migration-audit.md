# React Migration Audit

**Date**: 2026-03-14 (last verified: 2026-03-16)
**Branch**: `react-migration`

---

## Priority 1 and 2 -- All Resolved

All critical and fix-before-merge items have been addressed.

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

1 (dead code deleted), 2, 3 (documented deps + 50-notification cap), 4, 5, 6, 7, 8 (index signature removed, Dexie boundary casts documented), 9 (LinkedAccount interface typed), 10, 12, 13, 14, 20, 21 (API layer complete), 22, 23, 27, 28 (narrowed to overallState?.judgement), 30 (flicker fixed), 35 (useMemo in all 4 admin files)

---

## Summary

| Priority         | Count  | Action                                    |
| ---------------- | ------ | ----------------------------------------- |
| Critical         | 0      | All resolved                              |
| Fix before merge | 0      | All resolved                              |
| Fix soon         | 17     | A11y, duplicates, consistency, untyped JS |
| **Total**        | **17** |                                           |
