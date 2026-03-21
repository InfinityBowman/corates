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
- [ ] Status

### 3. Unstable `useProject` return object busts `ProjectContext` memo
- **Files**: `primitives/useProject/index.js`, `components/project/ProjectContext.tsx`
- **Problem**: Every render creates a new operations object, defeating the context value and re-rendering all consumers.
- **Fix**: Stabilize structurally -- split context, use refs for operation forwarders, or restructure so the context value identity is stable. No `useMemo`.
- [ ] Status

---

## P1: Critical Code Quality

### 4. Duplicate online status tracking
- **Files**: `hooks/useOnlineStatus.ts`, `stores/authStore.ts:42,156,488-489`
- **Problem**: Two independent event listener subscriptions for the same browser event, used by different components. Can diverge.
- **Fix**: Remove `useOnlineStatus.ts`, use the store's `isOnline` everywhere.
- [ ] Status

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

### 10. `formatDate` copy-pasted in 11+ files
- **Files**: 9 admin routes, `SubscriptionList.tsx`, `GrantList.tsx`, `UserTable.tsx`
- **Problem**: Each hand-rolls its own variant with subtle differences (seconds, timestamp multiplication).
- **Fix**: Extract `formatAdminDate(timestamp, options?)` to `lib/formatUtils.ts`.
- [ ] Status

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
