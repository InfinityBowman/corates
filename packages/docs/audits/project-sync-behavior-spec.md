# Project Sync System: Behavior Specification

This document describes the current behavior of the project sync system as of 2026-03-18. It serves as the contract any refactor must satisfy -- every behavior listed here must still work after migration.

## System Overview

The project sync system manages real-time collaborative editing of project data via Yjs CRDTs. It has five layers:

```
UI Components (React)
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

**Data flow for local mutations:** Component calls operation -> operation mutates Y.Doc -> Y.Doc fires `update` event -> sync.js reads full Y.Doc -> pushes to Zustand store -> React re-renders. Simultaneously, the update is written to Dexie (IndexedDB) and sent to the server via y-websocket.

**Data flow for remote mutations:** Server sends Y.Doc update via WebSocket -> y-websocket applies to Y.Doc -> same `update` event -> same sync path.

---

## Y.Doc Schema

```
Y.Doc
  meta (Y.Map)
    name: string
    description: string | null
    updatedAt: number
    outcomes (Y.Map)
      {outcomeId} (Y.Map)
        name: string
        createdAt: number
        createdBy: string
    ...other project settings

  members (Y.Map)
    {userId} (Y.Map)
      role: string
      joinedAt: number
      name, email, givenName, familyName, image: string

  reviews (Y.Map)  -- "reviews" = studies
    {studyId} (Y.Map)
      name, description: string
      createdAt, updatedAt: number
      reviewer1, reviewer2: string | null
      originalTitle, firstAuthor, publicationYear, authors, journal,
      doi, abstract, importSource, pdfUrl, pdfSource, pmid, url,
      volume, issue, pages, type: string | null
      pdfAccessible: boolean

      checklists (Y.Map)
        {checklistId} (Y.Map)
          type: string (AMSTAR2 | ROBINS_I | ROB2)
          title: string
          assignedTo: string | null
          outcomeId: string | null
          status: string (pending | in-progress | reviewer-completed |
                          reconciling | finalized)
          createdAt, updatedAt: number
          answers (Y.Map)
            ...type-specific nested structure (see Checklist Handlers)

      pdfs (Y.Map)
        {pdfId} (Y.Map)
          id, key, fileName: string
          size: number
          uploadedBy: string
          uploadedAt: number
          tag: 'primary' | 'protocol' | 'secondary'
          title, firstAuthor, publicationYear, journal, doi: string | null

      annotations (Y.Map)
        {checklistId} (Y.Map)
          {annotationId} (Y.Map)
            id, pdfId, type: string
            pageIndex: number
            embedPdfData: string (JSON)
            createdBy: string
            createdAt, updatedAt: number
            mergedFrom: string | null

      reconciliations (Y.Map)  -- new format, per-outcome
        {outcomeKey} (Y.Map)
          checklist1Id, checklist2Id: string
          outcomeId: string | null
          type: string
          reconciledChecklistId: string | null
          currentPage: number
          viewMode: string
          updatedAt: number

      reconciliation (Y.Map)  -- legacy format, single per study
        checklist1Id, checklist2Id: string
        reconciledChecklistId: string | null
        currentPage, viewMode, updatedAt: ...
