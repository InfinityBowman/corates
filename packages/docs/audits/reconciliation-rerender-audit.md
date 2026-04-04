# Reconciliation Rerender Audit

**Date:** 2026-04-03
**Scope:** Two concurrent users reconciling and viewing the same study

## Verdict

No infinite rerender loop exists. All write-back cycles (effect -> Yjs write -> observer -> store -> render -> effect) converge within 1-2 cycles thanks to guards (`hasAutoFilled`, `hasValidFinalAnswer`, convergent duplicate detection). However, there are compounding performance issues that produce heavy render churn when two users are active simultaneously.

## How data flows through the reconciliation view

Understanding the full chain is necessary to evaluate the issues:

```
Yjs Y.Doc change (local or remote)
  -> reviewsMap.observeDeep (sync.ts:301)
  -> handleReviewsEvents: studyYMap.toJSON() rebuilds entire study (sync.ts:152)
  -> scheduleSync -> doSync -> setProjectData (sync.ts:258)
  -> Zustand store updates project.studies (projectStore.ts:137)
  -> selectStudy returns new object reference (projectStore.ts:222)
  -> ReconciliationWrapper memos fire:
       currentStudy -> checklist1Meta -> checklist1Data (calls getChecklistData -> toJSON())
       currentStudy -> checklist2Meta -> checklist2Data (calls getChecklistData -> toJSON())
       currentStudy -> reconciledChecklistMeta -> reconciledChecklistData (calls getChecklistData -> toJSON())
  -> ReconciliationEngine receives 3 new prop objects
  -> useReconciliationEngine recomputes: navItems, finalAnswers, comparison, summaryStats
  -> renderPage creates new handleFinalChange closure
  -> ReconciliationQuestionPage receives new finalAnswers + new onFinalChange
  -> "Initialize from props" effect fires -> setLocalFinal -> extra re-render
```

Every Yjs change to the study -- even an unrelated field -- triggers this entire chain for both clients. With two active users, every answer change by either user causes ~3 `toJSON()` calls plus a full memo cascade plus 2 renders of the question page on the other client.

## Issues found

### 1. Unconditional `setLocalFinal` on every `finalAnswers` reference change

**Files:**
- `packages/web/src/components/project/reconcile-tab/amstar2-reconcile/ReconciliationQuestionPage.tsx:89-104`
- `packages/web/src/components/project/reconcile-tab/amstar2-reconcile/MultiPartQuestionPage.tsx:80-103`

**Problem:**

The "Initialize from props" effect runs whenever the `finalAnswers` prop changes by reference. Because `finalAnswers` is derived from `reconciledChecklistData` which is rebuilt from `toJSON()` on every Yjs change, this effect fires on every remote update -- even updates to other questions. It unconditionally calls `setLocalFinal(JSON.parse(JSON.stringify(finalAnswers)))`, creating an extra re-render every time.

```js
// ReconciliationQuestionPage.tsx:89
useEffect(() => {
    if (finalAnswers) {
      setLocalFinal(JSON.parse(JSON.stringify(finalAnswers))); // always sets state
      // ... selectedSource logic
    }
}, [finalAnswers, reviewer1Answers, reviewer2Answers]);
```

**Impact:** With two users, every answer change by either user triggers 2 renders of the current question page on the other client (one from the prop change, one from `setLocalFinal`). This is the easiest fix with the highest per-interaction savings.

**Fix:** Add a structural equality check before setting state:

```js
useEffect(() => {
    if (finalAnswers) {
      if (!answersEqual(localFinal, finalAnswers)) {
        setLocalFinal(JSON.parse(JSON.stringify(finalAnswers)));
      }
      // ... selectedSource logic (also guard with comparison)
    }
}, [finalAnswers, reviewer1Answers, reviewer2Answers]);
```

The `answersEqual` function already exists in the same file. For `MultiPartQuestionPage`, use `multiPartEqual`.

---

### 2. Page clamp runs as `useEffect`, causing unmount/remount for ROB2/ROBINS-I

**File:** `packages/web/src/components/project/reconcile-tab/engine/useReconciliationEngine.ts:194-211`

**Problem:**

The clamp logic is a `useEffect`, which runs after the render commits. When `navItems` shrinks (ROB2 aim change synced from the other user), there is one render frame where `currentPage` exceeds `navItems.length - 1`:

