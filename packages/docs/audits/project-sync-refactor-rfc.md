# Refactor: Deepen project sync module (Design C + borrowed elements)

GitHub Issue: https://github.com/InfinityBowman/corates/issues/424

## Summary

The project sync system currently spreads ownership of "project data" across 5 modules and 15+ files. The interface surface (~40 methods duplicated in two places) is nearly as complex as the implementation. This RFC proposes consolidating into a deep module with a small, typed API.

**Reference**: `packages/docs/audits/architecture-deepening-candidates.md` (Candidate #2)

## Problem

### Current data flow

```
  UI Component
     |  reads from              writes via
     v                              |
projectStore (Zustand)    projectActionsStore (singleton, untyped JS)
     ^                              |
     |  pushes state into           | delegates to
     |                              v
  sync.js  <--- Y.Doc updates --- useProject/operations (6 modules)
     |                              ^
     \--- connection.js ----------- / (WebSocket + Dexie)
```

### Specific issues

1. **Dual registration of ~40 operations.** `useProject` hook (lines 194-235 of `primitives/useProject/index.js`) registers every operation method on `projectActionsStore._setConnection()`. The same methods are also returned from the hook itself. Callers must choose which to use.

2. **Untyped action store.** `projectActionsStore` is plain JS. Every consumer casts it: `const projectActionsStore = _projectActionsStore as any`. 11 component files import it this way.

3. **422-line hook doing two jobs.** `useProject` manages both connection lifecycle (Y.Doc creation, Dexie persistence, WebSocket, ref-counting, StrictMode guards) AND returns domain operations. These are separate concerns with separate lifecycles.

4. **Implicit lifecycle contract.** `projectActionsStore` requires `_setActiveProject()` to be called by `ProjectView` and `_setConnection()` by `useProject`. Ordering matters. Forgetting either causes runtime errors.

5. **Connection state is 4 booleans.** `connected`, `connecting`, `synced`, `error` -- with impossible combinations (connected=true + connecting=true) not structurally prevented. State machine logic is scattered across `connection.js` mutable variables (`shouldBeConnected`, `consecutiveErrors`).

6. **Zero test coverage.** The tight coupling between Y.js, Dexie, WebSocket, and Zustand stores makes isolated testing impossible.

## Proposed Design (C: Caller-Optimized, with borrowed elements)

### Public API

Three entry points replace the current five modules:

```typescript
// The entire public surface
import { useProjectStore, project, ProjectGate, useAwareness } from '@/project';
```

**1. `useProjectStore`** -- Zustand store for reads (unchanged from today). Existing selectors continue to work.

**2. `project.*`** -- Typed singleton for writes (replaces `projectActionsStore`).

```typescript
// Before
import _projectActionsStore from '@/stores/projectActionsStore/index.js';
const projectActionsStore = _projectActionsStore as any;
projectActionsStore.study.create('Study Name');

// After
import { project } from '@/project';
project.study.create('Study Name');
```

Same ergonomics, full TypeScript types, no `as any` cast.

**3. `<ProjectGate>`** -- Declarative component for connection lifecycle (replaces `useProject` hook + `_setActiveProject` dance).

```tsx
// Before (ProjectView.tsx)
const projectConnection = useProject(projectId);
useEffect(() => {
  projectActionsStore._setActiveProject(projectId, orgId);
  return () => projectActionsStore._clearActiveProject();
}, [projectId, orgId]);
return (
  <ProjectProvider projectId={projectId} projectOps={projectConnection}>
    {children}
  </ProjectProvider>
);

// After
return (
  <ProjectGate projectId={projectId} orgId={orgId} fallback={<Skeleton />}>
    {children}
  </ProjectGate>
);
```

**4. `useAwareness()`** -- Returns Y.js Awareness for presence features. Only needed in reconciliation views.

### Borrowed elements

**From Design D (Ports & Adapters): Pure `connectionReducer`.**

Extract the connection state machine from scattered mutable variables into a pure reducer:

```typescript
type ConnectionPhase = 'idle' | 'loading' | 'connecting' | 'connected' | 'synced' | 'error' | 'offline';

type ConnectionEvent =
  | { type: 'CONNECT_REQUESTED' }
  | { type: 'PERSISTENCE_LOADED' }
  | { type: 'REMOTE_STATUS_CHANGED'; status: RemoteSyncStatus }
  | { type: 'WENT_OFFLINE' }
  | { type: 'WENT_ONLINE' }
  | { type: 'ACCESS_DENIED'; reason: string }
  | { type: 'ERROR_THRESHOLD_REACHED' };

function connectionReducer(state: ConnectionMachineState, event: ConnectionEvent): ConnectionMachineState;
```

This is testable with simple event sequences -- no WebSocket or Y.js needed.

**From Design B (Flexible): Unified `getTextRef()`.**

Replace three checklist-type-specific methods with one:

```typescript
// Before
getQuestionNote(studyId, checklistId, 'q1');       // AMSTAR2
getRobinsText(studyId, checklistId, 'domain1', 'support', 'q1a');  // ROBINS-I
getRob2Text(studyId, checklistId, 'domain1', 'support');            // ROB2

// After
getTextRef(studyId, checklistId, { questionKey: 'q1' });                          // AMSTAR2
getTextRef(studyId, checklistId, { sectionKey: 'domain1', fieldKey: 'support', questionKey: 'q1a' }); // ROBINS-I
getTextRef(studyId, checklistId, { sectionKey: 'domain1', fieldKey: 'support' }); // ROB2
```

### Internal architecture

```
                  +---------------------+
                  |  @/project/index.ts |  <-- barrel export (public surface)
                  +----------+----------+
                             |
              +--------------+---------------+
              |              |               |
     useProjectStore    project.*      ProjectGate
     (Zustand, existing) (typed singleton) (React component)
              |              |               |
              +--------------+-------+-------+
                                     |
                          +----------+----------+
                          | ConnectionPool      | <-- internal
                          | (ref-counted Map)   |
                          +----------+----------+
                                     |
                    +----------------+----------------+
                    |                |                 |
              Y.Doc + ops     DexieYProvider    WebsocketProvider
              (6 op modules)  (IndexedDB)       (y-websocket)
                    |                |
            connectionReducer   syncManager
            (pure reducer)     (Y.Doc -> store)
```

- `ConnectionPool` owns the ref-counted session map (replaces `connectionRegistry`)
- `ProjectGate` calls `pool.acquire(projectId)` on mount, `pool.release(projectId)` on unmount
- The `project.*` singleton resolves operations lazily: `project.study.create(...)` internally looks up `pool.get(activeProjectId).studyOps.createStudy(...)`
- The 6 operation modules (`studies.js`, `checklists/`, `pdfs.js`, etc.) remain internally, just no longer exported or registered externally

### Connection state enum (replaces 4 booleans)

```typescript
// Before: callers check
if (connectionState.connected && connectionState.synced && !connectionState.error)

// After: callers check
if (connection.phase === 'synced')
```

Impossible states are structurally eliminated.

## Migration strategy

Migration is largely mechanical:

| Current import | New import | Change type |
|---|---|---|
| `projectActionsStore.study.create(...)` | `project.study.create(...)` | Find-and-replace |
| `projectActionsStore.checklist.*` | `project.checklist.*` | Find-and-replace |
| `projectActionsStore.pdf.*` | `project.pdf.*` | Find-and-replace |
| `useProject(projectId)` in ProjectView | `<ProjectGate>` component | Rewrite (1 file) |
| `useProjectContext().projectOps` | `useAwareness()` (only for presence) | Targeted (2-3 files) |
| `_projectActionsStore as any` cast | Typed import, no cast | Delete cast |

**Files affected**: ~15 component files for the find-and-replace, 1 file (ProjectView) for the structural rewrite, 2-3 reconciliation files for awareness access.

**Incremental approach**: The old `projectActionsStore` can temporarily delegate to the new `project.*` singleton during migration, so both imports work simultaneously.

## What callers no longer need to know

| Concern | Before | After |
|---|---|---|
| Y.js (Y.Doc, Y.Map, transact) | Leaked through `useProject` return, `projectOps` context | Hidden behind operation methods |
| Dexie/IndexedDB | Must load before WebSocket; `isLoadingPersistedState` guard | `<ProjectGate fallback={...}>` |
| WebSocket lifecycle | Connection, reconnection, access denied handling | `connection.phase` enum |
| Ref-counting | Implicit in `useProject` hook | Declarative via `<ProjectGate>` mount/unmount |
| Dual registration | 40 methods registered on both hook return + action store | One `project.*` singleton |
| Active project setup | Manual `_setActiveProject` / `_clearActiveProject` | Automatic in `<ProjectGate>` |
| Which API to use | Hook return vs action store vs context | Store for reads, singleton for writes |

## Non-goals

- **Not changing the Zustand store interface.** Existing selectors and store structure remain as-is.
- **Not abstracting Y.js behind ports.** The domain modules continue to use Y.js directly internally. Only the public surface hides it.
- **Not adding an extension system.** The 6 domain operation groups are sufficient for current needs.
- **Not touching the backend.** This is a frontend-only refactor.

## Design alternatives considered

Four interface designs were evaluated (full analysis in conversation context):

- **Design A (Minimal)**: Per-project scoped Zustand stores, 2 entry points. Rejected: scoped stores break dashboard project stats caching and require rewriting every component's read pattern for no functional gain.
- **Design B (Flexible)**: Extension system with `registerDomain()`/`ops.extension<T>()`. Rejected as premature: 6 domains exist with no evidence more are coming. Borrowed the unified `getTextRef()` method.
- **Design C (Caller-Optimized)**: Selected. Lowest migration cost, keeps existing Zustand store, typed singleton replaces untyped action store.
- **Design D (Ports & Adapters)**: Full hexagonal architecture with `DocumentPort`, `PersistencePort`, etc. Rejected: wrapping every Y.Map call adds indirection without proportional testability gain for a single-engine codebase. Borrowed the pure `connectionReducer`.
