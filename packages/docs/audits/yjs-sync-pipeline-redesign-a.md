# Y.js Sync Pipeline Redesign v2

RFC for restructuring the Y.js-to-React data pipeline in CoRATES.

**Status**: Draft
**Date**: 2026-03-24
**Scope**: `packages/landing` sync infrastructure, `packages/workers` ProjectDoc (minor)
**Supersedes**: `yjs-sync-pipeline-redesign.md` (earlier draft)

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Current Architecture](#current-architecture)
3. [Industry Analysis](#industry-analysis)
4. [Design Principles](#design-principles)
5. [Proposed Architecture](#proposed-architecture)
6. [API Surface](#api-surface)
7. [Migration Plan](#migration-plan)
8. [Risk Assessment](#risk-assessment)
9. [Appendix: Component Inventory](#appendix-component-inventory)

---

## Problem Statement

The current sync pipeline has a fundamental performance and maintainability problem: **every Y.Doc change triggers a full-tree extraction into a Zustand store**, regardless of what changed or which components need the data.

### Specific Issues

**1. O(n) extraction on every keystroke.**
When a single checklist answer changes, `sync.ts:doSync()` walks the entire Y.Doc tree -- every study, checklist, PDF, annotation -- converts it to plain JS, and calls `setProjectData`. The `JSON.stringify` equality check in `projectStore.ts:131-141` is an O(n) band-aid on an O(n) problem.

**2. Domain knowledge in the sync layer.**
`extractAnswersFromYMap()` in `sync.ts` has 120+ lines of hardcoded per-checklist-type logic (ROBINS_I, ROB2, AMSTAR2). The sync layer should not know what a checklist type is.

**3. Total type erasure in the operations interface.**
`ConnectionPool.buildOpsMap()` wraps every domain operation in `(...args: any[]) => any`. The resulting `ConnectionOps` type is `Record<string, (...args: any[]) => any>` -- effectively untyped. Callers get zero IDE support or compile-time safety.

**4. ConnectionPool is a god object.**
It manages Y.Doc lifecycle, creates 7 domain operation sets, builds a flat ops map, tracks active project/org, orchestrates Dexie persistence, orchestrates WebSocket connections, and handles cleanup. That is at least 4 distinct responsibilities in one class.

**5. Duplicated connection intent.**
`shouldBeConnected` in `connection.ts` and `provider.shouldConnect` in y-websocket track the same thing. The connection reducer state machine in Zustand is a third representation of connection state.

**6. Race-prone initialization.**
`initializeConnection` chains `.then()` callbacks with a `cancelled()` guard and an `isLoadingPersistedState` semaphore flag. This is a manual state machine that should be explicit.

**7. Server persistence cost grows with document size.**
`ProjectDoc.flushPersistence()` calls `Y.encodeStateAsUpdate(doc)` on every debounced write. Y.js supports incremental updates that could be appended instead.

### Impact

These issues compound as projects grow. A project with 50 studies, each with 2-3 checklists, means `doSync()` iterates hundreds of Y.Maps on every answer change. The `JSON.stringify` comparison runs on the full serialized object graph. Components that display a single study re-render because the store reference for the entire `studies` array changed.

---

## Current Architecture

```
User edits checklist answer
    |
    v
Y.Map.set() on specific answer key
    |
    v
Y.Doc fires 'update' event
    |
    v
SyncManager.syncFromYDoc() (debounced via requestAnimationFrame)
    |
    v
doSync(): walks ENTIRE Y.Doc tree
    |-- iterates all studies (Y.Map 'reviews')
    |-- for each study: iterates all checklists, PDFs, annotations
    |-- for each checklist: extractAnswersFromYMap() with type-specific branches
    |-- iterates all members (Y.Map 'members')
    |-- iterates meta (Y.Map 'meta')
    |
    v
projectStore.setProjectData(projectId, { studies, meta, members })
    |
    v
JSON.stringify equality check per field (studies, meta, members)
    |
    v
Zustand notifies all subscribers -> React re-renders
```

### File Inventory

| File | Lines | Responsibility |
|------|-------|---------------|
| `ConnectionPool.ts` | 373 | God object: lifecycle, ops, persistence, WebSocket, cleanup |
| `connection.ts` | 286 | WebSocket management wrapping y-websocket |
| `sync.ts` | 505 | Full-tree Y.Doc-to-plain-JS extraction |
| `connectionReducer.ts` | 124 | Connection state machine |
| `projectStore.ts` | 274 | Zustand store: projects, connections, selectors |
| `ProjectDoc.ts` | 812 | Server-side Durable Object |

### Data Consumption Patterns

An audit of all 73 project-scoped components reveals:

- **12 components** read `selectStudies` (study list for tables, progress)
- **9 components** read `selectMembers` (member list for assignment, display)
- **8 components** read `selectConnectionPhase` (connection status indicators)
- **7 components** read `selectMeta` (project name, outcomes)
- **5 components** call `getChecklistData()` (full checklist snapshot for forms/reconciliation)
- **3 components** call `updateChecklistAnswer()` (checklist form writes)
- **2 components** call `getRob2Text()` / `getRobinsText()` (Y.Text direct access)

The majority of components (display tabs, study tables, progress bars) only need read-only aggregate views. Only the checklist editor and reconciliation wrapper need deep access to individual answers.

---

## Industry Analysis

Four systems were studied for transferable patterns: TanStack DB, Zero (Rocicorp), Convex, and Outline. Source code was cloned to `reference/` and read thoroughly.

### TanStack DB

**Model**: Client-side normalized collections with live queries. Two-layer state (synced + optimistic). SQL-like query expressions compiled to an IVM (Incremental View Maintenance) pipeline.

**Transferable patterns**:
- `useLiveQuery` ergonomics for declarative reactive subscriptions
- `$synced` virtual property on rows to track sync status
- Transaction-based mutation batching
- `useSyncExternalStore` as the React integration primitive

**Not transferable**: Collection/table model (Y.js is document-structured, not relational). Operation-based sync protocol (Y.js has its own). Optimistic update layer (CRDTs are inherently optimistic).

### Zero (Rocicorp)

**Model**: Local-first reactive database backed by PostgreSQL. Queries compiled to IVM operator pipeline on the client. Server maintains Client View Records (CVR) tracking what each client has seen.

**Transferable patterns**:
- IVM principle: don't recompute everything when one thing changes
- The split between "what queries are subscribed" vs "what data exists"
- Generator-based streaming for responsiveness

**Not transferable**: Full SQL operator pipeline (overkill for tree-structured documents). Relational sync model. PostgreSQL logical replication.

### Convex

**Model**: Server-driven reactive database. Clients subscribe to query functions. Server re-executes queries when underlying data changes and pushes new results via Transitions.

**Transferable patterns**:
- Three-tier API layering: Base client -> Framework-agnostic -> React hooks
- Optimistic updates with replay semantics
- Version-tracked subscription invalidation

**Not transferable**: Server-driven invalidation model (incompatible with offline-first). No offline persistence. No CRDTs.

### Outline

**Model**: Y.js for collaborative editor content only. All metadata (titles, permissions, collaboration state) in MobX stores synced via REST API. ProseMirror binds directly to Y.XmlFragment.

**What Outline actually does** (correcting a common oversimplification): Y.Doc only contains editor content (a single Y.XmlFragment named "default"). Document titles, icons, metadata, collaborator lists, and presence state all live in MobX stores synced via REST API. Components do not bind directly to Y.Doc -- ProseMirror acts as the intermediary. On save, state is extracted from ProseMirror into MobX.

**Why this does not directly apply to CoRATES**: CoRATES puts structured data (checklist answers, study metadata, member lists, PDF references, annotations, reconciliation progress) in Y.Doc -- not just editor content. Outline avoids this problem entirely by keeping all non-editor data in MobX. CoRATES cannot adopt this approach without losing real-time collaboration on checklists.

**Transferable patterns**:
- Direct binding to Y.Text for collaborative text fields (notes, comments)
- Being intentional about what goes in Y.Doc and using the right observation strategy for each data category

### Synthesis

All four systems validate the same core principle: reactive subscriptions should be granular, not full-tree. The current CoRATES pipeline violates this.

The solution is not to replace Y.js (it handles CRDTs, offline, and collaborative text better than any of the four), but to fix the observation and extraction layer between Y.js and React.

Y.js already has the mechanism: `Y.Map.observeDeep()` fires once per transaction with structured events that identify exactly which subtrees changed via `event.path`. The current pipeline ignores this, using `ydoc.on('update')` which provides only a binary diff and forces a full tree re-read.

### Should CoRATES restructure data as a relational store?

No. Y.js is a document CRDT. Making it act like a relational store would mean fighting its core abstraction:
- Y.js has no concept of tables, foreign keys, or joins
- Simulating relations with top-level Y.Maps would require manual referential integrity
- Y.Text collaborative editing requires a parent Y.Doc -- normalizing answers into flat "tables" breaks Y.Text's natural home in the document tree
- The hierarchical structure (project -> studies -> checklists -> answers) matches the domain

If a relational model with real-time sync were desired, that would mean dropping Y.js entirely and adopting Zero or TanStack DB + an external sync backend. That means giving up CRDTs, offline merge, and collaborative text editing.

---

## Design Principles

1. **Observe subtrees, not the whole document.** Use `observeDeep` on specific Y.Maps instead of `doc.on('update')` + full tree walk.

2. **Rebuild only what changed.** When study-123's checklist answer changes, only rebuild study-123's snapshot. Study-456's snapshot object reference stays the same.

3. **Reference equality, not JSON.stringify.** Swap `JSON.stringify(a) !== JSON.stringify(b)` for `Object.is(a, b)` on per-entity snapshots. Changed entities get new object references; unchanged entities keep the same reference. `React.memo` and selector stability follow naturally.

4. **Direct Y.Text binding for collaborative text.** Text fields (notes, comments) bind to Y.Text directly, like Outline's ProseMirror binding. No extraction, no store round-trip.

5. **Domain-scoped snapshots for structured reads.** Checklist forms need the full domain's answers for scoring and conditional visibility. Reconciliation needs 3 checklists as plain objects. These get per-entity snapshots -- not individual key observation, not full tree extraction.

6. **Type safety throughout.** Replace `Record<string, (...args: any[]) => any>` with typed handles that provide IDE autocompletion and compile-time checking.

7. **Three-tier API layering.** Session (lifecycle, providers) -> Document (typed handles, subscriptions) -> React hooks. Each layer is testable independently.

8. **Coexistence during migration.** The new observation system runs alongside the existing Zustand store. Components migrate one at a time. Both systems read from the same Y.Doc.

---

## Proposed Architecture

### Layer Diagram

```
React Components
    |
    |-- Display components (study tables, progress bars, member lists)
    |   Subscribe via useSyncExternalStore to domain collections
    |   Only re-render when their specific entity's snapshot ref changes
    |
    |-- Editor components (checklist forms, reconciliation panels)
    |   Read domain-scoped snapshots for structured data
    |   Bind directly to Y.Text for collaborative text fields
    |   Write through typed handles
    |
    v
React Hooks Layer
    |   useStudies(), useStudy(), useChecklist(), useMembers(), useMeta()
    |   useChecklistHandle() -- typed handle for reads + writes
    |   usePresence() -- awareness protocol
    |   useConnectionState() -- session state machine
    v
Document Layer (ProjectDocument)
    |   Typed schema over Y.Doc
    |   Domain collections: StudiesCollection, MembersCollection, MetaCollection
    |   Entity handles: StudyHandle, ChecklistHandle
    |   Path-based observeDeep subscriptions
    v
Session Layer (ProjectSession)
    |   Owns the ProjectDocument, providers, awareness
    |   Connection state machine
    |   Lifecycle: open / destroy
    v
Provider Layer
    |   WebSocketSyncProvider (wraps y-websocket)
    |   IndexedDBProvider (wraps y-dexie)
    |   Each is independent, pluggable
    v
Y.Doc (unchanged) + ProjectDoc Durable Object (minor improvements)
```

### Data Binding Strategy

The codebase audit revealed three categories of data access, each requiring a different binding strategy.

#### Category 1: Collaborative Text (Y.Text direct binding)

**What**: Notes in AMSTAR2, comment fields in ROB2/ROBINS-I, free-text fields in preliminary sections.

**Current**: Accessed via `getQuestionNote()`, `getRob2Text()`, `getRobinsText()` through the untyped ops map. Already returns Y.Text references -- the binding is direct but the access path is untyped.

**Proposed**: Accessed via typed handles. No change in binding strategy, just better types.

```typescript
const handle = useChecklistHandle(studyId, checklistId);
const ytext = handle.textRef('domain1.answers.q1.comment');
// Pass directly to editor component -- no extraction
```

**Components affected**: ~5 (NoteEditor, SignallingQuestion comment fields, PreliminarySection text fields)

#### Category 2: Domain-Scoped Snapshots (per-entity incremental extraction)

**What**: Checklist answers for form rendering, checklist data for reconciliation comparison, study metadata for table display.

**Why not individual Y.Map key observation**: The feasibility analysis found that checklist form components need domain-level answer objects for scoring (`scoreRob2Domain(domainKey, answers)`) and conditional visibility (`getRequiredQuestions(domainKey, answers)`). Reconciliation needs 3 full checklists as plain objects for the `compareChecklists()` function. Switching to individual key observation would require rewriting 40+ files including all scoring functions, reconciliation adapters, and conditional UI logic.

**Why not full-tree extraction**: Only the changed entity needs re-extraction. `observeDeep` events identify which study changed via `event.path[0]`.

**Proposed**: Collections that observe specific Y.Map subtrees and maintain per-entity snapshot caches with reference equality.

```
When study-123's checklist answer changes:
  1. observeDeep callback fires with event.path[0] === 'study-123'
  2. Only study-123's snapshot is rebuilt via buildStudySnapshot()
  3. study-456's snapshot retains its object reference (same JS object)
  4. Subscribers notified; React.memo skips unchanged studies
```

**Components affected**: ~30 (all tab components, study tables, checklist forms, reconciliation)

#### Category 3: Aggregate/Derived Computations (lazy, memoized)

**What**: Checklist scores, completion counts, progress percentages, inter-rater reliability.

**Current**: Scoring is embedded in `sync.ts` during extraction. Runs on every Y.Doc change even for non-finalized checklists.

**Proposed**: Computed lazily from Category 2 snapshots. Only runs when the input snapshot reference changes. Scoring only computed for finalized checklists, in the component that displays the score.

```typescript
function ChecklistScore({ studyId, checklistId }) {
  const snapshot = useChecklistSnapshot(studyId, checklistId);
  const score = useMemo(
    () => snapshot?.status === 'finalized'
      ? scoreChecklistOfType(snapshot.type, snapshot.answers)
      : null,
    [snapshot],
  );
  return score ? <ScoreBadge score={score} /> : null;
}
```

**Components affected**: ~5 (OverviewTab stats, CompletedTab scores, study table badges)

### How Much of sync.ts Is Actually Necessary?

With the three-category model, most of the current extraction becomes unnecessary:

| Data | Current | Still Needed? | New Approach |
|------|---------|---------------|-------------|
| Study name, description | Full extraction every time | Only for study list | Category 2: StudiesCollection, incremental |
| Checklist answers | Full extraction every time | Only for active checklist | Category 2: per-checklist snapshot, on demand |
| Checklist status, assignee | Full extraction every time | Only for study table | Category 2: StudiesCollection, shallow only |
| Checklist score | Computed during extraction | Only for finalized | Category 3: derived lazily in component |
| PDF list | Full extraction every time | Only for PDF panel | Category 2: per-study, on demand |
| Annotations | Full extraction every time | Only for annotation layer | Category 2: per-checklist, on demand |
| Members | Full extraction every time | Only for member list | Category 2: MembersCollection |
| Meta | Full extraction every time | Only for project header | Category 2: MetaCollection |
| Reconciliation | Full extraction every time | Only for reconcile tab | Category 2: on demand |
| Y.Text content | Extracted as strings | No | Category 1: direct Y.Text binding |

The entire `extractAnswersFromYMap()` function (120+ lines of type-specific extraction) moves into the checklist type handlers where it belongs. It only runs when building a specific checklist's snapshot, not on every Y.Doc change.

### Domain Collections

Each collection wraps a top-level Y.Map and maintains incremental snapshots.

#### StudiesCollection

Observes `ydoc.getMap('reviews')` via `observeDeep`. Maintains a `Map<string, StudySnapshot>` where each entry is rebuilt only when its subtree changes.

```typescript
class StudiesCollection {
  private snapshots = new Map<string, StudySnapshot>();
  private sortedList: StudySnapshot[] | null = null;
  private listeners = new Set<() => void>();

  constructor(private ydoc: Y.Doc) {
    const reviewsMap = ydoc.getMap('reviews');

    // Initial population
    for (const [id, ymap] of reviewsMap.entries()) {
      this.snapshots.set(id, buildStudySnapshot(id, ymap as Y.Map<unknown>));
    }

    // Incremental updates via observeDeep
    reviewsMap.observeDeep((events) => {
      let changed = false;

      for (const event of events) {
        // Top-level changes (study added/removed): path.length === 0
        if (event.path.length === 0 && 'keys' in event) {
          for (const [key, info] of (event as Y.YMapEvent<unknown>).keys) {
            changed = true;
            if (info.action === 'delete') {
              this.snapshots.delete(key);
            } else {
              const studyYMap = reviewsMap.get(key) as Y.Map<unknown>;
              if (studyYMap) {
                this.snapshots.set(key, buildStudySnapshot(key, studyYMap));
              }
            }
          }
        }
        // Nested changes: path[0] is the study ID
        else if (event.path.length > 0) {
          const studyId = event.path[0] as string;
          if (!this.snapshots.has(studyId) || true) {
            const studyYMap = reviewsMap.get(studyId) as Y.Map<unknown>;
            if (studyYMap) {
              changed = true;
              this.snapshots.set(studyId, buildStudySnapshot(studyId, studyYMap));
            }
          }
        }
      }

      if (changed) {
        this.sortedList = null; // invalidate sorted cache
        for (const cb of this.listeners) cb();
      }
    });
  }

  getSnapshot(): StudySnapshot[] {
    if (!this.sortedList) {
      this.sortedList = [...this.snapshots.values()]
        .sort((a, b) => a.createdAt - b.createdAt);
    }
    return this.sortedList; // same array ref if nothing changed
  }

  getStudy(studyId: string): StudySnapshot | undefined {
    return this.snapshots.get(studyId);
  }

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
}
```

**Key behavior**: `buildStudySnapshot` replaces the per-study portion of `sync.ts:buildStudyFromYMap`. Checklist-type-specific answer extraction moves into the checklist type handlers (AMSTAR2Handler, ROB2Handler, etc.), called by `buildStudySnapshot` only when building that study's snapshot.

**observeDeep guarantees** (verified in Y.js source):
- Events are batched within a Y.Doc transaction -- single callback per transaction
- `event.path` tells you which subtree changed (computed lazily via parent pointers)
- `event.keys` (on YMapEvent) tells you which keys were added/updated/deleted
- Events are sorted by path length (shorter paths first)
- `event.keys` must be accessed inside the callback (stale after callback exits)

#### MembersCollection

Observes `ydoc.getMap('members')` via `observe` (not `observeDeep` -- members are flat, one level deep). Same snapshot pattern.

#### MetaCollection

Observes `ydoc.getMap('meta')` via `observeDeep` (outcomes are nested). Same snapshot pattern.

### Typed Handles

Replace the untyped `ConnectionOps` flat map with scoped, typed objects.

```typescript
interface ChecklistHandle {
  readonly id: string;
  readonly type: ChecklistType;
  readonly studyId: string;

  // Snapshot (for forms, scoring, reconciliation)
  snapshot(): ChecklistSnapshot;
  subscribe(cb: () => void): () => void;

  // Y.Text access (for collaborative text fields)
  textRef(path: string): Y.Text;

  // Mutations
  setAnswer(sectionKey: string, data: Record<string, unknown>): void;
  setStatus(status: ChecklistStatus): void;
  setAssignee(userId: string): void;
  finalize(): void;
}

interface StudyHandle {
  readonly id: string;

  // Snapshot
  snapshot(): StudySnapshot;
  subscribe(cb: () => void): () => void;

  // Nested handles
  checklistHandle(checklistId: string): ChecklistHandle | null;

  // Mutations
  rename(name: string): void;
  setDescription(desc: string): void;
  delete(): void;
}
```

Components that currently call `connectionPool.get(projectId)?.updateChecklistAnswer(studyId, checklistId, key, data)` instead call `handle.setAnswer(key, data)`. Same Y.Doc mutation underneath, but with type safety and without the flat ops map indirection.

### Session Layer

Replaces `ConnectionPool` with a cleaner lifecycle owner.

```typescript
interface ProjectSession {
  readonly projectId: string;
  readonly doc: ProjectDocument;
  readonly awareness: AwarenessManager;

  // Connection state (replaces connection phase in Zustand)
  readonly state: ConnectionState;
  subscribeToState(cb: (state: ConnectionState) => void): () => void;

  // Lifecycle
  destroy(): void;
}

interface ProjectDocument {
  readonly ydoc: Y.Doc;

  // Collections (observe subtrees, produce snapshots)
  readonly studies: StudiesCollection;
  readonly members: MembersCollection;
  readonly meta: MetaCollection;

  // Handles (typed access to specific entities)
  studyHandle(studyId: string): StudyHandle | null;
  checklistHandle(studyId: string, checklistId: string): ChecklistHandle | null;

  // Commands (project-level mutations)
  createStudy(params: CreateStudyParams): string;
  renameProject(name: string): void;
  // ... other project-level mutations
}
```

### Session Manager

Thin ref-counting wrapper replacing the registry portion of `ConnectionPool`.

```typescript
class SessionManager {
  private sessions = new Map<string, { session: ProjectSession; refCount: number }>();

  async acquire(projectId: string, config: SessionConfig): Promise<ProjectSession>;
  release(projectId: string): void;
  getSession(projectId: string): ProjectSession | null;
}
```

### Provider Layer

WebSocket and IndexedDB providers become self-contained, pluggable modules.

```typescript
interface SyncProvider {
  readonly name: string;
  readonly status: ProviderStatus;
  attach(ydoc: Y.Doc): void;
  detach(): void;
  destroy(): void;
  subscribe(cb: (status: ProviderStatus) => void): () => void;
}

class WebSocketSyncProvider implements SyncProvider {
  // Encapsulates: current connection.ts logic, online/offline handlers,
  // consecutive error counting, access-denied handling, y-websocket wrapping
}

class IndexedDBProvider implements SyncProvider {
  // Encapsulates: Dexie initialization, persisted state loading,
  // write-back handler, origin tag loop prevention
  readonly loaded: Promise<void>; // resolves when persisted state applied
}
```

### React Hooks

```typescript
// Session access (provided via React context from ProjectGate)
function useSession(): ProjectSession;

// Collection subscriptions (via useSyncExternalStore)
function useStudies(): StudySnapshot[];
function useStudy(studyId: string): StudySnapshot | undefined;
function useMembers(): MemberSnapshot[];
function useMeta(): MetaSnapshot;

// Entity handles (for editor components)
function useChecklistHandle(studyId: string, checklistId: string): ChecklistHandle | null;
function useChecklistSnapshot(studyId: string, checklistId: string): ChecklistSnapshot | null;

// Connection state
function useConnectionState(): ConnectionState;

// Presence
function usePresence(scope?: string): UserPresence[];
```

All collection hooks use `useSyncExternalStore` under the hood, subscribing to the collection's `subscribe()` and reading from its `getSnapshot()`.

### Server-Side Changes (Minor)

The ProjectDoc Durable Object remains largely unchanged. Two improvements:

**1. Alarm-based persistence instead of setTimeout.**

`setTimeout` does not survive Durable Object hibernation. Alarms do.

```typescript
// Current: setTimeout (lost on hibernation)
private schedulePersistence(): void {
  this.persistTimer = setTimeout(() => this.flushPersistence(), 500);
}

// Proposed: Durable Object alarm (survives hibernation)
private schedulePersistence(): void {
  this.ctx.storage.setAlarm(Date.now() + 500);
}

async alarm(): Promise<void> {
  await this.flushPersistence();
}
```

**2. Incremental update appending with periodic compaction.**

Instead of encoding full state on every flush, append incremental updates and compact periodically.

```typescript
private pendingUpdates: Uint8Array[] = [];
private readonly COMPACTION_THRESHOLD = 100;

private async flushPersistence(): Promise<void> {
  if (this.pendingUpdates.length === 0) return;

  if (this.pendingUpdates.length >= this.COMPACTION_THRESHOLD) {
    // Full compaction: write complete state, clear incrementals
    const fullState = Y.encodeStateAsUpdate(this.doc);
    await this.ctx.storage.put('yjs-state', Array.from(fullState));
    // Delete incremental keys...
    this.pendingUpdates = [];
  } else {
    // Append incremental update
    const merged = Y.mergeUpdates(this.pendingUpdates);
    await this.ctx.storage.put(`yjs-inc-${Date.now()}`, Array.from(merged));
    this.pendingUpdates = [];
  }
}
```

---

## API Surface

### Before and After: Component Perspective

**Reading studies (display component):**

```typescript
// Before
const studies = useProjectStore(s => selectStudies(s, projectId));

// After
const studies = useStudies();
```

**Reading a checklist for editing:**

```typescript
// Before
const ops = connectionPool.get(projectId);
const data = ops?.getChecklistData(studyId, checklistId);
const answers = data?.answers;
ops?.updateChecklistAnswer(studyId, checklistId, 'domain1', {
  answers: { q1: { answer: 'Yes' } },
});

// After
const handle = useChecklistHandle(studyId, checklistId);
const snapshot = handle?.snapshot();
const answers = snapshot?.answers;
handle?.setAnswer('domain1', { answers: { q1: { answer: 'Yes' } } });
```

**Accessing Y.Text:**

```typescript
// Before
const ops = connectionPool.get(projectId);
const ytext = ops?.getRob2Text(studyId, checklistId, 'domain1', 'q1', 'comment');

// After
const handle = useChecklistHandle(studyId, checklistId);
const ytext = handle?.textRef('domain1.answers.q1.comment');
```

**Reconciliation (3-checklist comparison):**

```typescript
// Before
const ops = connectionPool.get(projectId);
const c1 = ops?.getChecklistData(studyId, checklist1Id);
const c2 = ops?.getChecklistData(studyId, checklist2Id);
const reconciled = ops?.getChecklistData(studyId, reconciledId);
const diff = compareChecklists(c1.answers, c2.answers, reconciled?.answers);

// After
const h1 = useChecklistHandle(studyId, checklist1Id);
const h2 = useChecklistHandle(studyId, checklist2Id);
const hr = useChecklistHandle(studyId, reconciledId);
const diff = compareChecklists(
  h1?.snapshot().answers,
  h2?.snapshot().answers,
  hr?.snapshot().answers,
);
```

The comparison functions remain unchanged -- they still receive plain objects. The difference is that each handle's `snapshot()` is incrementally maintained and cached, not re-extracted from the full tree on every change.

**Connection state:**

```typescript
// Before
const { phase, error } = useProjectStore(s => selectConnectionPhase(s, projectId));

// After
const { phase, error } = useConnectionState();
```

### What Dies

| Current Code | Replacement |
|---|---|
| `sync.ts` (505 lines) | Domain collections with observeDeep. `doSync()`, `buildStudyFromYMap()`, `extractAnswersFromYMap()` all eliminated. Per-entity snapshot building lives in collections and type handlers. |
| `projectStore.projects` map | Eliminated. React reads from collection snapshots via `useSyncExternalStore`. |
| `projectStore.setProjectData()` | Eliminated. No centralized data setter. |
| `JSON.stringify` equality checks | Replaced by reference equality on per-entity snapshots. |
| `buildOpsMap` + `ConnectionOps` | Replaced by typed handles (`ChecklistHandle`, `StudyHandle`, etc.). |
| `requestAnimationFrame` debounce in SyncManager | `observeDeep` fires once per Y.Doc transaction -- natural batching. |
| All `select*` functions in projectStore | Replaced by collection hooks (`useStudies()`, `useMembers()`, etc.). |

### What Survives

| Current Code | Status |
|---|---|
| `connectionReducer.ts` | Stays. Clean state machine, moves into Session layer. |
| `ProjectDoc.ts` (Durable Object) | Stays with minor improvements (alarm-based persistence). |
| y-websocket connection logic | Stays, wrapped in `WebSocketSyncProvider`. |
| y-dexie persistence | Stays, wrapped in `IndexedDBProvider`. |
| Checklist operation factories | Stays, accessed via typed handles instead of flat ops map. |
| Awareness protocol | Stays, wrapped in `AwarenessManager`. |
| Checklist type handlers (AMSTAR2Handler, ROB2Handler, etc.) | Stays. Answer serialization moves from sync.ts into these handlers, called by collection snapshot builders. |

### What Shrinks

| Current Code | Change |
|---|---|
| `ConnectionPool.ts` (373 lines) | Replaced by `SessionManager` (~50 lines) + `ProjectSession` (~100 lines). Lifecycle, ops, and persistence concerns separated. |
| `projectStore.ts` (274 lines) | Shrinks to ~40 lines. Only holds `activeProjectId`, `connections` (state machine), and `projectStats` (localStorage-persisted). No more `projects` map or selectors. |
| `connection.ts` (286 lines) | Stays roughly the same size but encapsulated as `WebSocketSyncProvider`. |

---

## Migration Plan

The new observation system can coexist with the existing Zustand store. Both read from the same Y.Doc instances. Components migrate incrementally. Each phase is independently valuable -- the migration can pause at any phase boundary.

### Phase 1: Foundation (No Breaking Changes)

**Goal**: New observation system operational alongside existing store.

- Create `ProjectDocument` class with `StudiesCollection`, `MembersCollection`, `MetaCollection`.
- Create `ProjectSession` wrapping `ProjectDocument` + providers.
- Create `SessionManager` with acquire/release ref-counting.
- In `ProjectGate`, after Y.Doc initialization, also instantiate a `ProjectSession`.
- Provide session via React context alongside existing Zustand store.
- Write unit tests: Y.Doc mutations -> collection snapshots update correctly with reference equality.

**Validation**: Existing E2E tests pass unchanged. New unit tests pass. Both systems read from same Y.Doc.

**Minimum viable proof**: One component (OverviewTab) reads from collections instead of Zustand. Verify it renders correctly and only re-renders when its data changes.

### Phase 2: Migrate Read-Only Display Components

**Goal**: Display components read from collections instead of Zustand.

Migrate in order of risk (lowest first):

1. `OverviewTab` -- reads `selectStudies`, `selectMembers`. Replace with `useStudies()`, `useMembers()`.
2. `ProjectCard` -- reads `selectProjectStats`. Derive from `useStudies()`.
3. `AllStudiesTab` -- reads `selectStudies`, `selectMembers`, `selectConnectionPhase`.
4. `TodoTab` -- same pattern.
5. `CompletedTab` -- same pattern plus reconciliation progress.
6. `ReconcileTab` -- reads `selectStudies`, `selectMeta`.
7. `ProjectContext` -- reads `selectMembers` for role computation.
8. All connection phase consumers -- switch to `useConnectionState()`.

**Validation**: E2E tests pass after each component migration. No Zustand store changes needed yet.

### Phase 3: Create Typed Handles + Migrate Editor Components

**Goal**: Checklist and reconciliation editors use typed handles instead of untyped ops.

1. Create `ChecklistHandle` implementation wrapping existing checklist operations.
2. Create `StudyHandle` implementation.
3. Create `useChecklistHandle()` and `useStudyHandle()` hooks.
4. Migrate `ChecklistYjsWrapper` to use handles instead of `connectionPool.get(projectId)?.updateChecklistAnswer(...)`.
5. Migrate `ReconciliationWrapper` to use handles for 3-checklist access.
6. Migrate text field access (`getRob2Text`, etc.) to `handle.textRef()`.
7. Migrate remaining operation consumers (annotations, PDFs, outcomes).

**Validation**: E2E dual-reviewer workflows pass. Reconciliation E2E passes. All checklist types exercised.

### Phase 4: Remove Legacy Sync Pipeline

**Goal**: Eliminate the full-tree extraction path.

1. Remove `SyncManager` and `sync.ts`.
2. Remove `projectStore.projects` map and `setProjectData()`.
3. Remove all `select*` functions (selectStudies, selectStudy, etc.).
4. Simplify `projectStore.ts` to only hold connection state and project stats.
5. Replace `ConnectionPool` with `SessionManager`.
6. Remove the `ydoc.on('update', syncUpdateHandler)` binding.

**Validation**: Full E2E suite. Manual testing of offline mode, reconnection, and multi-user collaboration.

### Phase 5: Server-Side Improvements

**Goal**: Improve persistence efficiency in the Durable Object.

1. Switch `ProjectDoc` persistence from `setTimeout` to Durable Object `alarm()`.
2. Implement incremental update appending with periodic compaction.
3. Update `initializeDoc` to load and merge incremental updates on startup.

**Validation**: `ProjectDoc.test.ts` and `ProjectDoc.rpc.test.ts` pass. Manual reconnection test.

### Phase 6: Cleanup and Dead Code Removal

Since this work happens on a feature branch, Phase 6 is the gate before merge. Everything removed here must be verified as unreachable before the PR is opened.

#### 6a: Delete Dead Files

These files should be fully removable after Phase 4:

| File | Condition for Deletion |
|---|---|
| `src/primitives/useProject/sync.ts` | No imports remain. `SyncManager` type not referenced. |
| `src/project/ConnectionPool.ts` | Replaced by `SessionManager`. No imports remain. |
| `src/primitives/useProject/connection.ts` | Logic moved into `WebSocketSyncProvider`. No imports remain. |

Verify with: `grep -r "from.*sync" src/ --include="*.ts" --include="*.tsx"` (and equivalent for each file).

#### 6b: Remove Dead Exports from projectStore.ts

After all consumers migrate, these exports become unused:

- `selectStudies`, `selectStudy`, `selectChecklist`, `selectMembers`, `selectMeta`
- `selectActiveProject`, `selectProject`, `selectStudyPdfs`, `selectPrimaryPdf`
- `setProjectData` (the method on the store)
- `projects` map in store state
- `EMPTY_STUDIES`, `EMPTY_MEMBERS`, `EMPTY_META`, `EMPTY_PDFS` sentinel constants
- `setPendingProjectData`, `getPendingProjectData`

What remains in `projectStore.ts`:
- `activeProjectId` + `setActiveProject`
- `connections` map + `dispatchConnectionEvent` (state machine)
- `projectStats` + `selectProjectStats` (localStorage-persisted, used by dashboard)

#### 6c: Remove Backward-Compatibility Shims

- `phaseToLegacy()` in `connectionReducer.ts` -- exists for old consumers that check boolean flags instead of `phase`. Remove once all consumers use `useConnectionState()`.
- Any `as any` casts in the migration adapter layer that bridge old and new APIs.

#### 6d: Remove Unused Dependencies

Check whether these are still imported after the migration:

- `y-dexie` direct imports (should only be used inside `IndexedDBProvider`)
- `y-websocket` direct imports (should only be used inside `WebSocketSyncProvider`)
- If `zustand/middleware/immer` is no longer needed after `projectStore` shrinks, remove it

Verify with: `pnpm --filter landing build` (tree-shaking will flag unused imports as errors if `verbatimModuleSyntax` is on).

#### 6e: Clean Up the `primitives/useProject/` Directory

After migration, this directory's contents change significantly:

| Current | After |
|---|---|
| `sync.ts` | Deleted |
| `connection.ts` | Deleted (logic in `WebSocketSyncProvider`) |
| `studies.ts` | Stays, but accessed via `StudyHandle` instead of flat ops |
| `checklists/index.ts` | Stays, but accessed via `ChecklistHandle` |
| `checklists/AMSTAR2Handler.ts` | Stays, gains `readAnswers()` from old sync.ts extraction |
| `checklists/ROB2Handler.ts` | Same |
| `checklists/ROBINSIHandler.ts` | Same |
| `pdfs.ts` | Stays, accessed via handle |
| `reconciliation.ts` | Stays, accessed via handle |
| `annotations.ts` | Stays, accessed via handle |
| `outcomes.ts` | Stays, accessed via handle |

Consider reorganizing the directory to reflect the new structure:

```
src/project/
  SessionManager.ts          (new, replaces ConnectionPool)
  ProjectSession.ts          (new)
  ProjectDocument.ts         (new, owns collections + handles)
  connectionReducer.ts       (unchanged)
  collections/
    StudiesCollection.ts     (new)
    MembersCollection.ts     (new)
    MetaCollection.ts        (new)
  handles/
    StudyHandle.ts           (new)
    ChecklistHandle.ts       (new)
  providers/
    WebSocketSyncProvider.ts (new, extracted from connection.ts)
    IndexedDBProvider.ts     (new, extracted from db.ts init logic)
  operations/               (moved from primitives/useProject/)
    studies.ts
    checklists/
    pdfs.ts
    reconciliation.ts
    annotations.ts
    outcomes.ts
  hooks/
    useSession.ts
    useStudies.ts
    useMembers.ts
    useMeta.ts
    useChecklistHandle.ts
    useConnectionState.ts
    usePresence.ts
```

#### 6f: Update Documentation

| Document | Changes Needed |
|---|---|
| `packages/docs/guides/state-management.md` | Remove projectStore data flow, document collection + handle pattern |
| `packages/docs/guides/components.md` | Update data access examples |
| `packages/docs/audits/project-sync-behavior-spec.md` | Rewrite to reflect new architecture |
| `.claude/yjs-sync.mdc` | Update sync pipeline description, remove SyncManager references |
| `.claude/durable-objects.mdc` | Add alarm-based persistence, incremental updates |
| `.claude/reconciliation.mdc` | Update to reference typed handles instead of connectionPool ops |
| `.claude/checklist-operations.mdc` | Update to reference ChecklistHandle API |
| `CLAUDE.md` | Update if any top-level patterns changed |

#### 6g: Pre-Merge Checklist

Before opening the PR to merge the feature branch:

- [ ] `pnpm typecheck` passes with no errors
- [ ] `pnpm lint` passes (no unused imports, no unused variables)
- [ ] `pnpm --filter landing build` succeeds (tree-shaking catches dead code)
- [ ] `pnpm --filter landing test` passes (unit tests)
- [ ] `pnpm --filter workers test` passes (ProjectDoc tests)
- [ ] `pnpm --filter landing test:browser` passes (E2E: all checklist workflows, reconciliation, multi-user)
- [ ] `grep -r "connectionPool" src/` returns zero results (fully removed)
- [ ] `grep -r "setProjectData" src/` returns zero results (fully removed)
- [ ] `grep -r "selectStudies\|selectStudy\|selectChecklist\|selectMembers\|selectMeta" src/` returns zero results (all old selectors removed)
- [ ] `grep -r "ConnectionOps\|buildOpsMap\|getActiveOps" src/` returns zero results (flat ops map removed)
- [ ] `grep -r "syncFromYDoc\|SyncManager" src/` returns zero results (sync pipeline removed)
- [ ] `grep -r "JSON.stringify" src/stores/projectStore.ts` returns zero results (no more stringify equality)
- [ ] No `any` types in new files (handles, collections, hooks) -- enforce with `// @ts-strict` or eslint rule
- [ ] Reference repos in `reference/` not accidentally committed (check `.gitignore`)

---

## Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| Regression in real-time sync | High | Dual-path during phases 1-3. Both systems read from same Y.Doc. E2E tests catch regressions early. |
| observeDeep performance | Medium | Profile in phase 1 with large projects (50+ studies). Lazy path computation is the main cost, but eliminates full tree walk. Net positive expected. Benchmark before committing to phase 2. |
| Snapshot staleness | Low | observeDeep fires synchronously at end of Y.Doc transaction. Snapshots are always consistent with current Y.Doc state. No async gap between mutation and observation. |
| Reconciliation comparison breaks | High | Comparison functions receive the same plain objects as today. Only the source changes (collection snapshot vs sync.ts extraction). E2E reconciliation workflows are the primary gate. |
| observeDeep event.path assumptions | Medium | Must handle top-level changes (study added/removed) where path.length === 0 separately from nested changes. Verified in Y.js source: YMapEvent.keys provides add/update/delete info at each level. Must extract event data inside callback (stale after return). |
| Migration stalls mid-way | Medium | Each phase is independently valuable. Phase 2 alone (incremental snapshots) eliminates the biggest performance problem. Phase 3 alone (typed handles) eliminates type erasure. Neither depends on the other being complete. |
| Memory overhead from snapshot cache | Low | Current system already holds the full extracted state in Zustand. New system holds per-entity snapshots in collection Maps. Total memory roughly equivalent, possibly lower since unchanged entities share references. |

---

## Appendix: Component Inventory

### Display Components (10) -- Migrate in Phase 2

| Component | Current Store Access | New Access |
|---|---|---|
| ProjectView | selectStudies, selectMeta, selectConnectionPhase | useStudies, useMeta, useConnectionState |
| OverviewTab | selectStudies, selectMembers | useStudies, useMembers |
| AllStudiesTab | selectStudies, selectMembers, selectConnectionPhase | useStudies, useMembers, useConnectionState |
| TodoTab | selectStudies, selectMembers, selectConnectionPhase | useStudies, useMembers, useConnectionState |
| ReconcileTab | selectStudies, selectMeta | useStudies, useMeta |
| CompletedTab | selectStudies, meta | useStudies, useMeta |
| ProjectCard | selectProjectStats | Derived from useStudies |
| TodoStudyRow | meta (outcomes) | useMeta |
| AssignReviewersModal | selectMembers, selectStudies | useMembers, useStudies |
| PreviousReviewersView | getChecklistData (read-only) | useChecklistHandle.snapshot() |

### Editor Components (5 primary) -- Migrate in Phase 3

| Component | Current Access | New Access |
|---|---|---|
| ChecklistYjsWrapper | connectionPool.get(): getChecklistData, updateChecklistAnswer, getQuestionNote, getRobinsText, getRob2Text, addAnnotation, updateAnnotation, deleteAnnotation | useChecklistHandle: snapshot(), setAnswer(), textRef(). Annotation handle for PDF operations. |
| ReconciliationWrapper | connectionPool.get(): getChecklistData (x3), updateChecklistAnswer, saveReconciliationProgress, getReconciliationProgress | useChecklistHandle (x3): snapshot(), setAnswer(). useReconciliationHandle: save(), load(). |
| ReconciliationEngine | Operations passed via props | Handles passed via props |
| ROB2/ROBINS-I/AMSTAR2 Adapters | updateChecklistAnswer, getChecklistData | handle.setAnswer(), handle.snapshot() |
| OutcomeManager | meta (outcomes) | useMeta, outcome handle |

### Prop-Driven Components (20+) -- No Migration Needed

All nested checklist components (AMSTAR2Checklist, ROB2Checklist, ROBINSIChecklist and their children: DomainSection, SignallingQuestion, PreliminarySection, etc.) receive data and callbacks as props from their parent editor component. They do not access the store or connection pool directly. When the parent editor migrates to typed handles in Phase 3, these components continue to receive props unchanged.

### Connection State Components (8) -- Migrate in Phase 2

All components reading `selectConnectionPhase` switch to `useConnectionState()`. The underlying state machine (`connectionReducer.ts`) is unchanged.

### Dependency Counts

| Import | File Count |
|---|---|
| `useProjectStore` + selectors | 21 files |
| `connectionPool` | 15 files |
| `sync.ts` (SyncManager) | 1 file (ConnectionPool only) |
| `connectionReducer` | 2 files (projectStore, ConnectionPool) |

No circular dependencies. `sync.ts` is only imported by `ConnectionPool`, making it the easiest to remove once collections replace its role.
