# Y.js Sync Pipeline: Targeted Fixes

Alternative to `yjs-sync-pipeline-redesign-a.md`. Same problems, different approach: fix the bottlenecks instead of replacing the architecture.

**Status**: Draft
**Date**: 2026-03-28
**Scope**: `packages/landing` sync infrastructure
**Replaces**: `yjs-sync-pipeline-redesign-a.md`

---

## Table of Contents

1. [Critique of the Redesign RFC](#critique-of-the-redesign-rfc)
2. [Approach](#approach)
3. [Fix 1: Scoped Observation](#fix-1-scoped-observation)
4. [Fix 2: Per-Study Dirty Tracking](#fix-2-per-study-dirty-tracking)
5. [Fix 3: Type the Operations Interface](#fix-3-type-the-operations-interface)
6. [Fix 4: Remove Dead Indirection](#fix-4-remove-dead-indirection)
7. [What Does Not Change](#what-does-not-change)
8. [Migration Plan](#migration-plan)
9. [Risk Assessment](#risk-assessment)

---

## Critique of the Redesign RFC

The redesign RFC (`yjs-sync-pipeline-redesign-a.md`) correctly identifies these problems:

1. Full-tree extraction on every Y.Doc change (O(n) per keystroke)
2. Type erasure in `buildOpsMap` / `ConnectionOps`
3. `ConnectionPool` as a god object
4. `JSON.stringify` equality as an O(n) band-aid

But the proposed solution -- domain collections, typed handles, a three-layer architecture (Session/Document/React), six migration phases touching 36+ files and 73 components -- has problems of its own:

**The handles are indirection, not abstraction.** Every method on `ChecklistHandle` is a 1:1 passthrough to the underlying ops. The "type safety" argument is weak because the underlying ops already have typed interfaces (`ChecklistOperations`). The fix for `buildOpsMap` erasing those types is to stop erasing them, not to add a wrapper class.

**The core performance claim is overstated.** The RFC goes from "rebuild all studies" to "rebuild one study" and presents it as O(1). But `buildStudySnapshot` still iterates all checklists, PDFs, and annotations for the changed study. A keystroke in a checklist answer triggers a full study rebuild including siblings. The actual implementation proved this: `StudiesCollection` has `if (!this.snapshots.has(studyId) || true)` -- the `|| true` means path-based diffing was abandoned and every event triggers a full study rebuild anyway.

**`observeDeep` path assumptions are fragile.** The RFC acknowledges this as "medium risk" but underestimates it. Multi-key transactions produce multiple events with different paths that need careful deduplication. The implementation fell back to always rebuilding, which defeats the stated purpose.

**Reference equality leaks through arrays.** Even if study-456's snapshot object is stable, the `sortedList` array that `useStudies()` returns is invalidated when study-123 changes (the RFC nulls it and rebuilds). Any component mapping over studies re-renders because the array reference changed. This is the same problem the RFC criticizes in the current design, moved one level down.

**The migration is a rewrite disguised as incremental.** Six phases, 11 deleted files, every component touched. Phase 3 (handles) is pure indirection until Phase 4 absorbs the factories. Between phases 3 and 4 there are three ways to access data (Zustand selectors, connectionPool ops, handle wrappers). If the migration stalls, you have added complexity without removing any.

**`ProjectDocument` replaces one god object with another.** It owns collections (reactive reads), handles (typed mutations), and project-level commands. Same responsibilities as `ConnectionPool`, different name.

---

## Approach

Instead of replacing the architecture, fix the four specific bottlenecks:

| Problem                              | Fix                                             | Files Touched                              |
| ------------------------------------ | ----------------------------------------------- | ------------------------------------------ |
| Full-tree extraction on every change | Scoped `observeDeep` per top-level Y.Map        | `sync.ts`, `ConnectionPool.ts`             |
| O(n) rebuild within `doSync`         | Per-study snapshot cache with dirty tracking    | `sync.ts`                                  |
| `JSON.stringify` equality            | Reference equality via cached snapshots         | `projectStore.ts`                          |
| Type erasure in `buildOpsMap`        | Delete `buildOpsMap`, expose typed ops directly | `ConnectionPool.ts`, consumers of `.get()` |
| Unnecessary indirection layers       | Delete thin action wrappers, delete handles     | Action modules, handle files               |

Total: ~5 files significantly changed, ~5 thin files deleted. Zero component API changes for the performance fixes. Typed ops require updating consumers of `connectionPool.get()` (15 files, mechanical find-and-replace).

---

## Fix 1: Scoped Observation

### Problem

`ConnectionPool.initializeConnection` binds a single handler to `ydoc.on('update')`:

```typescript
// ConnectionPool.ts:119-125
const syncUpdateHandler = () => {
  if (!entry.isLoadingPersistedState) {
    entry.syncManager?.syncFromYDoc();
  }
};
ydoc.on('update', syncUpdateHandler);
```

This fires on every Y.Doc change, triggering `doSync()` which walks the entire tree: all studies, all checklists, all PDFs, all annotations, all members, all meta.

### Fix

Replace the single `ydoc.on('update')` handler with three scoped observers in `createSyncManager`:

```typescript
export function createSyncManager(projectId: string, getYDoc: () => Y.Doc | null): SyncManager {
  let pendingSync = false;
  let dirtySlices = { studies: false, members: false, meta: false };

  function attach(ydoc: Y.Doc): (() => void)[] {
    const reviewsMap = ydoc.getMap('reviews');
    const membersMap = ydoc.getMap('members');
    const metaMap = ydoc.getMap('meta');

    const onReviews = () => {
      dirtySlices.studies = true;
      scheduleSync();
    };
    const onMembers = () => {
      dirtySlices.members = true;
      scheduleSync();
    };
    const onMeta = () => {
      dirtySlices.meta = true;
      scheduleSync();
    };

    reviewsMap.observeDeep(onReviews);
    membersMap.observe(onMembers); // flat, no need for observeDeep
    metaMap.observeDeep(onMeta);

    return [
      () => reviewsMap.unobserveDeep(onReviews),
      () => membersMap.unobserve(onMembers),
      () => metaMap.unobserveDeep(onMeta),
    ];
  }

  function scheduleSync(): void {
    if (pendingSync) return;
    pendingSync = true;
    requestAnimationFrame(() => {
      pendingSync = false;
      doSync();
    });
  }

  function doSync(): void {
    const ydoc = getYDoc();
    if (!ydoc) return;

    const updates: Partial<ProjectData> = {};

    if (dirtySlices.studies) {
      updates.studies = syncStudies(ydoc);
    }
    if (dirtySlices.members) {
      updates.members = buildMembersList(ydoc.getMap('members'));
    }
    if (dirtySlices.meta) {
      updates.meta = syncMeta(ydoc);
    }

    // Reset dirty flags before store update
    dirtySlices = { studies: false, members: false, meta: false };

    if (Object.keys(updates).length > 0) {
      useProjectStore.getState().setProjectData(projectId, updates);
    }
  }

  // ...
}
```

When a checklist answer changes, only `dirtySlices.studies` is set. Members and meta are never rebuilt. The RAF batching remains -- if multiple slices change within the same frame, they are combined into one `setProjectData` call.

### Why scoped observe instead of `ydoc.on('update')`

`ydoc.on('update')` provides a binary diff (Uint8Array). You cannot determine what changed without decoding it. Y.Map `observeDeep` provides structured events with paths that identify the changed subtree. This is what enables Fix 2.

### ConnectionPool change

Remove the `ydoc.on('update', syncUpdateHandler)` binding from `initializeConnection`. Instead, `createSyncManager` calls `attach(ydoc)` internally and returns cleanup functions. The `isLoadingPersistedState` guard moves into the sync manager (the sync manager can expose a `pause()`/`resume()` pair or an `isLoading` flag).

---

## Fix 2: Per-Study Dirty Tracking

### Problem

Even with scoped observation (Fix 1), `syncStudies` still walks all studies:

```typescript
// Current: iterates every study on every change
for (const [studyId, studyYMap] of studiesMap.entries()) {
  studiesList.push(buildStudyFromYMap(studyId, ...));
}
```

This is the actual hotspot. A project with 50 studies rebuilds all 50 snapshots when one checklist answer changes.

### Fix

Maintain a `Map<string, StudyInfo>` cache inside the sync manager. Use `observeDeep` event paths to identify which studies changed. Only rebuild dirty studies.

```typescript
const studyCache = new Map<string, StudyInfo>();
let sortedStudies: StudyInfo[] = [];

function handleReviewsEvents(events: Y.YEvent<any>[]): void {
  const reviewsMap = getYDoc()?.getMap('reviews');
  if (!reviewsMap) return;

  const dirtyStudyIds = new Set<string>();
  let structuralChange = false; // study added or removed

  for (const event of events) {
    if (event.path.length === 0 && 'keys' in event) {
      // Top-level: studies added/removed
      structuralChange = true;
      for (const [key, info] of (event as Y.YMapEvent<unknown>).keys) {
        dirtyStudyIds.add(key);
      }
    } else if (event.path.length > 0) {
      // Nested: something inside a specific study changed
      dirtyStudyIds.add(event.path[0] as string);
    }
  }

  // Rebuild only dirty studies
  for (const studyId of dirtyStudyIds) {
    const studyYMap = reviewsMap.get(studyId) as Y.Map<unknown> | undefined;
    if (studyYMap) {
      const studyData = studyYMap.toJSON ? studyYMap.toJSON() : {};
      studyCache.set(studyId, buildStudyFromYMap(studyId, studyData, studyYMap));
    } else {
      studyCache.delete(studyId);
    }
  }

  // Handle removals: clean up cached entries for deleted studies
  if (structuralChange) {
    for (const cachedId of studyCache.keys()) {
      if (!reviewsMap.has(cachedId)) {
        studyCache.delete(cachedId);
      }
    }
  }

  // Rebuild sorted array only if something changed
  if (dirtyStudyIds.size > 0 || structuralChange) {
    sortedStudies = [...studyCache.values()].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  }
}

function syncStudies(ydoc: Y.Doc): StudyInfo[] {
  // On the first sync (cache empty), populate from scratch
  if (studyCache.size === 0) {
    const reviewsMap = ydoc.getMap('reviews');
    for (const [studyId, studyYMap] of reviewsMap.entries()) {
      const ymap = studyYMap as Y.Map<unknown>;
      const studyData = ymap.toJSON ? ymap.toJSON() : {};
      studyCache.set(studyId, buildStudyFromYMap(studyId, studyData, ymap));
    }
    sortedStudies = [...studyCache.values()].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  }
  return sortedStudies;
}
```

### How dirty tracking and scoped observation interact

The `observeDeep` callback on `reviews` receives the events array directly. The callback both (a) extracts dirty study IDs from `event.path` and (b) sets `dirtySlices.studies = true`. When `doSync()` fires on the next RAF, it calls `syncStudies()` which returns the already-updated `sortedStudies` array.

More precisely:

1. Y.Doc transaction commits.
2. `reviewsMap.observeDeep` fires synchronously with events.
3. `handleReviewsEvents(events)` rebuilds only dirty studies in `studyCache`, updates `sortedStudies`.
4. The same callback sets `dirtySlices.studies = true` and calls `scheduleSync()`.
5. On the next animation frame, `doSync()` sees `dirtySlices.studies === true`, calls `syncStudies()` which returns the precomputed `sortedStudies`.
6. Store receives the update. Unchanged studies have stable object references.

### Reference equality follows naturally

When study-123's checklist answer changes:

- `buildStudyFromYMap` creates a new `StudyInfo` object for study-123
- `studyCache.get('study-456')` returns the exact same object reference as before
- `sortedStudies` is a new array (unavoidable), but the individual study objects inside it have stable references for unchanged studies
- `selectStudy(state, projectId, 'study-456')` returns the same object -- React skips the re-render

This is the same granularity the redesign RFC claims, without collections, without `useSyncExternalStore`, without changing any component code.

### The sorted array problem

The `sortedStudies` array is a new reference on every change. Components that call `selectStudies` and iterate the array will re-render. This is the same as today.

Two mitigations, both optional:

1. Components that render individual studies should use `selectStudy(state, projectId, studyId)` instead of mapping over `selectStudies`. This already works with the current selector.
2. If array stability becomes a measured problem, the store setter can check whether the array contents actually changed (shallow element comparison, not `JSON.stringify`).

Neither is required for the initial fix. The big win is not rebuilding 49 untouched studies on every keystroke.

### What about sub-study granularity?

The redesign RFC's `StudiesCollection` also rebuilds the full study on any nested change. The implementation confirmed this with the `|| true` guard. Going finer (per-checklist dirty tracking) is possible but not worth the complexity:

- Most components that display study data need multiple fields (name, checklists, reviewers). Per-checklist caching would mean reassembling the study view from fragments.
- The actual cost of `buildStudyFromYMap` for one study is small (iterate 2-3 checklists, a few PDFs). The problem was doing it for 50 studies, not for one.
- If profiling later shows single-study rebuilds are slow for studies with many checklists, the cache can be extended to per-checklist snapshots within the study without any API changes.

---

## Fix 3: Type the Operations Interface

### Problem

`ConnectionPool.buildOpsMap()` returns `Record<string, (...args: any[]) => any>`, actively destroying the type information that the operation factories already provide:

```typescript
// ConnectionPool.ts:310-311
private buildOpsMap(entry: ConnectionEntry): ConnectionOps {
  const chk = entry.checklistOps as any;
  return {
    createChecklist: (...args: any[]) => chk?.createChecklist(...args),
    // ... 30 more lines of the same pattern
  };
}
```

The factories are already typed. `ChecklistOperations` has full signatures. `buildOpsMap` takes those typed functions and wraps each one in an `any`-typed lambda.

### Fix

Delete `buildOpsMap`, delete `opsRegistry`, delete the `ConnectionOps` type. Expose the typed operations directly from `ConnectionEntry`.

**Step 1: Define a typed operations interface.**

```typescript
// ConnectionPool.ts

export interface TypedProjectOps {
  study: StudyOperations;
  checklist: ChecklistOperations;
  pdf: PdfOperations;
  reconciliation: ReconciliationOperations;
  annotation: AnnotationOperations;
  outcome: OutcomeOperations;
  getAwareness: () => Awareness | null;
}
```

Each of these interfaces already exists in the respective factory file (`ChecklistOperations` in `checklists/index.ts`, etc.). If some are missing, define them in the factory file where the implementation lives.

**Step 2: Replace `get()` with typed access.**

```typescript
// Before
get(projectId: string): ConnectionOps | null {
  return this.opsRegistry.get(projectId) || null;
}

// After
getOps(projectId: string): TypedProjectOps | null {
  const entry = this.registry.get(projectId);
  if (!entry?.initialized) return null;
  return {
    study: entry.studyOps,
    checklist: entry.checklistOps!,
    pdf: entry.pdfOps,
    reconciliation: entry.reconciliationOps,
    annotation: entry.annotationOps,
    outcome: entry.outcomeOps,
    getAwareness: () => entry.connectionManager?.getAwareness() || null,
  };
}
```

**Step 3: Delete `buildOpsMap`, `opsRegistry`, `ConnectionOps`.**

These are now dead code.

**Step 4: Update consumers.**

The 15 files that call `connectionPool.get(projectId)` or `connectionPool.getActiveOps()` change from:

```typescript
const ops = connectionPool.get(projectId);
ops?.updateChecklist(studyId, checklistId, updates);
```

To:

```typescript
const ops = connectionPool.getOps(projectId);
ops?.checklist.updateChecklist(studyId, checklistId, updates);
```

This is a mechanical find-and-replace. Every call site gains full IDE autocompletion and compile-time type checking.

### Why not wrapper handles?

The redesign RFC proposed `ChecklistHandle` classes that wrap the ops and bind `studyId`/`checklistId`. This is delegation, not abstraction. Problems:

- Creates a new object per render (even with `useMemo`, identity is per-parent)
- Holds a reference to `entry.checklistOps` that can go stale on reconnection
- Two parents requesting the same `(studyId, checklistId)` get different object instances
- The "typed" `snapshot()` returns `Record<string, unknown>` -- no real type improvement over what already exists

If `studyId`/`checklistId` repetition is a problem in a specific component, a local destructured helper does the same job without a class or a hook. But in practice, editor components have `studyId` and `checklistId` in scope already. Passing them to each call is explicit and readable.

---

## Fix 4: Remove Dead Indirection

### The `project/actions/` layer

The action modules in `project/actions/` follow this pattern:

```typescript
export const checklistActions = {
  update(studyId, checklistId, updates) {
    const ops = connectionPool.getActiveOps();
    if (!ops) throw new Error('No active project connection');
    try {
      ops.updateChecklist(studyId, checklistId, updates);
    } catch (err) {
      console.error('Error updating checklist:', err);
      showToast.error('Update Failed', 'Failed to update checklist');
    }
  },
};
```

This adds one thing: a try/catch with a toast notification. It does not add domain logic. The call chain is:

```
Component
  -> project.checklist.update(studyId, checklistId, updates)
    -> checklistActions.update(...)
      -> connectionPool.getActiveOps()        // returns untyped flat map
        -> ops.updateChecklist(...)            // untyped wrapper lambda
          -> entry.checklistOps.updateChecklist(...)  // actual typed method
            -> Y.Map.set()
```

That is four layers between the component and the Y.Doc mutation. After Fix 3 deletes `buildOpsMap`, it would be three. The thin action modules can be eliminated to make it two:

```
Component
  -> connectionPool.getOps(projectId).checklist.updateChecklist(...)
    -> Y.Map.set()
```

### Which action modules to delete

| Module              | Lines | Real Logic?                                                              | Verdict                  |
| ------------------- | ----- | ------------------------------------------------------------------------ | ------------------------ |
| `checklists.ts`     | 82    | No. Try/catch + toast only.                                              | Delete.                  |
| `outcomes.ts`       | ~40   | No. Same pattern.                                                        | Delete.                  |
| `reconciliation.ts` | ~30   | No. Same pattern.                                                        | Delete.                  |
| `members.ts`        | ~30   | No. Same pattern.                                                        | Delete.                  |
| `project.ts`        | ~30   | No. Forwards to studyOps rename/description.                             | Delete.                  |
| `pdfs.ts`           | ~60   | Minor. Wraps upload + R2 delete.                                         | Keep or inline.          |
| `studies.ts`        | 443   | Yes. Batch import, PDF upload, Google Drive import, metadata extraction. | Keep. Real domain logic. |

`studies.ts` is the only action module with logic worth keeping. The rest are forwarding functions. Their error handling (try/catch + toast) can either move to the component or to a thin shared utility if the pattern is common enough.

### The handle classes (in-progress work from RFC-A)

The staged files on the current branch (`handles/ChecklistHandle.ts`, `handles/AnnotationHandle.ts`, `handles/PdfHandle.ts`, `handles/ReconciliationHandle.ts` and their corresponding hooks) are pure delegation wrappers that were part of the redesign RFC. They should not be merged. They add a layer without removing one.

---

## What Does Not Change

| Component                        | Status                                                                                                                           |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `ConnectionPool.ts`              | Stays. Loses `buildOpsMap` and `opsRegistry` (~60 lines). Gains `getOps()` returning typed interface (~15 lines). Net reduction. |
| `connectionReducer.ts`           | Unchanged. Clean state machine.                                                                                                  |
| `connection.ts`                  | Unchanged. WebSocket management.                                                                                                 |
| `projectStore.ts` selectors      | Unchanged. `selectStudies`, `selectStudy`, `selectMembers`, `selectMeta`, `selectConnectionPhase` all continue to work.          |
| `projectStore.ts` shape          | Unchanged. `projects` map, `connections`, `projectStats` all stay.                                                               |
| Component data access (reads)    | Unchanged. Components still call `useProjectStore(s => selectStudies(s, projectId))`.                                            |
| Operation factories              | Unchanged. `createChecklistOperations`, etc. remain the logic layer.                                                             |
| Checklist type handlers          | Unchanged. `AMSTAR2Handler`, `ROB2Handler`, `ROBINSIHandler` remain.                                                             |
| `extractAnswersFromYMap`         | Stays in `sync.ts`. Called per-study now instead of for all studies, but the function itself does not change.                    |
| Y.Doc structure                  | Unchanged. Same maps, same nesting.                                                                                              |
| ProjectDoc (Durable Object)      | Unchanged. Server-side improvements (alarm-based persistence, incremental updates) are orthogonal and can be done independently. |
| Zustand as the React integration | Stays. No `useSyncExternalStore`, no React context for session. Components subscribe to the same store with the same selectors.  |

---

## Migration Plan

Three phases, each independently shippable. Each phase is a single PR. No coexistence period, no dual-path reads.

### Phase 1: Scoped Observation + Dirty Tracking (Fixes 1 and 2)

**Goal**: Fix the performance problem. Zero component changes.

**Changes**:

1. Refactor `createSyncManager` (in `sync.ts`):
   - Add `attach(ydoc)` method that sets up scoped observers on `reviews`, `members`, `meta`
   - Add per-study `Map<string, StudyInfo>` cache
   - `observeDeep` on `reviews` extracts dirty study IDs from `event.path`
   - `doSync()` only rebuilds dirty studies, passes unchanged snapshots by reference
   - Return cleanup functions from `attach()`
   - Add `pause()` / `resume()` for the `isLoadingPersistedState` guard

2. Update `ConnectionPool.initializeConnection`:
   - Replace `ydoc.on('update', syncUpdateHandler)` with `syncManager.attach(ydoc)`
   - Replace `isLoadingPersistedState` flag with `syncManager.pause()` / `syncManager.resume()`

3. Update `projectStore.setProjectData`:
   - Remove `JSON.stringify` equality checks for `studies`, `meta`, `members`
   - Just set the values directly. With cached snapshots providing reference stability, Zustand's built-in `Object.is` selector comparison handles the rest at the component level.

4. Initial sync: the first `doSync()` call populates the study cache from scratch (same as current behavior). Subsequent calls are incremental.

**Files changed**: `sync.ts` (bulk of changes), `ConnectionPool.ts` (~5 lines), `projectStore.ts` (~6 lines).

**Validation**:

- `pnpm --filter landing test` (unit tests)
- `pnpm --filter landing test:browser` (E2E)
- Manual: open a 20+ study project, edit a checklist answer, verify via React DevTools that only the edited study's component subtree re-renders
- Profile: compare before/after for `doSync` execution time on a 50-study project

**Risk**: Low. The data flow to components is identical. The store receives the same `StudyInfo[]` shape. The only difference is that unchanged studies keep their object reference.

### Phase 2: Type the Operations Interface (Fix 3)

**Goal**: Full type safety for all Y.Doc mutations. Mechanical refactor.

**Changes**:

1. Audit operation factories for exported interfaces:
   - `ChecklistOperations` in `checklists/index.ts` -- exists
   - `StudyOperations`, `PdfOperations`, `ReconciliationOperations`, `AnnotationOperations`, `OutcomeOperations` -- verify or create

2. Define `TypedProjectOps` in `ConnectionPool.ts`.

3. Add `getOps(projectId): TypedProjectOps | null` method.

4. Update all consumers of `connectionPool.get()` / `connectionPool.getActiveOps()`:
   - `ops.updateChecklist(...)` becomes `ops.checklist.updateChecklist(...)`
   - `ops.addPdfToStudy(...)` becomes `ops.pdf.addPdfToStudy(...)`
   - Mechanical namespace change.

5. Delete `buildOpsMap`, `opsRegistry`, `ConnectionOps` type, old `get()` method.

**Files changed**: `ConnectionPool.ts`, ~15 consumer files (action modules + components that access ops directly).

**Validation**:

- `pnpm typecheck` (primary gate -- type errors reveal any missed call site)
- `pnpm --filter landing test`
- `pnpm --filter landing test:browser`

**Risk**: Low. Mechanical refactor. TypeScript catches every mistake at compile time.

### Phase 3: Remove Thin Action Wrappers (Fix 4)

**Goal**: Reduce indirection. Optional but recommended.

**Changes**:

1. Delete thin action modules: `checklists.ts`, `outcomes.ts`, `reconciliation.ts`, `members.ts`, `project.ts`.

2. Update components that called these actions to use `connectionPool.getOps()` directly.

3. Keep `studies.ts` -- update it to use `TypedProjectOps`.

4. If the try/catch + toast pattern repeats at 3+ call sites for the same operation, extract a utility:

   ```typescript
   function withToast<T>(fn: () => T, errorTitle: string): T | null {
     try {
       return fn();
     } catch (err) {
       console.error(err);
       showToast.error(errorTitle, (err as Error).message);
       return null;
     }
   }
   ```

5. Delete the staged handle files and handle hooks from the RFC-A work.

**Files changed**: 5 action modules deleted, ~10 consumer files updated.

**Validation**:

- `pnpm typecheck`
- `pnpm --filter landing test`
- `pnpm --filter landing test:browser`
- `grep -r "checklistActions\|outcomeActions\|reconciliationActions\|memberActions\|projectActions" src/` returns zero results

**Risk**: Low. No logic changes. Just removing forwarding functions.

---

## Risk Assessment

| Risk                                                        | Severity | Mitigation                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `observeDeep` event path incorrect for some Y.Doc structure | Medium   | Unit test: create Y.Doc, mutate a nested key, assert `event.path[0]` is the study ID. Y.js source confirms this behavior for nested Y.Maps.                                                                                                                   |
| Study cache gets stale (snapshot diverges from Y.Doc)       | Medium   | Cache is populated inside the `observeDeep` callback, which fires synchronously at end of Y.Doc transaction. No async gap. Also: `syncFromYDocImmediate()` can clear the cache and rebuild from scratch as a safety valve.                                    |
| `requestAnimationFrame` batching drops events               | Low      | `observeDeep` fires with accumulated events per transaction. The RAF deduplication only affects the store write, not the event collection. Dirty study IDs accumulate across RAF frames via the study cache (which is updated synchronously in the callback). |
| Consumers missed during `get()` to `getOps()` migration     | None     | `pnpm typecheck` catches every call site. `get()` is deleted, so any unconverted call is a compile error.                                                                                                                                                     |
| Performance regression from `observeDeep` overhead          | Low      | `observeDeep` is how Y.js recommends observing nested changes. The overhead is lazy path computation, which is far cheaper than the current full-tree `toJSON()` + `JSON.stringify` comparison. Profile in Phase 1 validation.                                |

---

## Comparison with Redesign RFC

|                                 | Redesign RFC (A)                                                          | Targeted Fixes (B)                                                    |
| ------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Files significantly changed     | 36+ across 6 phases                                                       | ~8 across 3 phases                                                    |
| Component API changes           | 73 components migrate to new hooks                                        | Zero for Phase 1. 15 files for Phase 2 (mechanical namespace change). |
| New abstractions introduced     | Collections, Handles, Sessions, SessionManager, Providers, SessionContext | None                                                                  |
| Abstractions removed            | sync.ts, projectStore selectors, ConnectionPool, action modules           | buildOpsMap, opsRegistry, ConnectionOps type, thin action modules     |
| Coexistence period              | Months (dual-path reads through Phases 1-3)                               | None. Each phase replaces in-place.                                   |
| Performance improvement         | O(1 study) per change                                                     | O(1 study) per change                                                 |
| Type safety improvement         | Handles with `Record<string, unknown>` snapshots                          | Typed ops with full `ChecklistOperations` etc. signatures             |
| Risk of stalling mid-migration  | High (Phase 3 is indirection until Phase 4 absorbs factories)             | Low (each phase is independently complete)                            |
| Total lines added (estimated)   | 1500+ (new abstractions)                                                  | ~200 (cache logic in sync.ts, typed interface)                        |
| Total lines removed (estimated) | 1200 (after full 6-phase migration)                                       | ~400 (buildOpsMap, thin wrappers, JSON.stringify checks)              |
