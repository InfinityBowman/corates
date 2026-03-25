# Landing Package Simplify Audit - 2026-03-21

Full review of `/packages/landing/src` (477 source files) for code reuse, quality, and efficiency.

## Preferences

- No `useMemo` or `useCallback` -- write code as if React Compiler is active
- Prefer `useEffectEvent`, `startTransition`, `useDeferredValue`, `useTransition` where appropriate
- Structural solutions over manual memoization for performance issues

## Status Key

- [ ] Not started
- [x] Fixed
- [-] Skipped (with reason)

---

## Bugs Found and Fixed (discovered during audit work)

### B1. ROB2 optional question marking too aggressive
- **Files**: `components/checklist/ROB2Checklist/DomainSection.tsx`
- **Problem**: Questions 4.2-4.5 showed "(Optional)" when no answers were given. `getRequiredQuestions` returns only the entry-point question with no answers, so everything else looked optional.
- **Fix**: Added `hasAnyAnswer` guard -- questions only marked optional once the user has started answering in that domain.
- [x] Fixed

### B2. Immer stack overflow on reconciliation "Use This"
- **Files**: `stores/projectStore.ts`, `primitives/useProject/sync.ts`
- **Problem**: `persistStats` called `JSON.stringify` on an Immer draft proxy inside `produce`, causing stack overflow. Also ROB2 Y.Text objects leaked into Immer via `toJSON()`.
- **Fix**: Moved `persistStats` outside Immer `produce`. Added explicit ROB2 Y.Text serialization in `sync.ts`.
- [x] Fixed

### B3. ROB2 reconciliation navbar pills not expanding
- **Files**: `components/project/reconcile-tab/rob2-reconcile/NavbarDomainPill.tsx`, `engine/useReconciliationEngine.ts`, `engine/types.ts`, all adapter navbar-utils
- **Problem**: Two issues: (1) Radix Collapsible only supports vertical expand, not horizontal. (2) Engine stored `item.section` (display name like "Domain 1: Bias...") but navbar compared against section keys ("domain1") -- they never matched.
- **Fix**: Replaced Radix Collapsible with CSS `max-width` transition. Added `sectionKey` field to `ReconciliationNavItem`. All adapters and navbar-utils now use `sectionKey` consistently.
- [x] Fixed

### B4. PreliminaryPage Y.Text value bleeding between fields
- **Files**: `components/project/reconcile-tab/rob2-reconcile/pages/PreliminaryPage.tsx`, `adapter.tsx`
- **Problem**: When navigating between preliminary text field pages, the `onFinalChange` closure captured the new field's key but the effect fired with the old field's Y.Text value, writing it to the wrong field.
- **Fix**: Added `key={currentItem.key}` on PreliminaryPage in the adapter (forces remount per field). Used `useEffectEvent` for the sync callback to avoid stale closures.
- [x] Fixed

### B5. Aim selection clearing text fields in ROB2 checklist
- **Files**: `components/checklist/ROB2Checklist/PreliminarySection.tsx`
- **Problem**: All preliminary handlers spread `...preliminaryState` when updating, overwriting Y.Text fields with stale/empty string values. Clicking the aim radio after typing text wiped the text.
- **Fix**: Changed handlers to only send the changed field (e.g. `{ aim: value }` instead of `{ ...preliminaryState, aim: value }`). The ROB2 handler's `updateAnswer` already does field-level merging.
- [x] Fixed

### B6. Presence not working in ROB2 reconciliation
- **Files**: `project/ConnectionPool.ts`
- **Problem**: `getAwareness` was a method on the `ConnectionPool` class but was not included in `buildOpsMap`. `ReconciliationWrapper` destructured it from the ops map and got `undefined`.
- **Fix**: Added `getAwareness` to the flat ops map in `buildOpsMap`.
- [x] Fixed

### B7. ROB2 e2e test only smoke-tested reconciliation
- **Files**: `e2e/rob2-workflow.spec.ts`
- **Problem**: Test verified reconciliation page loaded but never clicked "Use This", navigated through items, or saved. Would not have caught B2, B3, B4, or B5.
- **Fix**: Extended test to walk through all 34 reconciliation items (clicking "Use This", selecting directions, checking sources), verify summary, save, and confirm finalization.
- [x] Fixed