```

### Checklist Answer Schemas (per type)

**AMSTAR2:** Flat map of question keys (`q1`-`q16`, `q9a`, `q9b`, `q11a`, `q11b`). Each question is a Y.Map with `answers` (2D boolean array), `critical` (boolean), and `note` (Y.Text). Parent questions `q9` and `q11` have only a `note` Y.Text.

**ROBINS-I:** Nested by section. Domain keys (`domain1a`-`domain6`, `overall`) each contain `judgement`, `judgementSource`, `direction`, and nested `answers` Y.Map where each question has `answer` (string) and `comment` (Y.Text). `sectionB` has similar per-question Y.Maps. `sectionA`, `sectionC`, `sectionD`, `planning` have Y.Text fields for collaborative editing. `confoundingEvaluation` has `predefined` and `additional` arrays.

**ROB2:** Similar to ROBINS-I for domains. `preliminary` section has `studyDesign`, `aim`, `deviationsToAddress` (array), `sources` (object), plus Y.Text fields for `experimental`, `comparator`, `numericalResult`.

---

## Connection Lifecycle

### Initialization Sequence

When a user navigates to `/projects/:projectId`:

1. TanStack Router renders `ProjectLayout` which passes `projectId` to `<ProjectView>`.
2. `ProjectView` calls `useProject(projectId)`.
3. `useProject`'s `useLayoutEffect` fires (synchronous, before paint):
   a. `getOrCreateConnection(projectId)` -- gets or creates a ref-counted registry entry containing a fresh `Y.Doc`.
   b. If the entry was already `initialized` (shared connection), skips setup and returns cleanup.
   c. Marks `initialized = true`.
   d. Creates all domain operation modules: `syncManager`, `studyOps`, `checklistOps`, `pdfOps`, `reconciliationOps`, `annotationOps`, `outcomeOps`.
   e. Registers ~40 operations with `projectActionsStore._setConnection(projectId, ops)`.
   f. Attaches `ydoc.on('update')` handler that calls `syncManager.syncFromYDoc()` on every update (gated by `isLoadingPersistedState` flag).
   g. **Dexie setup (async):** Ensures project row in IndexedDB, loads `DexieYProvider`, applies persisted state to Y.Doc, sets up write-back handler. Guarded by `cancelled` flag at every async boundary.
   h. **WebSocket setup (parallel with Dexie):** Creates `connectionManager` with callbacks for `onSync`, `isLocalProject`, `onAccessDenied`. Calls `connect()` which creates a `WebsocketProvider` and begins the Yjs sync protocol.
4. `ProjectView`'s `useEffect` calls `projectActionsStore._setActiveProject(projectId, orgId)`.
5. `<ProjectProvider>` wraps children with context providing `projectId`, `orgId`, `userRole`, `isOwner`, helper functions, and `projectOps`.

### Teardown Sequence

When the user navigates away:

1. `ProjectView` unmounts. `useEffect` cleanup calls `projectActionsStore._clearActiveProject()`.
2. `useLayoutEffect` cleanup sets `cancelled = true` and calls `releaseConnection(projectId)`.
3. `releaseConnection` decrements `refCount`. At 0:
   a. Runs all registered `_cleanupHandlers` (Y.Doc update listeners, Dexie write-back).
   b. `connectionManager.destroy()` -- tears down WebSocket, removes window event listeners.
   c. `DexieYProvider.release(ydoc)` -- releases Dexie persistence.
   d. `ydoc.destroy()` -- destroys the Y.Doc.
   e. Deletes entry from `connectionRegistry`.
   f. `projectActionsStore._removeConnection(projectId)`.
   g. Sets Zustand connection state to `{ connected: false, synced: false }`.

### Connection State Transitions

Current state is 4 booleans: `connected`, `connecting`, `synced`, `error`.

| Event | connected | connecting | synced | error |
|---|---|---|---|---|
| Initial mount | false | true | false | null |
| WebSocket connected | true | false | (unchanged) | null |
| Yjs sync complete | true | false | true | null |
| WebSocket disconnected | false | false | (unchanged) | null |
| Connection error | false | false | (unchanged) | 'Connection error' |
| 5 consecutive errors | false | false | false | 'Unable to connect...' |
| Access denied | false | false | false | (specific message) |
| Unmount / cleanup | false | false | false | null |

### Ref-Counting (Shared Connections)

The `connectionRegistry` (module-level Map) allows multiple components to share one Y.Doc and WebSocket for the same project. `getOrCreateConnection` increments `refCount`; `releaseConnection` decrements it. Teardown only happens when `refCount` reaches 0.

### Online/Offline Handling

**Going offline:** `connection.js` sets `provider.shouldConnect = false` (stops y-websocket reconnection) but preserves `shouldBeConnected = true` (intent to connect).

**Coming back online:** Two mechanisms respond:
1. `connection.js handleOnline()`: if `shouldBeConnected` and provider exists but not connected, calls `provider.connect()`.
2. `useProject useEffect(isOnline)`: detects offline-to-online transition via `wasOnlineRef`, calls `connectionManager.reconnect()`.

### Error Thresholds

`consecutiveErrors` counter in `connection.js`:
- Incremented on every `connection-error` event when online.
- Reset to 0 on successful WebSocket connection.
- At 5 consecutive errors: gives up, sets error state, calls `onAccessDenied({ reason: 'connection-failed' })` which triggers full local data cleanup.

### Access Denied Handling

Three WebSocket close reasons trigger immediate cleanup:
- `project-deleted` -- "This project has been deleted"
- `membership-revoked` -- "You have been removed from this project"
- `not-a-member` (code 1008) -- "You are not a member of this project"

All three: set error in store, stop reconnection, call `onAccessDenied` which calls `cleanupProjectLocalData(projectId)` -- destroys connection, deletes Dexie data, clears Zustand store, invalidates query cache.

---

## API Surface

### useProject(projectId) Return Object

**Reactive state (from Zustand):**
- `connected`, `connecting`, `synced`: boolean
- `error`: string | null
- `studies`: StudyInfo[]
- `meta`: Record<string, unknown>
- `members`: unknown[]
- `isLocalProject`: boolean

**Study operations:**
- `createStudy(name, description?, metadata?)` -> string | null
- `updateStudy(studyId, updates)` -> void
- `deleteStudy(studyId)` -> void
- `updateProjectSettings(settings)` -> void
- `renameProject(newName)` -> Promise<string> (HTTP + Y.Doc + Zustand + query cache)
- `updateDescription(newDescription)` -> Promise<string> (HTTP + Y.Doc + Zustand + query cache)

**Checklist operations:**
- `createChecklist(studyId, type?, assignedTo?, outcomeId?)` -> string | null
- `updateChecklist(studyId, checklistId, updates)` -> void
- `deleteChecklist(studyId, checklistId)` -> void
- `getChecklistAnswersMap(studyId, checklistId)` -> Y.Map | null (raw Y.Map reference)
- `getChecklistData(studyId, checklistId)` -> Object | null (serialized plain object)
- `updateChecklistAnswer(studyId, checklistId, key, data)` -> void (auto-transitions status from PENDING to IN_PROGRESS)
- `getQuestionNote(studyId, checklistId, questionKey)` -> Y.Text | null (AMSTAR2)
- `getRobinsText(studyId, checklistId, sectionKey, fieldKey, questionKey?)` -> Y.Text | null (ROBINS-I)
- `getRob2Text(studyId, checklistId, sectionKey, fieldKey, questionKey?)` -> Y.Text | null (ROB2)

**PDF operations:**
- `addPdfToStudy(studyId, pdfInfo, tag?)` -> string | null
- `removePdfFromStudy(studyId, pdfId)` -> void
- `removePdfByFileName(studyId, fileName)` -> void
- `updatePdfTag(studyId, pdfId, tag)` -> void (clears existing primary/protocol first)
- `updatePdfMetadata(studyId, pdfId, metadata)` -> void
- `setPdfAsPrimary(studyId, pdfId)` -> void
- `setPdfAsProtocol(studyId, pdfId)` -> void

**Reconciliation operations:**
- `saveReconciliationProgress(studyId, outcomeId, type, progressData)` -> void
- `getReconciliationProgress(studyId, outcomeId, type)` -> Object | null (reads new format, falls back to legacy)
- `getAllReconciliationProgress(studyId)` -> Array (deduplicates new + legacy formats)
- `clearReconciliationProgress(studyId, outcomeId, type)` -> void

**Annotation operations:**
- `addAnnotation(studyId, pdfId, checklistId, annotationData, userId?)` -> string | null
- `addAnnotations(studyId, pdfId, checklistId, annotations, userId?)` -> string[] (uses Y.Doc transact for atomic batch)
- `updateAnnotation(studyId, checklistId, annotationId, annotationData)` -> void
- `deleteAnnotation(studyId, checklistId, annotationId)` -> void
- `getAnnotations(studyId, pdfId, checklistId)` -> Array
- `getAllAnnotationsForPdf(studyId, pdfId)` -> Object (keyed by checklistId)
- `clearAnnotationsForChecklist(studyId, checklistId)` -> void
- `mergeAnnotations(studyId, pdfId, targetChecklistId, sourceChecklistIds, userId)` -> number (uses Y.Doc transact)

**Outcome operations:**
- `getOutcomes()` -> Array (sorted by createdAt)
- `getOutcome(outcomeId)` -> Object | null
- `createOutcome(name, createdBy)` -> string | null
- `updateOutcome(outcomeId, name)` -> boolean
- `deleteOutcome(outcomeId)` -> { success, error? } (rejects if outcome is in use)
- `isOutcomeInUse(outcomeId)` -> boolean

**Connection:**
- `connect()` -> no-op
- `disconnect()` -> calls releaseConnection
- `getAwareness()` -> Awareness | null

### projectActionsStore Singleton

**Lifecycle methods (called by useProject and ProjectView):**
- `_setActiveProject(projectId, orgId)` -- stores both IDs in closure
- `_clearActiveProject()` -- nulls both
- `_setConnection(projectId, ops)` -- registers Y.js operations
- `_removeConnection(projectId)` -- unregisters them

**Public accessors (non-throwing):**
- `getActiveProjectId()` -> string | null
- `getActiveOrgId()` -> string | null

**Action modules** -- each resolves the active connection internally:

`study.create(name, description?, metadata?)` -> string | null
`study.update(studyId, updates)` -> void (toast on error)
`study.delete(studyId)` -> void (async, deletes PDFs from R2 + clears IndexedDB cache first)
`study.addBatch(studiesToAdd)` -> { successCount, manualPdfCount } (async, full PDF upload orchestration)
`study.importReferences(references)` -> number

`checklist.create(studyId, type, assigneeId, outcomeId?)` -> boolean (toast with type-specific error messages)
`checklist.update(studyId, checklistId, updates)` -> void (toast on error)
`checklist.delete(studyId, checklistId)` -> void (toast on error)
`checklist.getAnswersMap(studyId, checklistId)` -> Y.Map | undefined
`checklist.getData(studyId, checklistId)` -> Object | null (graceful null on "No active project" during navigation transitions)
`checklist.updateAnswer(studyId, checklistId, questionId, answer, note)` -> void
`checklist.getQuestionNote(studyId, checklistId, questionId)` -> Y.Text | undefined

`pdf.view(studyId, pdf)` -> void (async, opens pdfPreviewStore, loads from cache/cloud)
`pdf.download(studyId, pdf)` -> void (async, triggers browser download)
`pdf.upload(studyId, file, tag?)` -> string (async, uploads to R2, caches, extracts metadata, adds to Y.Doc)
`pdf.delete(studyId, pdf)` -> void (async, 3-step: R2 delete, cache delete, Y.Doc delete)
`pdf.updateTag(studyId, pdfId, newTag)` -> void
`pdf.updateMetadata(studyId, pdfId, metadata)` -> void
`pdf.handleGoogleDriveImport(studyId, file, tag?)` -> void (async, downloads, caches, extracts metadata)
`pdf.addToStudy(studyId, pdfMeta, tag)` -> void (low-level pass-through)

`project.rename(newName)` -> void (async, toast on error)
`project.updateDescription(newDescription)` -> void (async, toast on error)
`project.delete()` -> void (async, HTTP DELETE + query cache invalidation)
`project.deleteById(targetProjectId, targetOrgId?)` -> void (async)

`member.remove(memberId)` -> { isSelf: boolean } (async, HTTP DELETE)

`reconciliation.saveProgress(studyId, c1Id, c2Id, data)` -> void
`reconciliation.getProgress(studyId, c1Id, c2Id)` -> Object | undefined
`reconciliation.applyToChecklists(studyId, c1Id, c2Id, data)` -> void

`outcome.create(name)` -> string | null
`outcome.update(outcomeId, name)` -> boolean
`outcome.delete(outcomeId)` -> { success, error? }
`outcome.isInUse(outcomeId)` -> boolean

---

## Zustand Store (projectStore)

### Shape

```typescript
{
  projects: Record<string, {
    meta: Record<string, unknown>;
    members: unknown[];
    studies: StudyInfo[];
  }>;
  activeProjectId: string | null;
  connections: Record<string, {
    connected: boolean;
    connecting: boolean;
    synced: boolean;
    error: string | null;
  }>;
  projectStats: Record<string, {
    studyCount: number;
    completedCount: number;
    lastUpdated: number;
  }>;
}
```

### Actions

- `setActiveProject(projectId)` -- sets `activeProjectId`
- `setProjectData(projectId, data)` -- merges meta/members/studies, auto-computes stats
- `setConnectionState(projectId, state)` -- merges partial connection state
- `clearProject(projectId)` -- deletes project data + connection state

### Selectors (pure functions)

All return stable references via module-level EMPTY_* constants when data is missing:

- `selectProject(state, projectId)` -> ProjectData | undefined
- `selectActiveProject(state)` -> ProjectData | null
- `selectConnectionState(state, projectId)` -> ConnectionState
- `selectProjectStats(state, projectId)` -> ProjectStats | null
- `selectStudies(state, projectId)` -> StudyInfo[]
- `selectMembers(state, projectId)` -> unknown[]
- `selectMeta(state, projectId)` -> Record<string, unknown>
- `selectStudy(state, projectId, studyId)` -> StudyInfo | null
- `selectChecklist(state, projectId, studyId, checklistId)` -> ChecklistInfo | null
- `selectStudyPdfs(state, projectId, studyId)` -> PdfInfo[]
- `selectPrimaryPdf(state, projectId, studyId)` -> PdfInfo | null

### Pending Project Data

Module-level `Map` (outside Zustand) for passing data from project creation to ProjectView:
- `setPendingProjectData(projectId, data)` -- stashes PDFs/refs/drive files
- `getPendingProjectData(projectId)` -- reads and deletes (consumed once)

---

## Consumer Inventory

### Files importing projectActionsStore (13 files)

| File | Methods Used |
|---|---|
| `useProject/index.js` | `_setConnection`, `_removeConnection` |
| `useProject/studies.js` | `getActiveOrgId()` |
| `ProjectView.tsx` | `_setActiveProject`, `_clearActiveProject`, `study.create`, `pdf.addToStudy`, `project.rename`, `project.updateDescription` |
| `ChecklistYjsWrapper.tsx` | `_setActiveProject` (no clear on unmount) |
| `ReconciliationWrapper.tsx` | `_setActiveProject` (no clear on unmount) |
| `OutcomeManager.tsx` | `outcome.create`, `outcome.update`, `outcome.delete` |
| `ToDoTab.tsx` | `checklist.create`, `checklist.delete`, `pdf.view`, `pdf.download` |
| `OverviewTab.tsx` | `member.remove`, `checklist.getData` |
| `CompletedTab.tsx` | `pdf.view`, `pdf.download` |
| `ReconcileTab.tsx` | `pdf.view`, `pdf.download` |
| `StudyPdfSection.tsx` | `pdf.upload`, `pdf.view`, `pdf.download`, `pdf.delete`, `pdf.updateTag`, `pdf.updateMetadata` |
| `StudyCardHeader.tsx` | `study.update`, `study.delete` |
| `AllStudiesTab.tsx` | `study.update`, `study.addBatch`, `pdf.handleGoogleDriveImport` |

All TypeScript consumers use `import _projectActionsStore ... as any` cast workaround.

### Files calling useProjectContext() (12 files)

| File | Destructured Fields |
|---|---|
| `ProjectHeader.tsx` | `userRole` |
| `OverviewTab.tsx` | `projectId`, `orgId`, `isOwner` |
| `AllStudiesTab.tsx` | `projectId`, `getMember`, `isOwner` |
| `ToDoTab.tsx` | `projectId`, `getChecklistPath` |
| `TodoStudyRow.tsx` | `projectId` |
| `ChecklistForm.tsx` | `projectId` |
| `ReconcileTab.tsx` | `projectId`, `getAssigneeName`, `getReconcilePath` |
| `CompletedTab.tsx` | `projectId`, `getAssigneeName`, `getChecklistPath` |
| `OutcomeManager.tsx` | `projectId`, `isOwner` |
| `ChecklistYjsWrapper.tsx` | `orgId`, `projectOps` |
| `ReconciliationWrapper.tsx` | `orgId`, `projectOps` |
| `PreviousReviewersView.tsx` | `projectOps` |

Only child-route components (`ChecklistYjsWrapper`, `ReconciliationWrapper`, `PreviousReviewersView`) access `projectOps` for Y.js operations. Tab components use `projectId` for store reads and context helpers for role checks/path generation.

---

## Sync Manager Behavior

`syncFromYDoc()` performs a **complete snapshot** on every call:
1. Reads all studies from `reviews` Y.Map, building full objects (checklists, PDFs, annotations, reconciliation).
2. Reads all metadata from `meta` Y.Map (including outcomes).
3. Reads all members from `members` Y.Map.
4. Pushes to Zustand in a single `setProjectData()` call.

**No incremental/differential sync.** Every Y.Doc update triggers a full re-read.

**No debouncing.** The only throttling is the `isLoadingPersistedState` guard that suppresses syncs during Dexie state restoration.

**Trigger points:** Y.Doc `update` event (every local or remote mutation), after Dexie state load, after WebSocket sync completion.

---

## Known Edge Cases

### Dexie Corruption Recovery

If persisted Y.Doc state in IndexedDB is corrupted (`Y.encodeStateAsUpdate` or `Y.applyUpdate` throws), the corrupted data is deleted via fire-and-forget `deleteProjectData(projectId).catch(() => {})`. The Y.Doc starts empty and the WebSocket repopulates from the server. This is silent -- no user notification.

### StrictMode Double-Mount

React 18 Strict Mode mounts, unmounts, then re-mounts. The `cancelled` flag in `useLayoutEffect` causes the first mount's async operations (Dexie load) to bail out. The cleanup calls `releaseConnection` which decrements refCount to 0 and destroys everything. The second mount creates a fresh connection. This works correctly because all async boundaries check `if (cancelled) return`.

### Dexie and WebSocket Race

Dexie load and WebSocket connection happen in parallel. Yjs CRDTs handle this correctly -- applying the same updates in any order produces the same result. The `isLoadingPersistedState` flag suppresses store syncs during Dexie application to avoid intermediate states in the UI.

### PDF Tag Uniqueness

`addPdfToStudy` and `updatePdfTag` enforce that only one PDF per study can have the `primary` tag and one can have the `protocol` tag. Before setting either, `clearTag(studyId, tag)` demotes any existing PDF with that tag to `secondary`.

### Y.Text Identity Preservation

The ROBINS-I and ROB2 handlers use `setYTextField()` which clears and re-inserts content into an existing Y.Text rather than replacing the Y.Text object. This preserves the Y.Text identity so that other peers' references to the same Y.Text remain valid during collaborative editing.

### Checklist Status Auto-Transition

`updateChecklistAnswer` auto-transitions status from `PENDING` to `IN_PROGRESS` on the first answer write. This happens inside the checklist operations module, not in the caller.

### Reconciliation Progress Migration

`getReconciliationProgress` reads the new per-outcome format first (`reconciliations/{outcomeKey}`), then falls back to the legacy single format (`reconciliation`). `getAllReconciliationProgress` deduplicates entries that appear in both formats.

### Outcome Deletion Guard

`deleteOutcome` iterates ALL studies and ALL their checklists to check if any checklist references the outcome. If so, deletion is rejected with `{ success: false, error: 'Cannot delete outcome that is in use by checklists' }`.

### Unhandled: Dexie Completely Unavailable

The initial `db.projects.get(projectId)` call in the Dexie setup chain has no `.catch()`. If IndexedDB is completely unavailable (e.g., private browsing quota exceeded), this results in an unhandled promise rejection. The WebSocket connection still works, but offline persistence is silently broken.

### Redundant Online Reconnection

Both `connection.js handleOnline()` and `useProject useEffect(isOnline)` respond to the online event. In practice this is harmless (reconnecting an already-connecting provider is a no-op in y-websocket), but it is unnecessary duplication.
