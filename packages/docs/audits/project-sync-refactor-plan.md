# Project Sync Refactor: Implementation Plan

Based on the RFC at `project-sync-refactor-rfc.md`, the behavior spec at `project-sync-behavior-spec.md`, and a full inventory of the current codebase.

## Phasing Strategy

Six phases, each independently shippable. Phases 0-1 fix the immediate reconciliation crash and performance issues. Phases 2-5 implement the RFC's architectural changes.

---

## Phase 0: Fix the Feedback Loop (internal, zero migration cost)

**Goal**: Stop the ROB-2 "Use This" crash. Three targeted changes inside internal modules -- no consumer-facing API changes.

### 0a. `setYTextField` equality check + transaction wrapping

File: `primitives/useProject/checklists/handlers/rob2.js` (and `robins-i.js` if same pattern)

```javascript
// Before (line 174-185)
setYTextField(map, fieldKey, value) {
  const str = value ?? '';
  const existing = map.get(fieldKey);
  if (existing instanceof Y.Text) {
    existing.delete(0, existing.length);
    existing.insert(0, str);
  } else { ... }
}

// After
setYTextField(map, fieldKey, value) {
  const str = value ?? '';
  const existing = map.get(fieldKey);
  if (existing instanceof Y.Text) {
    if (existing.toString() === str) return; // skip no-op writes
    existing.doc.transact(() => {
      existing.delete(0, existing.length);
      existing.insert(0, str);
    });
  } else { ... }
}
```

This eliminates: (a) redundant Y.Text modifications that trigger observers, (b) double YDoc updates from non-transacted delete+insert.

### 0b. Debounce `syncFromYDoc`

File: `primitives/useProject/sync.js`

Currently, every single YDoc update (including individual delete and insert operations within a single logical change) triggers a full Y.Doc scan + Zustand store push. A single "Use This" click generates 3-6 of these.

```javascript
// Before
function createSyncManager(projectId, getYDoc) {
  return { syncFromYDoc() { /* immediate full scan */ } };
}

// After
function createSyncManager(projectId, getYDoc) {
  let pending = false;

  function syncFromYDoc() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      // ... existing full scan logic ...
    });
  }

  // For cases that need immediate sync (initial load, WebSocket sync complete)
  function syncFromYDocImmediate() {
    pending = false;
    // ... existing full scan logic ...
  }

  return { syncFromYDoc, syncFromYDocImmediate };
}
```

The `ydoc.on('update')` handler uses `syncFromYDoc` (debounced). The Dexie load and WebSocket sync callbacks use `syncFromYDocImmediate` (no debounce, needed for initial render).

### 0c. Stabilize PreliminaryPage observer dependencies

File: `rob2-reconcile/pages/PreliminaryPage.tsx`

The `useEffect` that observes Y.Text has `onFinalChange` in its dependency array. `onFinalChange` is an inline arrow that gets a new reference on every render, causing the effect to re-run (unobserve + re-observe) on every store update.

```tsx
// Before (line 307-325)
useEffect(() => {
  // ...
  yText.observe(observer);
  return () => yText.unobserve(observer);
}, [isTextField, getRob2Text, fieldKey, onFinalChange]); // unstable dep

// After: use a ref for the callback
const onFinalChangeRef = useRef(onFinalChange);
onFinalChangeRef.current = onFinalChange;

useEffect(() => {
  if (!isTextField || !getRob2Text) return;
  const yText = getRob2Text('preliminary', fieldKey);
  if (!yText) return;
  let syncing = false;

  const observer = () => {
    if (syncing) return;
    syncing = true;
    try {
      onFinalChangeRef.current(yText.toString());
    } finally {
      syncing = false;
    }
  };

  yText.observe(observer);
  return () => yText.unobserve(observer);
}, [isTextField, getRob2Text, fieldKey]); // stable deps only
```

**Files touched in Phase 0**: 3-4 files, all internal. Zero consumer migration.

**Validates**: The reconciliation "Use This" flow works without freezing. Also improves general performance for all Y.Doc operations.

---

## Phase 1: syncManager as Deep Module (internal, zero migration cost)

**Goal**: Make the sync layer a proper deep module that hides Y.Doc scanning complexity and provides structural equality to prevent unnecessary re-renders.