---

## P0: Critical Performance

### 1. Duplicate `/api/auth/get-session` on every page load

- **Files**: `stores/adminStore.ts`, `components/layout/AppNavbar.tsx`, `components/layout/ImpersonationBanner.tsx`
- **Problem**: `checkAdminStatus` and `checkImpersonationStatus` both independently fetch the same session endpoint on mount. Every page load fires two identical requests.
- **Fix**: Merge into a single `checkSessionStatus()` that reads `user.role` and `session.impersonatedBy` from one request.
- [ ] Status

### 2. `persistStats` serializes all project stats to localStorage on every Yjs update

- **Files**: `stores/projectStore.ts:88-93`
- **Problem**: `syncFromYDoc` fires on every remote Yjs operation (including keystrokes), triggering `JSON.stringify` of the entire `projectStats` record unconditionally.
- **Fix**: Debounce `persistStats` (~500ms), or diff-check before writing.
- [-] Partially fixed (moved outside Immer produce in B2, but still not debounced)

### 3. Unstable `useProject` return object busts `ProjectContext` memo

- **Files**: `primitives/useProject/index.js`, `components/project/ProjectContext.tsx`
- **Problem**: Every render creates a new operations object, defeating the context value and re-rendering all consumers.
- **Fix**: Stabilize structurally -- split context, use refs for operation forwarders, or restructure so the context value identity is stable. No `useMemo`.
- [-] No longer applicable -- `useProject` primitive replaced with ConnectionPool pattern

---

## P1: Critical Code Quality

### 4. Duplicate online status tracking

- **Files**: `hooks/useOnlineStatus.ts`, `stores/authStore.ts:42,156,488-489`
- **Problem**: Two independent event listener subscriptions for the same browser event, used by different components. Can diverge.
- **Fix**: Remove `useOnlineStatus.ts`, use the store's `isOnline` everywhere.
- [ ] Status (still exists -- `useOnlineStatus.ts` used in 4 components)

### 5. `getDomainError` duplicated in `queryClient.ts` and `error-utils.ts`

- **Files**: `lib/queryClient.ts:23-30`, `lib/error-utils.ts:247-255`
- **Problem**: Two independent implementations. `queryClient.ts` variant also drops the `isDomainError` fallback.
- **Fix**: `queryClient.ts` should import from `error-utils.ts`.
- [ ] Status

### 6. Three different "is subscription active" definitions

- **Files**: `lib/access.ts:10`, `lib/entitlements.ts:26`, `hooks/useSubscription.ts:59`
- **Problem**: `hasActiveAccess` checks only `active`. `isSubscriptionActive` checks `active/trialing/past_due`. `useSubscription` checks `active/trialing`. Possible latent bug.
- **Fix**: Consolidate around `isSubscriptionActive` from `entitlements.ts`.
- [ ] Status

### 7. `Dashboard.tsx` uses `window.location.href` instead of TanStack Router

- **Files**: `components/dashboard/Dashboard.tsx:61-71`
- **Problem**: Full-page navigations bypass the SPA router, killing client state.
- **Fix**: Use `useNavigate()` or `<Link>`.
- [ ] Status

### 8. `verifyTwoFactorSetup` and `verifyTwoFactor` are identical

- **Files**: `stores/authStore.ts:388-425`
- **Problem**: Both call `authClient.twoFactor.verifyTotp({ code })` then `broadcastAuthChange()` with zero behavioral difference.
- **Fix**: Consolidate into a single `verifyTotp(code)`.
- [ ] Status

### 9. `signinWithGoogle` and `signinWithOrcid` share 90% identical code

- **Files**: `stores/authStore.ts:210-254`
- **Problem**: Identical `callbackURL`/`errorURL` construction. Only difference is provider method and constant.
- **Fix**: Extract `signinWithProvider(provider, loginMethod, callbackPath)`.
- [ ] Status

---

## P2: Shared Utilities (extract and consolidate)

### 10. `formatDate` copy-pasted in files

