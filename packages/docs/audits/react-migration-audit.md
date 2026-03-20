# React Migration Audit

**Date**: 2026-03-14 (last verified: 2026-03-16)
**Branch**: `react-migration`

---

## Priority 1 and 2 -- All Resolved

All critical and fix-before-merge items have been addressed.

---

## Priority 3 -- Remaining Items

### 11. Module-level mutable singletons in `useProjectList`

**File**: `packages/landing/src/hooks/useProjectList.ts` lines 11-13

`failedCleanupQueue` and `cleanupProjectLocalData` persist across renders and test runs.

### 15. `projectActionsStore/` is entirely untyped JavaScript

All 8 files remain `.js`. The Y.js `ops` object has no interface.

### 16. No auth/admin guard on admin query hooks

**File**: `packages/landing/src/hooks/useAdminQueries.ts`

Admin hooks have no `enabled` guard for auth/admin status.

### 17. Index as key on dynamic violations list

**File**: `packages/landing/src/components/billing/PricingTable.tsx`

### 18. `/check-email` redirect drops `email` search param

**File**: `packages/landing/src/lib/error-utils.ts` line 164

### 19. Render functions called twice instead of extracted components

**Files**: `Sidebar.tsx` (`renderSidebarContent`), `SettingsSidebar.tsx` (`renderNavContent`)

### 31. ROB2 and ROBINS-I `SignallingQuestion` are near-identical duplicates

Extract a shared `BaseSignallingQuestion` in `checklist/common/`.

### 32. ROB2 and ROBINS-I `ScoringSummary` duplicate `ResourceLink` component

Move to `checklist/common/ResourceLink.tsx`.

### 34. `DomainSection` has `<h3>` inside `<button>` (invalid HTML)

Both ROB2 and ROBINS-I versions.

### 36. Duplicate `formatDate` across 4+ admin files

Extract to shared admin utility.

### 39. `GrantList` has confusingly-named `loading`/`isLoading` props

---

## Items Resolved

1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 20, 21, 22, 23, 24, 25, 26 (props are used -- component was implemented since audit), 27, 28, 29, 30, 33, 35, 37, 38

---

## Summary

| Priority         | Count  | Action                                     |
| ---------------- | ------ | ------------------------------------------ |
| Critical         | 0      | All resolved                               |
| Fix before merge | 0      | All resolved                               |
| Fix soon         | 11     | Duplicates, consistency, untyped JS, minor |
| **Total**        | **11** |                                            |