### 1a. Structural equality in `setProjectData`

File: `stores/projectStore.ts`

Currently, `setProjectData` always replaces the entire `studies`/`meta`/`members` arrays, creating new object references even when data hasn't changed. This triggers cascading re-renders through `reconciledChecklistMeta` -> `reconciledChecklistData` -> `engineContext`.

Add a shallow comparison before writing:

```typescript
setProjectData: (projectId, data) => {
  set(state => {
    if (!state.projects[projectId]) {
      state.projects[projectId] = { meta: {}, members: [], studies: [] };
    }
    const project = state.projects[projectId];
    if (data.meta !== undefined && !shallowEqual(project.meta, data.meta)) {
      project.meta = data.meta;
    }
    if (data.members !== undefined && !shallowEqual(project.members, data.members)) {
      project.members = data.members;
    }
    if (data.studies !== undefined) {
      // For studies, compare by study count + each study's updatedAt
      // to avoid deep equality checks on the full array
      if (studiesChanged(project.studies, data.studies)) {
        project.studies = data.studies;
        const stats = computeProjectStats(data.studies);
        state.projectStats[projectId] = { ...stats, lastUpdated: Date.now() };
      }
    }
  });
  if (data.studies !== undefined) {
    persistStats(useProjectStore.getState().projectStats);
  }
},
```

### 1b. Move `persistStats` outside Immer produce

Already done in this session. The `persistStats` call was moved outside the `set()` callback to avoid passing Immer draft proxies to `JSON.stringify`.

### 1c. Batch Y.Doc operations in `updateAnswer`

File: `primitives/useProject/checklists/handlers/rob2.js` (and robins-i.js)

Wrap the entire `updateAnswer` method body in `answersMap.doc.transact()` so that multiple field updates (e.g., setting both `judgement` and `direction` on a domain) produce a single YDoc update event instead of one per field.

**Files touched in Phase 1**: 2-3 files, all internal. Zero consumer migration.

---

## Phase 2: ConnectionPool + connectionReducer (internal, 1 file migration)

**Goal**: Extract the connection lifecycle from the `useProject` hook into a standalone `ConnectionPool` with a testable pure `connectionReducer`.

### 2a. Pure `connectionReducer`

New file: `project/connectionReducer.ts`

Replace the 4-boolean `ConnectionState` with a state machine:

```typescript
type ConnectionPhase = 'idle' | 'loading' | 'connecting' | 'connected' | 'synced' | 'error' | 'offline';

type ConnectionEvent =
  | { type: 'CONNECT_REQUESTED' }
  | { type: 'PERSISTENCE_LOADED' }
  | { type: 'REMOTE_STATUS_CHANGED'; status: 'connected' | 'disconnected' }
  | { type: 'SYNC_COMPLETE' }
  | { type: 'WENT_OFFLINE' }
  | { type: 'WENT_ONLINE' }
  | { type: 'ACCESS_DENIED'; reason: string }
  | { type: 'ERROR_THRESHOLD_REACHED' };

function connectionReducer(state: ConnectionMachineState, event: ConnectionEvent): ConnectionMachineState;
```

This is a pure function -- testable with simple event sequences, no Y.js or WebSocket needed.

### 2b. ConnectionPool

New file: `project/ConnectionPool.ts`

Extracts the `connectionRegistry` Map + `getOrCreateConnection` / `releaseConnection` logic from the `useProject` hook into a standalone class. Owns:

- Ref-counted `Map<projectId, ConnectionEntry>`
- Y.Doc creation and destruction
- Operation module initialization
- Dexie persistence setup (async)
- WebSocket connection setup
- syncManager lifecycle

The pool is a singleton. `acquire(projectId)` replaces `getOrCreateConnection`. `release(projectId)` replaces `releaseConnection`.

### 2c. Update `useProject` to use ConnectionPool

The hook becomes thin -- just calls `pool.acquire()` on mount and `pool.release()` on unmount, then reads state from the Zustand store. Most of the 424 lines move into ConnectionPool.

### 2d. Update projectStore connection state

Replace 4 booleans with `phase: ConnectionPhase`:

```typescript
// Before
connections: Record<string, { connected: boolean; connecting: boolean; synced: boolean; error: string | null }>

// After
connections: Record<string, { phase: ConnectionPhase; error: string | null }>
```