- **Files**: `LocalChecklistItem.tsx`, `InvoicesList.tsx`, `SubscriptionCard.tsx`
- **Problem**: Hand-rolled `formatDate` variants across files.
- **Fix**: Extract shared `formatDate` utility to `lib/formatUtils.ts`.
- [ ] Status (reduced from 11+ to 3 files -- many admin copies may have been cleaned up during JS->TS migration)

### 11. `formatCurrency` / `formatUsd` implemented 5 different ways

- **Files**: `InvoicesList.tsx`, `AnalyticsSection.tsx`, `billing.stripe-tools.tsx`, `PricingTable.tsx`, `pricing.tsx`
- **Problem**: Inconsistent cents-vs-dollars handling is a latent bug.
- **Fix**: Create `lib/formatCurrency.ts` with `formatCents()` and `formatDollars()`.
- [ ] Status

### 12. `formatFileSize` re-implemented in 3 frontend files

- **Files**: `PdfListItem.tsx`, `admin/storage.tsx`, `api/google-drive.ts`
- **Problem**: `@corates/shared` has a version but it only covers up to MB.
- **Fix**: Extend shared version to cover GB, use it everywhere.
- [ ] Status

### 13. `handleCopy` clipboard pattern in 5 admin files

- **Files**: `admin/users.$userId.tsx`, `admin/projects.$projectId.tsx`, `admin/billing.stripe-tools.tsx`, `admin/billing.ledger.tsx`, `SubscriptionList.tsx`
- **Problem**: Identical clipboard-copy-with-toast pattern, 5 copies.
- **Fix**: Extract `useClipboardCopy()` hook.
- [ ] Status

### 14. `formatDateInput` duplicated between `SubscriptionDialog.tsx` and `orgs.$orgId.tsx`

- **Problem**: Character-for-character identical datetime-local formatting.
- **Fix**: Share via import or move to admin utility file.
- [ ] Status

---

## P3: Checklist Duplication (ROB2 / ROBINS-I)

### 15. `SignallingQuestion.tsx` near-identical across ROB2 and ROBINS-I

- **Fix**: Merge into shared component with `getTextFn` prop and optional `showNote` boolean.
- [ ] Status

### 16. `ScoringSummary.tsx` shares identical `ResourceLink`/`ResourcesDialog` subcomponents

- **Fix**: Lift `ResourceLink`/`ResourcesDialog` to `components/checklist/common/`.
- [ ] Status

### 17. `ROB2AnswerPanel` / `RobinsAnswerPanel` near-duplicate

- **Fix**: Unify into shared base component parameterized by checklist type.
- [ ] Status

### 18. `DirectionPanel` near-duplicate across ROB2 and ROBINS-I

- **Fix**: Unify with checklist-type-parameterized base.
- [ ] Status

### 19. `NavbarDomainPill` / `QuestionPill` copy-pasted

- **Fix**: Extract shared pill components.
- [ ] Status

---

## P4: Efficiency Improvements

### 20. `SubscriptionDialog` has 18 props with 9 onChange callbacks

- **Fix**: Internalize form state, expose single `onSubmit(formData)`.
- [ ] Status

### 21. Four separate linear scans of studies for tab badges

- **Files**: `components/project/ProjectView.tsx:230-243`
- **Fix**: Single derived computation for all four counts in one pass. Plain values, no `useCallback`.
- [ ] Status

### 22. 1-second interval unconditionally re-renders reconciliation

- **Files**: `hooks/useReconciliationPresence.ts:132-148`
- **Fix**: Only tick when active cursors exist. Consider `useDeferredValue` for cursor list.
- [ ] Status

### 23. `loadCachedAuth()` called twice at module init

- **Files**: `stores/authStore.ts:157,479`
- **Fix**: Second call should read from `useAuthStore.getState().cachedUser`.
- [ ] Status

### 24. `adminStore.ts` repeated query invalidation pairs

- **Files**: `stores/adminStore.ts:210-296`
- **Problem**: 8 functions each end with identical `invalidateQueries` calls.
- **Fix**: Extract `invalidateOrgBillingQueries(orgId)` helper.
- [ ] Status

### 25. `orgNotFound` duplicates `.find()` already done for `currentOrg`

- **Files**: `hooks/useOrgContext.ts:40-56`
- **Fix**: Derive `orgNotFound` from `currentOrg === null`. Plain const, no `useMemo`.
- [ ] Status