```js
const currentItem = navItems[currentPage] ?? null;  // null for one frame

useEffect(() => {
    const clamped = Math.max(0, Math.min(currentPage, totalPages - 1));
    if (clamped !== currentPage) {
      setCurrentPage(clamped);  // fires after render
    }
}, [totalPages, currentPage]);
```

During that frame, `engineContext` becomes `null` (because `!engine.currentItem`), so `ReconciliationEngine.tsx:277` renders the "Loading..." fallback instead of `adapter.renderPage()`. This unmounts the question page component. On the next render (after clamp), the page remounts. Remounting resets `hasAutoFilled` to `false`, so the auto-fill effect can fire again, causing a spurious Yjs write.

This is not infinite (the auto-fill write does not change `navItems` length), but it is a wasted cycle: unmount -> remount -> auto-fill -> Yjs write -> re-render on both clients.

**Fix:** Derive the effective page synchronously so `currentItem` is never null due to a stale `currentPage`:

```js
const effectivePage = totalPages > 0
    ? Math.max(0, Math.min(currentPage, totalPages - 1))
    : currentPage;

// Persist the clamped value to state (for localStorage, awareness, etc.)
useEffect(() => {
    if (totalPages > 0 && effectivePage !== currentPage) {
      setCurrentPage(effectivePage);
    }
}, [totalPages, effectivePage, currentPage]);

const currentItem = navItems[effectivePage] ?? null;
```

Now `currentItem` is always valid when `navItems` is non-empty, preventing the unmount/remount gap.

---

### 3. `refreshTick` forces a re-render every second

**File:** `packages/web/src/hooks/useReconciliationPresence.ts:132-148, 304-308`

**Problem:**

A `setInterval` calls `setRefreshTick(Date.now())` every 1000ms, which forces `usersWithCursors` to recompute via its dependency on `refreshTick`. This re-renders `RemoteCursors` every second regardless of whether anything changed.

```js
useEffect(() => {
    const intervalId = setInterval(() => {
      setRefreshTick(Date.now());
    }, 1000);
    return () => clearInterval(intervalId);
}, []);

const usersWithCursors = useMemo(() => {
    void refreshTick; // force re-eval
    return remoteUsers.filter(user => user.cursor != null && user.currentPage === getCurrentPage);
}, [remoteUsers, getCurrentPage, refreshTick]);
```

**Fix:** Move stale cursor detection into `buildRemoteUsers` (which already runs on every awareness change) and remove the timer entirely:

```js
function buildRemoteUsers(aw, currentUserRef, checklistTypeRef) {
    const STALE_CURSOR_MS = 5000;
    const now = Date.now();
    // ... existing logic, then:
    const cursor = state.cursor;
    const isStaleCursor = cursor && (now - cursor.timestamp) > STALE_CURSOR_MS;

    states.push({
      // ...
      cursor: isStaleCursor ? null : cursor,
    });
}
```

Then `usersWithCursors` can drop the `refreshTick` dependency:

```js
const usersWithCursors = useMemo(() => {
    return remoteUsers.filter(user => user.cursor != null && user.currentPage === getCurrentPage);
}, [remoteUsers, getCurrentPage]);
```

Remove the `refreshTick` state and the `setInterval` entirely.

---

### 4. `selectStudy` returns unstable references on every store update

**File:** `packages/web/src/stores/projectStore.ts:217-225`

**Problem:**

The sync manager replaces `project.studies` with a new array on every Yjs change. `selectStudy` does `studies.find(...)` which returns a new object even if the study data is structurally identical. This is the root amplifier: one Yjs change to one field invalidates every memo that depends on `currentStudy` in `ReconciliationWrapper`.

The store already acknowledges this risk at line 169-171:
```js
// Stable fallback constants -- must be module-level so they're referentially equal
// across renders. Without these, selectors return new objects/arrays on every call
// when a project doesn't exist in the store, causing infinite re-render loops.
```

The fallback case is protected but the happy path is not.

**Fix (targeted - ReconciliationWrapper only):** Replace `selectStudy` usage with more granular selectors using `useShallow`:

```js
import { useShallow } from 'zustand/react/shallow';

// Instead of subscribing to the entire study:
// const currentStudy = useProjectStore(s => selectStudy(s, projectId, studyId));

// Subscribe to just what you need:
const checklist1Meta = useProjectStore(
    useShallow(s => {
      const study = selectStudy(s, projectId, studyId);
      if (!study?.checklists) return null;
      const c = study.checklists.find(c => c.id === checklist1Id);
      if (!c) return null;
      return { id: c.id, type: c.type, status: c.status, assignedTo: c.assignedTo,
               outcomeId: c.outcomeId, createdAt: c.createdAt };
    })
);
```