**Consumer impact**: Components that check `connectionState.connected && connectionState.synced` need to check `connectionState.phase === 'synced'`. This is ~5 components. Can be migrated incrementally by keeping the old selectors working via a compatibility shim.

**Files touched**: 3 new files + modify `useProject/index.js` + modify `projectStore.ts` + ~5 consumer files for connection state checks.

**Test coverage**: `connectionReducer` gets comprehensive unit tests (pure function, easy to test).

---

## Phase 3: ProjectGate (1 file structural rewrite)

**Goal**: Replace the `useProject` hook + `_setActiveProject` lifecycle dance with a declarative `<ProjectGate>` component.

### 3a. Create `ProjectGate`

New file: `project/ProjectGate.tsx`

```tsx
export function ProjectGate({ projectId, orgId, fallback, children }) {
  // Calls pool.acquire(projectId) on mount, pool.release(projectId) on unmount
  // Sets active project on the singleton
  // Renders fallback during loading/connecting
  // Renders children when synced (or connected for local projects)
  // Renders error UI on access denied
}
```

### 3b. Rewrite `ProjectView.tsx`

Replace:
```tsx
const projectConnection = useProject(projectId);
useEffect(() => {
  projectActionsStore._setActiveProject(projectId, orgId);
  return () => projectActionsStore._clearActiveProject();
}, [projectId, orgId]);
```

With:
```tsx
<ProjectGate projectId={projectId} orgId={orgId} fallback={<Skeleton />}>
  <ProjectProvider ...>
    {children}
  </ProjectProvider>
</ProjectGate>
```

### 3c. Remove duplicate `useProject` call in `CompletedTab.tsx`

`CompletedTab` currently calls `useProject(projectId)` a second time just to get `getAllReconciliationProgress`. Move this to use the `project.*` singleton (Phase 4) or pass through context.

**Files touched**: 2 new files + modify `ProjectView.tsx` + modify `CompletedTab.tsx`.

---

## Phase 4: Typed `project.*` Singleton (find-and-replace, 13 files)

**Goal**: Replace the untyped `projectActionsStore` with a typed `project` singleton. Eliminate all 11 `as any` casts.

### 4a. Create typed singleton

New file: `project/actions.ts`

```typescript
export const project = {
  study: {
    create: (name, description?, metadata?) => pool.get(activeProjectId).studyActions.create(...),
    update: (studyId, updates) => ...,
    delete: (studyId) => ...,
    addBatch: (studiesToAdd) => ...,
    importReferences: (references) => ...,
  },
  checklist: { ... },
  pdf: { ... },
  member: { ... },
  reconciliation: { ... },
  outcome: { ... },
  project: { ... },
};
```

The implementation wraps the existing `projectActionsStore` action modules with proper TypeScript types. The action modules themselves don't change -- they just get a typed wrapper.

### 4b. Incremental migration

The old `projectActionsStore` temporarily delegates to `project.*` during migration so both imports work:

```typescript
// Temporary: old store delegates to new singleton
projectActionsStore.study.create = (...args) => project.study.create(...args);
```

### 4c. Find-and-replace across 13 files

| Current | New | Files |
|---------|-----|-------|
| `const projectActionsStore = _projectActionsStore as any;` | `import { project } from '@/project';` | 11 files |
| `projectActionsStore.study.create(...)` | `project.study.create(...)` | 11 files |
| `projectActionsStore._setActiveProject(...)` | Handled by `ProjectGate` (Phase 3) | 1 file |

### 4d. Delete old `projectActionsStore/`

After all consumers are migrated, delete the 8-file `stores/projectActionsStore/` directory.

**Files touched**: 1 new file + modify 13 consumer files + delete 8 old files.

---

## Phase 5: Hide Y.js from Public Surface (3 files)

**Goal**: Components no longer import or handle Y.Text/Y.Map directly. All Y.js interaction goes through operation methods.

### 5a. Unified `getTextRef`

Replace three checklist-type-specific methods with one:

```typescript
// Before (3 separate methods, Y.Text leaks to callers)
getQuestionNote(studyId, checklistId, 'q1');                          // AMSTAR2
getRobinsText(studyId, checklistId, 'domain1', 'support', 'q1a');    // ROBINS-I
getRob2Text(studyId, checklistId, 'domain1', 'support');              // ROB2

// After (1 method, still returns Y.Text but with typed params)
getTextRef(studyId, checklistId, { questionKey: 'q1' });              // AMSTAR2
getTextRef(studyId, checklistId, { sectionKey: 'domain1', fieldKey: 'support', questionKey: 'q1a' }); // ROBINS-I
getTextRef(studyId, checklistId, { sectionKey: 'domain1', fieldKey: 'support' }); // ROB2
```

### 5b. Move "Use This" Y.Text writes behind operations

The `copyCommentToYText` and `copyPreliminaryTextToYText` functions in `adapter.tsx` directly manipulate Y.Text. Move this logic into the checklist operations layer:

```typescript
// Before (adapter directly manipulates Y.Text)
const yText = getTextRef(sectionKey, fieldKey, questionKey);
yText.doc.transact(() => {
  yText.delete(0, yText.length);
  yText.insert(0, text);
});

// After (operation method handles it)
project.checklist.setTextValue(studyId, checklistId, { sectionKey, fieldKey, questionKey }, text);
```

This eliminates the class of bugs where components create Y.Text feedback loops -- the operation layer owns the write and can deduplicate internally.

### 5c. Update consumers

Only 3 files access `projectOps` for Y.js operations:
- `ChecklistYjsWrapper.tsx` -- uses `getQuestionNote`, `getRobinsText`, `getRob2Text`, `updateChecklistAnswer`, `getChecklistData`, etc.
- `ReconciliationWrapper.tsx` -- same pattern + reconciliation progress
- `PreviousReviewersView.tsx` -- uses `getChecklistData`, `getQuestionNote`

**Files touched**: Modify 3 consumer files + add methods to checklist operations module.

---

## Phase Dependency Graph

```
Phase 0 (bug fix)
  |
Phase 1 (sync perf)
  |
Phase 2 (ConnectionPool + reducer)  <-- can start in parallel with Phase 1
  |
Phase 3 (ProjectGate)  <-- depends on Phase 2
  |
Phase 4 (typed singleton)  <-- can start after Phase 2, parallel with Phase 3
  |
Phase 5 (hide Y.js)  <-- depends on Phase 4
```

Phases 0 and 1 are independent and can be done immediately.
Phases 2, 3, 4 form the core RFC implementation.
Phase 5 prevents future feedback loop bugs structurally.

---

## File Impact Summary

| Phase | New files | Modified files | Deleted files | Consumer migration |
|-------|-----------|---------------|---------------|-------------------|
| 0     | 0         | 3-4           | 0             | None              |
| 1     | 0         | 2-3           | 0             | None              |
| 2     | 3         | 2 + ~5 compat | 0             | ~5 (connection state checks) |
| 3     | 2         | 2             | 0             | 1 (ProjectView) |
| 4     | 1         | 13            | 8             | 13 (find-and-replace) |
| 5     | 0         | 3 + 1 ops     | 0             | 3                 |

**Total**: 6 new files, ~25 modified files, 8 deleted files.

---

## Test Plan

| Phase | What to test | How |
|-------|-------------|-----|
| 0     | "Use This" no longer freezes; Y.Text writes are idempotent | Manual QA: ROB-2 reconcile flow |
| 1     | Store updates are batched; no redundant re-renders | React DevTools profiler |
| 2     | `connectionReducer` handles all state transitions correctly | Unit tests (pure function) |
| 3     | `ProjectGate` renders loading/connected/error states correctly | Component test |
| 4     | All action methods work through typed singleton | Existing manual QA (no behavior change) |
| 5     | Reconciliation and checklist editing still work without direct Y.Text access | Manual QA |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Phase 0 changes interact badly with existing observer patterns | Low | High (crash) | The equality check in setYTextField is purely additive safety |
| Phase 2 ConnectionPool breaks StrictMode double-mount | Medium | High | Port the existing cancelled/initialized guards exactly |
| Phase 4 find-and-replace misses a consumer | Low | Medium | ESLint rule to flag old import |
| Phase 5 Y.Text ref identity changes break collaborative editing | Medium | High | Preserve the existing setYTextField pattern (clear + re-insert, don't replace Y.Text object) |
