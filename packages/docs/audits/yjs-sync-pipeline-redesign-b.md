# Y.js Sync Pipeline Architecture Redesign

## Context

The CoRATES Y.js sync pipeline has a critical architectural problem: every keystroke in a collaborative text field triggers **full Y.Doc tree extraction** (505 lines, O(n) traversal) followed by **JSON.stringify equality checks** (O(n) comparison) before pushing to a monolithic Zustand store. This makes the sync layer untestable, untyped, and slow for large projects.

Research into Zero Sync, TanStack DB, Convex, and Outline revealed that every mature sync library avoids this pattern. The redesign applies their key lessons:

- **Observe subtrees, not the whole doc** (Zero's IVM, Y.js native observeDeep)
- **Only extract what changed** (TanStack DB's per-collection differential dataflow)
- **Reference equality, not deep comparison** (Convex's shallow comparison)
- **Direct Y.Doc access for editors** (Outline's approach -- Y.Doc IS the state for editors)
- **Type safety end-to-end** (all four libraries)

## Architecture Overview

Two independent improvements, implementable in parallel:

### Part A: Reactive Collection Layer (replaces sync.ts)
### Part B: Typed Operations Layer (replaces untyped ops map)

---

## Part A: Reactive Collection Layer

Replaces `sync.ts` (505 lines) + the extraction half of `projectStore.ts`.

### Core Abstraction: YCollection\<T\>

A framework-agnostic class that observes a single Y.Map subtree via `observeDeep` and maintains a snapshot cache indexed by key.

```typescript
// packages/landing/src/lib/ycollections/collection.ts
class YCollection<T> {
  constructor(options: {
    rootMap: Y.Map<unknown>;
    extract: (key: string, ymap: Y.Map<unknown>) => T;
    shouldExtract?: (key: string, ymap: Y.Map<unknown>) => boolean;
  });

  getSnapshot(): ReadonlyMap<string, T>;    // stable ref if unchanged
  get(key: string): T | undefined;          // stable ref per-entry
  getArray(compareFn?): readonly T[];       // stable ref if unchanged
  subscribe(listener: () => void): () => void;
  destroy(): void;
  pause(): void;   // for Dexie state loading
  resume(): void;
}
```

**How change detection works:**
1. `rootMap.observeDeep(handler)` fires with `Y.YEvent[]`
2. Handler extracts affected top-level keys from `event.path[0]`
3. Only those keys are re-extracted (not all entries)
4. New snapshot compared to cached one -- if unchanged, no notification
5. Subscribers notified synchronously after Y.js transaction

**Three collections per project:**

| Collection | Y.Map source | Snapshot type | Volatility |
|---|---|---|---|
| `studies` | `ydoc.getMap('reviews')` | `StudySnapshot` | High (keystroke-level for active editors) |
| `members` | `ydoc.getMap('members')` | `MemberSnapshot` | Low (changes on member add/remove) |
| `meta` | `ydoc.getMap('meta')` | `MetaSnapshot` | Low (project rename, outcome changes) |

**Key optimization -- skip in-progress answer extraction:**

The current sync.ts extracts checklist answers only for FINALIZED checklists. The collection extractor preserves this: in-progress checklists get metadata-only snapshots (type, status, assignedTo, updatedAt). Editors access in-progress answers directly via Y.Doc handlers (`getChecklistAnswersMap`, `getTextRef`), which already bypass the store.

This means the most common event (typing in a checklist) triggers only a metadata-level extraction for that one study, not a full tree traversal.

### Extractors (ported from sync.ts)

```
packages/landing/src/lib/ycollections/extractors/
  study.ts           -- extractStudy(id, ymap) -> StudySnapshot (port of buildStudyFromYMap)
  member.ts          -- extractMember(id, ymap) -> MemberSnapshot (port of buildMembersList, per-entry)
  meta.ts            -- extractMeta(ymap) -> MetaSnapshot (port of meta extraction)
  checklist-answers/
    rob2.ts          -- extractROB2Answers(answersMap) -> Record<string, unknown>
    robins-i.ts      -- extractROBINSIAnswers(answersMap) -> Record<string, unknown>
    amstar2.ts       -- extractAMSTAR2Answers(answersMap) -> Record<string, unknown>
```

The 170-line `extractAnswersFromYMap` with 95% ROB2/ROBINS-I duplication splits into one file per checklist type. Each is a pure function: Y.Map in, plain JS out. Testable with simple Y.Doc fixtures.

### Integration Strategy (Zustand Bridge)

**Phase 1: Collections feed into existing Zustand store.** All 12+ store selector consumers continue working unchanged.

```typescript
// packages/landing/src/lib/ycollections/zustand-bridge.ts
function createZustandBridge(projectId: string, collections: ProjectCollections): () => void {
  // Subscribe to each collection independently
  // On change, call useProjectStore.getState().setProjectData(projectId, { studies })
  // Only the changed domain is passed (studies OR members OR meta)
}
```

**Phase 2: Direct `useSyncExternalStore` hooks.** Components migrate incrementally from `useProjectStore(selectStudies)` to `useStudies(projectId)`.

```typescript
// packages/landing/src/hooks/useStudies.ts
function useStudies(projectId: string): readonly StudySnapshot[] {
  const collections = useProjectCollections(projectId);
  return useSyncExternalStore(
    collections.studies.subscribe,
    () => collections.studies.getArray(byCreatedAt),
  );
}
```

### Wiring into ConnectionPool

```typescript
// In ConnectionPool.initializeConnection -- replaces SyncManager creation:
const collections = createProjectCollections(ydoc);
entry.collections = collections;
const teardownBridge = createZustandBridge(projectId, collections);
entry._cleanupHandlers.push(() => { teardownBridge(); collections.destroy(); });
```

The `ydoc.on('update', syncUpdateHandler)` global handler is removed. Collections use `observeDeep` internally.

### Files to Create

| File | Purpose | Lines (est.) |
|---|---|---|
| `lib/ycollections/collection.ts` | YCollection\<T\> class | ~120 |
| `lib/ycollections/singleton.ts` | YSingleton\<T\> for meta (single map, not keyed) | ~60 |
| `lib/ycollections/types.ts` | StudySnapshot, MemberSnapshot, MetaSnapshot, etc. | ~100 |
| `lib/ycollections/extractors/study.ts` | Port of buildStudyFromYMap | ~80 |
| `lib/ycollections/extractors/member.ts` | Port of buildMembersList (per-entry) | ~20 |
| `lib/ycollections/extractors/meta.ts` | Port of meta extraction | ~30 |
| `lib/ycollections/extractors/checklist-answers/rob2.ts` | ROB2 answer extraction | ~60 |
| `lib/ycollections/extractors/checklist-answers/robins-i.ts` | ROBINS-I answer extraction | ~55 |
| `lib/ycollections/extractors/checklist-answers/amstar2.ts` | AMSTAR2 answer extraction | ~15 |
| `lib/ycollections/project-collections.ts` | Factory: createProjectCollections(ydoc) | ~40 |
| `lib/ycollections/zustand-bridge.ts` | Feeds collections into existing store | ~40 |
| `lib/ycollections/index.ts` | Barrel export | ~10 |
| `hooks/useStudies.ts` | useSyncExternalStore hook | ~15 |
| `hooks/useStudy.ts` | Single study hook | ~15 |
| `hooks/useProjectCollections.ts` | Context hook for collections | ~20 |

### Files to Modify

| File | Change |
|---|---|
| `project/ConnectionPool.ts` | Add `collections` to ConnectionEntry, wire in `initializeConnection`, remove `ydoc.on('update')` handler and SyncManager creation |
| `stores/projectStore.ts` | Remove JSON.stringify equality checks (bridge handles change detection); can later remove studies/members/meta fields entirely |

### Files to Delete (after full migration)

| File | Reason |
|---|---|
| `primitives/useProject/sync.ts` | Replaced entirely by ycollections |

---

## Part B: Typed Operations Layer

Replaces the untyped `ConnectionOps = Record<string, (...args: any[]) => any>` and the 60-line `buildOpsMap` method.

### ProjectOps Interface

```typescript
// packages/landing/src/project/ProjectOps.ts
import type { StudyOperations } from '@/primitives/useProject/studies';
import type { ChecklistOperations } from '@/primitives/useProject/checklists/index';
import type { PdfOperations } from '@/primitives/useProject/pdfs';
import type { ReconciliationOperations } from '@/primitives/useProject/reconciliation';
import type { AnnotationOperations } from '@/primitives/useProject/annotations';
import type { OutcomeOperations } from '@/primitives/useProject/outcomes';

export interface ProjectOps {
  readonly study: StudyOperations;
  readonly checklist: ChecklistOperations;
  readonly pdf: PdfOperations;
  readonly reconciliation: ReconciliationOperations;
  readonly annotation: AnnotationOperations;
  readonly outcome: OutcomeOperations;
}
```

No new types invented -- reuses the 6 existing typed interfaces.

### Accessor API

```typescript
// Added to ConnectionPool
getTypedOps(projectId: string): ProjectOps    // throws NoConnectionError
getActiveTypedOps(): ProjectOps               // throws NoConnectionError
```

These throw instead of returning null because every single existing consumer already throws on null. This eliminates ~35 `if (!ops) throw` guards across the codebase.

### Consumer Migration (before/after)

**Actions (Pattern A, ~35 call sites):**
```typescript
// Before:
const ops = connectionPool.getActiveOps();
if (!ops) throw new Error('No active project connection');
ops.createOutcome(name, user.id);  // no type checking

// After:
const { outcome } = connectionPool.getActiveTypedOps();
outcome.createOutcome(name, user.id);  // fully typed
```

**Components (Pattern B, ~10 call sites):**
```typescript
// Before:
const ops = connectionPool.get(projectId);
const { updateChecklistAnswer, addPdfToStudy, addAnnotation } = ops;  // all any

// After:
const ops = connectionPool.getTypedOps(projectId);
const { updateChecklistAnswer } = ops.checklist;
const { addPdfToStudy } = ops.pdf;
const { addAnnotation } = ops.annotation;
```

### Latent Bugs Discovered (surfaced by types)

1. **`getAwareness` destructured from ops but never registered** in `ReconciliationWrapper.tsx` -- always undefined, degrades silently
2. **`applyReconciliationToChecklists` called but not defined** on `ReconciliationOperations` -- dead code or missing implementation
3. **Signature mismatch** in reconciliation actions -- positional args forwarded as `any[]` hide parameter name misalignment

### Files to Create

| File | Lines (est.) |
|---|---|
| `project/ProjectOps.ts` | ~15 |
| `project/errors.ts` | ~10 |

### Files to Modify (in order)

| File | Change |
|---|---|
| `project/ConnectionPool.ts` | Add `getTypedOps()`, `getActiveTypedOps()`, tighten ConnectionEntry field types |
| `project/actions/outcomes.ts` | 4 call sites |
| `project/actions/project.ts` | 2 call sites |
| `project/actions/reconciliation.ts` | 3 call sites + fix latent bugs |
| `project/actions/checklists.ts` | 7 call sites |
| `project/actions/pdfs.ts` | 6 call sites |
| `project/actions/studies.ts` | 5 call sites + helper function signatures |
| `components/project/completed-tab/CompletedTab.tsx` | 1 call site |
| `components/project/completed-tab/PreviousReviewersView.tsx` | 1 call site |
| `components/checklist/ChecklistYjsWrapper.tsx` | 1 call site |
| `components/project/reconcile-tab/ReconciliationWrapper.tsx` | 2 call sites + getAwareness fix |

### Cleanup (after full migration)

Delete from `ConnectionPool.ts`: `buildOpsMap()`, `opsRegistry`, `get()`, `getActiveOps()`, `ConnectionOps` type.

---

## Implementation Order

Parts A and B are independent and can be worked in parallel or sequentially.

**Recommended order:**

1. **Part B first** -- smaller scope (~15 files), mechanical migration, immediate type safety win, surfaces latent bugs. Can be done in 1-2 sessions.

2. **Part A Phase 1** -- build ycollections library + Zustand bridge. Replace SyncManager. All existing consumers work unchanged. This is the high-impact change.

3. **Part A Phase 2** -- migrate components from Zustand selectors to useSyncExternalStore hooks. Incremental, low-risk.

4. **Final cleanup** -- remove all old code, backward compat layers, and dead code. See below.

## Branching Strategy

All work happens on a feature branch (e.g., `feat/yjs-sync-redesign`). The branch is not merged until the full cleanup phase is complete. This means no backward compat shims survive into main -- the branch lands as a clean, finished refactor.

## Final Cleanup Phase (Step 4)

Everything below is deleted or removed before the branch merges. No backward compat layers ship to main.

### Files to delete entirely:
- `primitives/useProject/sync.ts` -- replaced by ycollections
- `project/ProjectOps.ts` -- inline the type into ConnectionPool if preferred, or keep; but the point is `ConnectionOps` is gone

### Code to remove from `project/ConnectionPool.ts`:
- `buildOpsMap()` private method (60 lines)
- `opsRegistry` map and all references
- `get()` method (replaced by `getTypedOps()`)
- `getActiveOps()` method (replaced by `getActiveTypedOps()`)
- `ConnectionOps` type export
- `syncManager` field from ConnectionEntry (replaced by `collections`)
- `createSyncManager` import
- The `ydoc.on('update', syncUpdateHandler)` handler and its cleanup registration
- The `isLoadingPersistedState`-guarded sync call (collections handle this via pause/resume)

### Code to remove from `stores/projectStore.ts`:
- `JSON.stringify` equality checks in `setProjectData` (lines 131-149)
- After Phase 2 hook migration: remove `studies`, `members`, `meta` from `ProjectData` interface and `projects` state (store retains only connection state, project stats, pending data)
- Remove selectors that are fully replaced by collection hooks: `selectStudies`, `selectMembers`, `selectMeta`, `selectStudy`, `selectChecklist`, `selectStudyPdfs`, `selectPrimaryPdf`, `selectActiveProject`, `selectProject`
- Remove `EMPTY_STUDIES`, `EMPTY_MEMBERS`, `EMPTY_META`, `EMPTY_PDFS` fallback constants

### Code to remove from `lib/ycollections/zustand-bridge.ts`:
- Delete the entire file once all components use `useSyncExternalStore` hooks directly

### Imports to clean up across the codebase:
- Remove all `import { connectionPool } from '@/project/ConnectionPool'` calls that used `get()` or `getActiveOps()` -- replace with `getTypedOps()` / `getActiveTypedOps()`
- Remove all `import { createSyncManager } from '@/primitives/useProject/sync'`
- Remove all `import { selectStudies, selectMembers, ... } from '@/stores/projectStore'` in components migrated to hooks

### Dead code surfaced by typed ops migration:
- `applyReconciliationToChecklists` in `actions/reconciliation.ts` -- either implement or remove
- `getAwareness` destructuring in `ReconciliationWrapper.tsx` -- replace with `connectionPool.getAwareness(projectId)`
- Any reconciliation action signature mismatches -- fix or remove

## Verification

### Part B verification:
- `pnpm typecheck` -- zero type errors after each migration step
- `pnpm --filter landing test` -- existing unit tests pass
- `pnpm --filter landing test:browser` -- E2E tests pass (rob2-workflow, amstar2-workflow, robins-i-workflow)
- Manual: open a project, fill a checklist, reconcile -- operations work identically

### Part A verification:
- New unit tests for YCollection (pure Y.Doc fixtures, no mocks)
- New unit tests for each extractor (extractStudy, extractROB2Answers, etc.)
- `pnpm --filter landing test:browser` -- E2E tests pass
- Manual: verify that editing a checklist in one tab updates the other tab's view
- Manual: verify that offline edits (via Dexie) sync correctly on reconnect
- Performance: verify that typing in a checklist comment does NOT trigger console logs for other study extractions (add temporary logging to verify incremental behavior)

## Key Design Decisions

| Decision | Rationale |
|---|---|
| `observeDeep` on root maps, not per-entry `observe` | One observer per collection instead of N observers. Simpler lifecycle management. O(events) not O(entries). |
| Skip answer extraction for non-finalized checklists | Editors already use direct Y.Doc access. Extraction is wasted work. This is the single biggest performance win. |
| Zustand bridge for backward compat | 12+ selector consumers continue working without changes. Migration is incremental. |
| Namespaced ops (`ops.study.create`) over flat (`ops.createStudy`) | Prevents method collision, improves IDE navigability, matches the existing `project.study.create` action namespace |
| Throw on missing connection instead of returning null | Every consumer already throws. Centralizing it removes ~35 null-check guards. |
| One extractor file per checklist type | Eliminates 95% duplicated extraction logic. Each type is independently testable. Adding a new checklist type = one file. |

## Reference Material

Patterns adopted from reference libraries:
- **Zero Sync** (`reference/zero-mono`): `observeDeep` + incremental extraction mirrors their IVM operator pipeline
- **TanStack DB** (`reference/tanstack-db`): Per-collection independent sync, `useSyncExternalStore` hooks
- **Convex** (`reference/convex`): Shallow reference comparison, query-level change tracking
- **Outline** (`reference/outline`): Direct Y.Doc binding for editors, extraction only for persistence/display

## Current Architecture (for reference)

### Files being replaced:
- `packages/landing/src/primitives/useProject/sync.ts` (505 lines) -- full tree extraction + Zustand push
- `packages/landing/src/project/ConnectionPool.ts` buildOpsMap (60 lines) -- untyped ops flattening

### Y.Doc hierarchy:
```
ydoc
+-- "reviews" Y.Map (studies, most volatile)
|   +-- [studyId] Y.Map
|       +-- name, description, metadata fields...
|       +-- checklists Y.Map
|       |   +-- [checklistId] Y.Map (type, status, assignedTo, answers Y.Map)
|       +-- pdfs Y.Map
|       +-- annotations Y.Map
|       +-- reconciliations Y.Map
+-- "meta" Y.Map (project metadata + outcomes, rarely changes)
+-- "members" Y.Map (member list, rarely changes)
```

### Consumer patterns:
- ~12 components read from useProjectStore via selectors (read-only display)
- ~5 components access connectionPool.get() for direct Y.Doc operations (editors)
- ~35 action call sites use connectionPool.getActiveOps() for mutations
- Y.Text fields (checklist comments, preliminary fields) already bypass the store entirely