`useShallow` performs a shallow equality check on the returned value, so if the primitive fields did not change, the component does not re-render.

**Fix (structural - longer term):** Make the sync manager produce stable references. Instead of replacing the studies array wholesale, diff the incoming data against the cache and only emit changed studies. The `handleReviewsEvents` function already identifies dirty study IDs -- the missing step is returning a stable array reference when only non-subscribed studies changed.

---

### 5. Duplicate reconciled checklist detection re-runs on every `currentStudy` change

**File:** `packages/web/src/components/project/reconcile-tab/ReconciliationWrapper.tsx:341-371`

**Problem:**

This effect has `currentStudy` in its dependency array:

```js
useEffect(() => {
    if (!reconciledChecklistId || reconciledChecklistLoading || !currentStudy) return;
    const allReconciled = getInProgressReconciledChecklists(currentStudy).filter(...);
    if (allReconciled.length > 1) {
      // ... saveReconciliationProgress, setReconciledChecklistId
    }
}, [reconciledChecklistId, reconciledChecklistLoading, currentStudy, ...]);
```

Since `currentStudy` changes on every Yjs update (see issue 4), this effect re-runs constantly. Each run filters and sorts all checklists even though the reconciled checklist set almost never changes.

**Fix:** Add a ref to skip re-evaluation after the duplicate has been resolved:

```js
const hasResolvedDuplicateRef = useRef(false);

useEffect(() => {
    if (hasResolvedDuplicateRef.current) return;
    if (!reconciledChecklistId || reconciledChecklistLoading || !currentStudy) return;

    const allReconciled = getInProgressReconciledChecklists(currentStudy).filter(...);
    if (allReconciled.length <= 1) {
      hasResolvedDuplicateRef.current = true; // no conflict, stop checking
      return;
    }

    allReconciled.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const firstCreated = allReconciled[0];
    if (firstCreated.id !== reconciledChecklistId) {
      saveReconciliationProgress(...);
      setReconciledChecklistId(firstCreated.id);
    }
    hasResolvedDuplicateRef.current = true;
}, [reconciledChecklistId, reconciledChecklistLoading, currentStudy, ...]);
```

---

## What was ruled out

These patterns were investigated and confirmed safe:

- **Awareness broadcast loop:** Awareness is on a separate protocol from Y.Doc. Page changes broadcast awareness state, remote clients re-render `PresenceAvatars`, but `onUserClick` is user-initiated (click handler). No automatic feedback loop.

- **ROB2 `syncToFinalAnswers` effect (PreliminaryPage.tsx:316-319):** Writes Y.Text content to the Y.Map (checklist answers). The effect depends on `preliminaryText` (from `useYText`), which only changes when Y.Text content changes. The Y.Map write does not affect Y.Text content. No circular dependency.

- **Auto-fill effects in question pages:** All guarded by `hasAutoFilled` (boolean state) and `hasValidFinalAnswer` (checks for existing answer data). Both guards prevent re-firing after one successful fill. Converges in one cycle.

- **Reconciliation progress writes (reconciliation.ts):** `saveReconciliationProgress` writes to a separate `reconciliations` Y.Map under the study. This triggers the reviews observer, but the data written (checklist IDs, page numbers) does not affect `navItems`, `finalAnswers`, or `comparison`. No amplification.

- **Durable Object server-side amplification:** The DO broadcasts Y.Doc updates and awareness updates to all clients except the sender (`broadcastBinary` with `exclude`). No server-side duplication or echo.

## Priority

1. **Issue 1** - Guard `setLocalFinal` with structural equality. Smallest change, eliminates the extra render on every remote Yjs change. Affects both AMSTAR2 page components.
2. **Issue 2** - Synchronous page clamp. Fixes a real bug where ROB2/ROBINS-I pages can unmount/remount, causing spurious auto-fill writes.
3. **Issue 3** - Remove `refreshTick`. Eliminates 1Hz background overhead for everyone.
4. **Issue 5** - Guard duplicate detection with ref. Minor overhead reduction.
5. **Issue 4** - Stabilize `selectStudy` references. Addresses the root cause of the entire cascade but is a larger change. Can be done incrementally by switching `ReconciliationWrapper` to granular selectors first.
