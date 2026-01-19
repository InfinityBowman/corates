# Local-First and Offline Patterns Analysis

**Date:** 2026-01-19
**Analyst:** Claude Sonnet 4.5
**Scope:** Local-first architecture, offline capabilities, sync patterns, conflict resolution, cache management, network resilience

---

## Executive Summary

CoRATES demonstrates **strong local-first fundamentals** with a sophisticated Yjs CRDT-based synchronization system. The application leverages multiple layers of persistence (Dexie with y-dexie, TanStack Query cache, form state) and provides automatic conflict-free collaboration. However, several gaps limit true offline-first capabilities.

### Overall Rating: GOOD (7.5/10)

**Key Strengths:**

- Excellent CRDT-based conflict resolution via Yjs
- Comprehensive multi-layer persistence strategy
- Smart connection management with registry pattern
- Automatic sync on reconnection
- Local-only project mode for complete offline operation

**Critical Gaps:**

- Service worker disabled - no offline app shell
- No optimistic UI updates for mutations
- Limited offline UX indicators
- Missing quota management and eviction policies
- No awareness/presence indicators in UI

---

## Table of Contents

1. [Offline Capability Assessment](#offline-capability-assessment)
2. [Data Synchronization Patterns](#data-synchronization-patterns)
3. [Conflict Resolution Strategies](#conflict-resolution-strategies)
4. [Optimistic Updates](#optimistic-updates)
5. [Cache Management](#cache-management)
6. [Network Resilience](#network-resilience)
7. [Real-Time Collaboration](#real-time-collaboration)
8. [Local-First Maturity Model](#local-first-maturity-model)
9. [Recommendations](#recommendations)

---

## Offline Capability Assessment

### Current State: PARTIAL

#### What Works Offline

**Project Data (Collaborative):**

- Full Y.Doc persistence via y-dexie in unified Dexie database
- All study, checklist, and PDF metadata cached locally
- Changes buffer in Y.Doc and sync when online
- Location: `/packages/web/src/primitives/db.js` (unified database)

**Local Projects:**

- Complete offline functionality with `local-` prefix
- No WebSocket connection required
- Fully functional checklists and study management
- Location: `/packages/web/src/primitives/useProject/index.js:258-264`

**API Response Cache:**

- TanStack Query caches in IndexedDB
- Dual persistence: IndexedDB (primary) + localStorage (fallback)
- 24-hour max cache age
- Location: `/packages/web/src/lib/queryClient.js`

**Form State:**

- Preserves form data across OAuth redirects
- Handles file uploads in progress
- 24-hour expiry
- Location: Database table `formStates`

**PDF Cache:**

- Binary PDF data in IndexedDB
- Composite key: `projectId:studyId:fileName`
- Location: Database table `pdfs`

**Auth Cache:**

- 7-day offline fallback in localStorage
- Allows UI access while offline
- Location: `/packages/web/src/api/better-auth-store.js:14-17`

#### What Breaks Offline

**Application Shell:**

```javascript
// packages/landing/src/entry-client.jsx:39-58
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.unregister(); // ACTIVELY REMOVING
    }
  });
}
```

**Impact:** Complete failure to load on first offline visit. No cached assets, no app shell, blank screen.

**Mutations:**

- No offline queue for API mutations
- TanStack Query mutation networkMode: 'online' (blocks when offline)
- Location: `/packages/web/src/lib/queryClient.js:235`

**Media Files:**

- R2 URLs served from server
- No service worker to intercept/cache
- PDF URLs fail when offline (unless already cached)

### Offline Capability Matrix

| Feature                   | Offline Support | Notes                     |
| ------------------------- | --------------- | ------------------------- |
| **View existing project** | YES             | If previously synced      |
| **Edit checklists**       | YES             | Yjs buffers changes       |
| **Create new study**      | YES             | Syncs when online         |
| **Load app shell**        | NO              | Service worker disabled   |
| **View PDFs**             | PARTIAL         | Only if cached            |
| **Login/signup**          | NO              | Requires server           |
| **Project list**          | YES             | From cache                |
| **Invite members**        | NO              | Mutation blocked          |
| **Upload PDFs**           | NO              | R2 upload requires online |
| **Local checklists**      | YES             | Fully offline             |

---

## Data Synchronization Patterns

### Architecture: Dual-Layer Sync

#### Layer 1: Y.Doc Collaborative Sync (Primary)

**Implementation:** y-dexie + WebSocket Provider

```javascript
// packages/web/src/primitives/useProject/index.js:228-267

// 1. Ensure project exists in Dexie
await db.projects.put({ id: projectId, updatedAt: Date.now() });
const project = await db.projects.get(projectId);

// 2. Load Y.Doc from Dexie
connectionEntry.dexieProvider = DexieYProvider.load(project.ydoc);

connectionEntry.dexieProvider.whenLoaded.then(() => {
  // 3. Apply persisted state to active Y.Doc
  const persistedState = Y.encodeStateAsUpdate(project.ydoc);
  Y.applyUpdate(ydoc, persistedState);

  // 4. Bidirectional sync: active Y.Doc <-> Dexie Y.Doc
  ydoc.on('update', (update, origin) => {
    if (origin !== 'dexie-sync') {
      Y.applyUpdate(project.ydoc, update, 'dexie-sync');
    }
  });
});
```

**Sync Flow:**

1. IndexedDB syncs first (instant UI from local data)
2. WebSocket connects (for online projects)
3. Yjs sync protocol exchanges state vectors
4. Conflicting changes merged automatically (CRDT)
5. UI updates via store sync

**Strengths:**

- Instant initial render from local data
- Automatic conflict resolution
- Efficient delta updates (only changes sync)
- Causal ordering preserved

**Location:** `/packages/web/src/primitives/useProject/index.js:226-267`

#### Layer 2: API Cache Sync (Metadata)

**Implementation:** TanStack Query + IndexedDB Persister

```javascript
// packages/web/src/lib/queryClient.js:24-77

const persistedClient = await persister.restoreClient();
if (persistedClient) {
  const now = Date.now();
  const cacheTimestamp = persistedClient.timestamp || 0;

  // Validate cache age
  if (now - cacheTimestamp > MAX_CACHE_AGE_MS) {
    await persister.removeClient();
  } else {
    // Restore queries with age validation
    for (const query of persistedClient.clientState.queries) {
      const queryAge = now - (query.state?.dataUpdatedAt || 0);
      if (queryAge > MAX_CACHE_AGE_MS) continue; // Skip stale

      // Preserve original timestamp
      queryClient.setQueryData(query.queryKey, query.state.data, {
        updatedAt: query.state.dataUpdatedAt,
      });
    }

    // Invalidate restored queries (background refetch)
    if (navigator.onLine) {
      setTimeout(() => {
        queryClient.invalidateQueries();
      }, 100);
    }
  }
}
```

**Sync Strategy:**

- Network mode: `offlineFirst` (cache-first)
- Stale time: 5 minutes (production)
- Garbage collection time: 10 minutes
- Refetch on reconnect: true
- Refetch on mount: true (if stale)

**Strengths:**

- Instant UI from cache
- Background refetch when stale
- Dual persistence (IndexedDB + localStorage)
- Timestamp preservation prevents false freshness

**Weaknesses:**

- No invalidation from server
- Relies on client-side staleness detection
- 24-hour max age could show very stale data offline

**Location:** `/packages/web/src/lib/queryClient.js`

### Connection Registry Pattern

**Purpose:** Prevent duplicate connections to same project

```javascript
// packages/web/src/primitives/useProject/index.js:27-59

const connectionRegistry = new Map();

function getOrCreateConnection(projectId) {
  if (connectionRegistry.has(projectId)) {
    const entry = connectionRegistry.get(projectId);
    entry.refCount++; // Share connection
    return entry;
  }

  const entry = {
    ydoc: new Y.Doc(),
    dexieProvider: null,
    connectionManager: null,
    syncManager: null,
    studyOps: null,
    checklistOps: null,
    pdfOps: null,
    reconciliationOps: null,
    refCount: 1,
    initialized: false,
  };

  connectionRegistry.set(projectId, entry);
  return entry;
}
```

**Benefits:**

- Multiple components can reference same project
- Single WebSocket per project
- Single Y.Doc instance
- Proper cleanup when all references released

**Rating:** EXCELLENT

---

## Conflict Resolution Strategies

### Strategy: Automatic (CRDT-based)

**Implementation:** Yjs CRDT with Last-Write-Wins for primitives

#### How Conflicts Are Resolved

**Primitive Values (strings, numbers):**

- Last-Write-Wins based on Lamport timestamp
- No user intervention needed
- No conflict UI shown

**Collections (Y.Map, Y.Array):**

- Operations applied in causal order
- Tombstones track deletions
- All operations preserved and merged

**Example: Concurrent Edits**

```
User A (offline):    User B (online):
checklist.q1 = "yes" checklist.q1 = "no"
timestamp: 100       timestamp: 101

Result after sync: "no" (B wins)
```

**No manual resolution UI** - conflicts resolved silently.

#### Conflict-Free Properties

**Location:** `/packages/workers/src/durable-objects/ProjectDoc.ts`

```typescript
// Server-side Y.Doc is authoritative
this.doc.on('update', async (update: Uint8Array, origin: unknown) => {
  // Encode FULL state, not just update
  const fullState = Y.encodeStateAsUpdate(this.doc!);
  await this.state.storage.put('yjs-state', Array.from(fullState));

  // Broadcast to all clients
  this.broadcastBinary(message, origin as WebSocket | null);
});
```

**Client-side sync:**

```javascript
// packages/web/src/primitives/useProject/sync.js:21-51

function syncFromYDoc() {
  const ydoc = getYDoc();
  const studiesMap = ydoc.getMap('reviews');

  // Convert Yjs structures to plain objects
  const studies = Array.from(studiesMap.entries())
    .map(([studyId, studyYMap]) => buildStudyFromYMap(studyId, studyYMap))
    .filter(Boolean);

  // Update store (reactive)
  projectStore.setProjectData(projectId, { studies });
}
```

### Conflict Scenarios Tested

| Scenario                                 | Yjs Behavior                      | User Experience              |
| ---------------------------------------- | --------------------------------- | ---------------------------- |
| Two users edit same field                | LWW by timestamp                  | Later edit wins silently     |
| User offline 2 days, edits, comes online | Operations buffered, replayed     | Seamless merge               |
| Network partition (split-brain)          | Operations buffered on both sides | Automatic merge on reconnect |
| User removed while offline editing       | Access denied on reconnect        | Local data deleted           |
| Rapid field updates                      | Debounced/batched                 | Smooth UI                    |

### Strengths

1. **Zero-configuration conflict resolution**
   - Developers don't handle conflicts
   - No conflict resolution UI needed
   - Works offline/online transparently

2. **Offline-first by design**
   - All edits stored locally first
   - Sync happens asynchronously
   - Network failures don't block edits

3. **Causal consistency**
   - Operations ordered by causality, not time
   - No lost updates
   - Predictable behavior

### Weaknesses

1. **No conflict awareness UI**
   - Users don't know when their change was overwritten
   - No "Your change conflicted with X" notification
   - Silent overwrites could be confusing

2. **No undo/redo**
   - LWW means no merge UI
   - Can't choose "both" resolutions
   - No conflict history

3. **No optimistic rollback**
   - Changes applied immediately to Y.Doc
   - Can't rollback if sync fails
   - No "pending" vs "synced" distinction in UI

**Recommendation:** Add awareness indicators showing when other users are editing same field. Show toast when conflict detected: "Another user updated this field while you were editing."

**Priority:** Medium

---

## Optimistic Updates

### Current State: NONE

**TanStack Query mutations do NOT use optimistic updates:**

```javascript
// packages/web/src/lib/queryClient.js:231-236
mutations: {
  retry: 1,
  networkMode: 'online', // Blocks mutations when offline
}
```

**Yjs writes are immediate to Y.Doc but NOT optimistic:**

```javascript
// packages/web/src/primitives/useProject/checklists/handlers/base.js

export function updateChecklistAnswer(...) {
  const checklistYMap = getChecklistYMap(studyId, checklistId);
  const answersYMap = checklistYMap.get('answers') || new Y.Map();

  // Update Y.Doc immediately
  answerYMap.set('value', value);
  answerYMap.set('notes', notes);

  // UI updates via Y.Doc update event (~10-50ms latency)
  // No "optimistic" flag or state tracking
}
```

### Gap: No Perceived Instant Updates

**User Flow:**

1. User types in checklist answer field
2. Handler calls `updateChecklistAnswer()`
3. Y.Doc updated
4. `ydoc.on('update')` fires
5. `syncManager.syncFromYDoc()` called
6. `projectStore.setProjectData()` updates store
7. UI re-renders

**Latency:** ~10-50ms (usually imperceptible)

**Why no optimistic updates?**

- Yjs sync is already fast (~10-50ms)
- Optimistic updates would duplicate state
- Risk of showing incorrect state if Y.Doc sync fails

**Recommendation:** Add optimistic UI for:

- Study creation (show "Creating..." state)
- PDF uploads (show progress)
- Member invitations (show "Sending..." state)

**Not needed for:**

- Checklist edits (Yjs is fast enough)
- Field updates (real-time is sufficient)

**Priority:** Low (nice-to-have, not critical)

---

## Cache Management

### Multi-Layer Cache Strategy

#### Layer 1: Yjs Y.Doc Cache (per-project)

**Storage:** Dexie database, table `projects`, property `ydoc: Y.Doc`
**Library:** y-dexie (stores Y.Doc directly in Dexie)

```javascript
// packages/web/src/primitives/db.js:132-134
this.version(1).stores({
  // Y.Doc stored as 'ydoc' property via y-dexie
  projects: 'id, orgId, updatedAt, ydoc: Y.Doc',
});
```

**Persistence Strategy:**

- Automatic on every Y.Doc change
- Bidirectional sync between active Y.Doc and Dexie Y.Doc
- No manual eviction (project-specific cleanup only)

**Cleanup Trigger:**

```javascript
// packages/web/src/primitives/useProject/index.js:94-127
export async function cleanupProjectLocalData(projectId) {
  // 1. Destroy Y.Doc connection
  // 2. Delete IndexedDB data
  await deleteProjectData(projectId);
  // 3. Clear in-memory store
  projectStore.clearProject(projectId);
  // 4. Invalidate query cache
  queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
}
```

**Called When:**

- User removed from project (access denied)
- Project deleted
- Manual cleanup (rare)

**Issue:** No automatic eviction for inactive projects

#### Layer 2: PDF Cache

**Storage:** Dexie database, table `pdfs`
**Key:** Composite `projectId:studyId:fileName`

```javascript
// packages/web/src/primitives/db.js:136
pdfs: 'id, projectId, studyId, cachedAt',
```

**Cache Entry:**

```typescript
{
  id: string,           // projectId:studyId:fileName
  projectId: string,
  studyId: string,
  fileName: string,
  data: ArrayBuffer,    // Binary PDF data
  size: number,
  cachedAt: number      // Timestamp
}
```

**Missing:** No LRU eviction, no quota management

**Gap Analysis:**

- PDFs accumulate indefinitely
- Could fill IndexedDB quota (typically 50MB-1GB)
- No automatic cleanup of old/unused PDFs
- No size limit enforcement

**Recommendation:** Implement LRU eviction

```javascript
// Proposed: packages/web/src/primitives/pdfCache.js

const MAX_PDF_CACHE_SIZE_MB = 100;

async function evictLeastRecentlyUsed() {
  const pdfs = await db.pdfs.orderBy('cachedAt').toArray();

  let totalSize = pdfs.reduce((sum, pdf) => sum + pdf.size, 0);
  const maxSize = MAX_PDF_CACHE_SIZE_MB * 1024 * 1024;

  for (const pdf of pdfs) {
    if (totalSize <= maxSize) break;
    await db.pdfs.delete(pdf.id);
    totalSize -= pdf.size;
  }
}
```

**Priority:** Medium

#### Layer 3: TanStack Query Cache

**Storage:** Dexie database, table `queryCache`
**Backup:** localStorage (synchronous fallback)

```javascript
// packages/web/src/lib/queryClient.js:12-13
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_SNAPSHOT_KEY = 'corates-query-cache-snapshot';
```

**Dual Persistence Strategy:**

**Primary: IndexedDB (async, debounced)**

```javascript
// Debounced by 1 second
const persistCache = debounce(async () => {
  const persistedClient = {
    clientState: { queries, mutations },
    timestamp: Date.now(),
  };
  await persister.persistClient(persistedClient);
}, 1000);
```

**Fallback: localStorage (sync, on beforeunload)**

```javascript
window.addEventListener('beforeunload', () => {
  const criticalQueries = queryCache.getAll().slice(0, 10); // Limit to avoid quota

  localStorage.setItem(
    CACHE_SNAPSHOT_KEY,
    JSON.stringify({
      queries: criticalQueries,
      timestamp: Date.now(),
    }),
  );
});
```

**Restoration Priority:**

1. Try IndexedDB first
2. Fallback to localStorage snapshot
3. Use whichever has data (prefer fresher)
4. Clear localStorage snapshot after restore

**Strengths:**

- Dual persistence ensures data survives tab close
- Age validation prevents stale data
- Timestamp preservation for accurate staleness
- Background invalidation on restore

**Weaknesses:**

- No server-driven invalidation
- 24-hour max age could be too long
- No size-based eviction

**Rating:** GOOD

#### Layer 4: Form State Cache

**Storage:** Dexie database, table `formStates`
**Purpose:** Preserve form data across OAuth redirects

```javascript
// packages/web/src/primitives/db.js:142
formStates: 'key, type, timestamp',
```

**Expiry:** 24 hours

**Use Cases:**

- User starts creating project, OAuth redirect, form restored
- User adds studies with PDFs, OAuth redirect, files preserved

**Cleanup:** Automatic on app load

```javascript
// packages/web/src/main.jsx:11-12
bestEffort(cleanupExpiredStates(), { operation: 'cleanupExpiredStates' });
```

**Rating:** EXCELLENT (purpose-fit)

#### Layer 5: Avatar Cache

**Storage:** Dexie database, table `avatars`

```javascript
// packages/web/src/primitives/db.js:140
avatars: 'userId, cachedAt',
```

**Entry:**

```typescript
{
  userId: string,
  dataUrl: string,     // Base64 data URL
  sourceUrl: string,   // For change detection
  cachedAt: number
}
```

**Missing:** No expiry, no size limit

**Recommendation:** Add 7-day expiry, max 100 avatars

**Priority:** Low

#### Layer 6: Auth Cache

**Storage:** localStorage (NOT IndexedDB)
**Keys:** `corates-auth-cache`, `corates-auth-cache-timestamp`
**TTL:** 7 days

```javascript
// packages/web/src/api/better-auth-store.js:14-17
const AUTH_CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
```

**Issue:** localStorage size limits (~5-10MB)
**Risk:** Could fail silently if user object is large

**Recommendation:** Migrate to IndexedDB

**Priority:** Low (rarely hits limits)

### Cache Invalidation Triggers

| Cache Layer  | Invalidation Method | Trigger                         |
| ------------ | ------------------- | ------------------------------- |
| Y.Doc        | Manual cleanup      | Access denied, project deleted  |
| PDF Cache    | None                | (missing)                       |
| Query Cache  | Age-based           | 24 hours, or stale time (5 min) |
| Form State   | Age-based           | 24 hours                        |
| Avatar Cache | None                | (missing)                       |
| Auth Cache   | Age-based           | 7 days                          |

**Missing:** Server-driven invalidation (e.g., via WebSocket push)

---

## Network Resilience

### Connection Management

**Architecture:** WebSocket with Exponential Backoff

#### Online/Offline Detection

**Implementation:** Smart detection with verification

```javascript
// packages/web/src/primitives/useOnlineStatus.js:18-92

export default function useOnlineStatus() {
  const [isOnline, setIsOnline] = createSignal(navigator.onLine);

  // Verify connectivity with actual request
  async function verifyConnectivity() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    await fetch('/api/health', {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-store',
    });
    return true;
  }

  // Debounced handlers
  const debouncedHandleOnline = debounce(async () => {
    const actuallyOnline = await verifyConnectivity();
    if (actuallyOnline) setIsOnline(true);
  }, 500);

  const debouncedHandleOffline = debounce(() => {
    if (!navigator.onLine) setIsOnline(false);
  }, 1000);
}
```

**Features:**

- Don't trust `navigator.onLine` alone
- Verify with HEAD request to `/api/health`
- Debounce to prevent thrashing (1s offline, 500ms online)
- Abort request after 3s timeout

**Strengths:**

- Prevents false positives (browser says online but no connectivity)
- Prevents rapid toggling on flaky networks
- Lightweight check (HEAD request)

**Rating:** EXCELLENT

#### WebSocket Reconnection

**Implementation:** y-websocket provider with custom enhancements

```javascript
// packages/web/src/primitives/useProject/connection.js:31-271

export function createConnectionManager(projectId, ydoc, options) {
  let provider = null;
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 5;

  // Online/offline event handlers
  function handleOnline() {
    if (shouldBeConnected && provider && !provider.wsconnected) {
      provider.connect(); // Resume
    }
  }

  function handleOffline() {
    if (provider) {
      provider.shouldConnect = false; // Pause reconnection
    }
  }

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Create WebSocket provider
  provider = new WebsocketProvider(wsUrl, projectId, ydoc, {
    connect: false, // Don't connect until listeners attached
  });

  // Built-in exponential backoff (y-websocket library)
  // Custom logic: stop after 5 consecutive errors
  provider.on('connection-error', () => {
    if (!navigator.onLine) return; // Don't spam logs when offline

    consecutiveErrors++;

    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      provider.shouldConnect = false; // Give up
      onAccessDenied({ reason: 'connection-failed' });
    }
  });
}
```

**Reconnection Strategy:**

1. Automatic via y-websocket (exponential backoff)
2. Pause when offline (don't waste attempts)
3. Resume on online event
4. Give up after 5 consecutive errors
5. Throttled error logging (prevent console spam)

**Access Denied Handling:**

```javascript
// packages/web/src/primitives/useProject/connection.js:111-165

provider.on('connection-close', event => {
  const reason = event.reason;

  // Permanent failures - stop reconnecting
  if (reason === 'project-deleted') {
    provider.shouldConnect = false;
    onAccessDenied({ reason });
    // Cleanup: delete local Y.Doc, clear cache, redirect
  }

  if (reason === 'membership-revoked') {
    provider.shouldConnect = false;
    onAccessDenied({ reason });
  }

  if (event.code === 1008) {
    // Policy Violation
    provider.shouldConnect = false;
    onAccessDenied({ reason: 'not-a-member' });
  }
});
```

**Close Codes:**

- 1000: Normal closure (project deleted)
- 1008: Policy Violation (not a member)
- Custom reasons: 'project-deleted', 'membership-revoked', 'not-a-member'

**Cleanup on Access Denied:**

```javascript
// packages/web/src/primitives/useProject/index.js:94-127

export async function cleanupProjectLocalData(projectId) {
  // 1. Force destroy connection
  if (connectionRegistry.has(projectId)) {
    entry.connectionManager?.destroy();
    entry.dexieProvider && DexieYProvider.release(entry.ydoc);
    entry.ydoc?.destroy();
    connectionRegistry.delete(projectId);
  }

  // 2. Clear Dexie data (Y.Doc, PDFs)
  await deleteProjectData(projectId);

  // 3. Clear in-memory store
  projectStore.clearProject(projectId);

  // 4. Invalidate query cache
  queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
}
```

**Strengths:**

- Comprehensive cleanup prevents stale data
- Permanent failures don't retry indefinitely
- Access control enforced on reconnect

**Rating:** EXCELLENT

#### Retry Strategy (TanStack Query)

```javascript
// packages/web/src/lib/queryClient.js:223-225
retry: 3,
retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
```

**Backoff Schedule:**

- Attempt 1: immediate
- Attempt 2: 2s
- Attempt 3: 4s
- Attempt 4: 8s
- Max: 30s

**Issue:** Retries even when offline

**Recommendation:**

```javascript
retry: (failureCount, error) => {
  if (!navigator.onLine) return false; // Don't retry offline
  return failureCount < 3;
};
```

**Priority:** Low (only adds ~14s delay)

### Edge Cases Handled

| Scenario                           | Handling                       | Location                 |
| ---------------------------------- | ------------------------------ | ------------------------ |
| **Offline during initial connect** | Don't attempt, wait for online | connection.js:70-74      |
| **Connection dropped mid-session** | Auto-reconnect (y-websocket)   | Built-in                 |
| **Rapid network toggling**         | Debounce, use latest state     | useOnlineStatus.js:49-78 |
| **User removed while offline**     | Access denied on reconnect     | connection.js:132-144    |
| **Project deleted while offline**  | Access denied, cleanup         | connection.js:117-129    |
| **Multiple tabs same project**     | BroadcastChannel sync          | y-websocket built-in     |
| **5+ consecutive errors**          | Give up, show error            | connection.js:186-198    |

**Rating:** EXCELLENT

---

## Real-Time Collaboration (Yjs Usage)

### Architecture: Yjs CRDT with Durable Objects

#### Server: ProjectDoc Durable Object

**Location:** `/packages/workers/src/durable-objects/ProjectDoc.ts`

**Key Features:**

- Authoritative Y.Doc instance per project
- Persistent storage in Durable Object storage
- WebSocket broadcast to all connected clients
- Awareness protocol for presence

```typescript
// packages/workers/src/durable-objects/ProjectDoc.ts:441-488

async initializeDoc() {
  this.doc = new Y.Doc();
  this.awareness = new awarenessProtocol.Awareness(this.doc);

  // Load persisted state
  const persistedState = await this.state.storage.get<number[]>('yjs-state');
  if (persistedState) {
    Y.applyUpdate(this.doc, new Uint8Array(persistedState));
  }

  // Persist FULL state on every update
  this.doc.on('update', async (update: Uint8Array, origin: unknown) => {
    const fullState = Y.encodeStateAsUpdate(this.doc!);
    await this.state.storage.put('yjs-state', Array.from(fullState));

    // Broadcast to all clients
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeUpdate(encoder, update);
    const message = encoding.toUint8Array(encoder);
    this.broadcastBinary(message, origin as WebSocket | null);
  });

  // Broadcast awareness updates
  this.awareness.on('update', ({ added, updated, removed }, origin) => {
    const changedClients = added.concat(updated, removed);
    if (changedClients.length > 0) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageAwareness);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(this.awareness!, changedClients)
      );
      const message = encoding.toUint8Array(encoder);
      this.broadcastBinary(message, origin as WebSocket | null);
    }
  });
}
```

**Strengths:**

- Single source of truth (Durable Object)
- Guaranteed persistence (DO storage)
- Automatic broadcast to all sessions
- Awareness protocol included

#### Client: y-websocket Provider + y-dexie

**Location:** `/packages/web/src/primitives/useProject/index.js:226-290`

```javascript
// Set up Dexie persistence
const project = await db.projects.get(projectId);
connectionEntry.dexieProvider = DexieYProvider.load(project.ydoc);

connectionEntry.dexieProvider.whenLoaded.then(() => {
  // Apply persisted state
  const persistedState = Y.encodeStateAsUpdate(project.ydoc);
  Y.applyUpdate(ydoc, persistedState);

  // Bidirectional sync
  ydoc.on('update', (update, origin) => {
    if (origin !== 'dexie-sync') {
      Y.applyUpdate(project.ydoc, update, 'dexie-sync');
    }
  });

  // Sync UI from local data
  connectionEntry.syncManager.syncFromYDoc();
});

// Create WebSocket connection
connectionEntry.connectionManager = createConnectionManager(projectId, ydoc, {
  onSync: () => {
    projectStore.setConnectionState(projectId, { synced: true });
    connectionEntry.syncManager?.syncFromYDoc();
  },
});
```

**Data Flow:**

1. Dexie loads persisted Y.Doc
2. UI renders from local data (instant)
3. WebSocket connects to Durable Object
4. Sync protocol exchanges state vectors
5. Durable Object sends missing updates
6. Client applies updates, persists to Dexie
7. UI re-renders with merged state

**Strengths:**

- Instant UI from local data
- Automatic sync on reconnect
- Conflict-free merging
- Offline edits buffered and synced

#### Y.Doc Structure

```
Project (Y.Doc)
├── meta: Y.Map
│   ├── name: string
│   ├── description: string
│   ├── createdAt: number
│   └── updatedAt: number
├── members: Y.Map
│   └── userId: Y.Map
│       ├── role: string
│       ├── joinedAt: number
│       ├── name: string
│       └── image: string
└── reviews: Y.Map (NOTE: 'reviews' for backward compat, means 'studies')
    └── studyId: Y.Map
        ├── name: string
        ├── checklists: Y.Map
        │   └── checklistId: Y.Map
        │       ├── type: string
        │       ├── status: string
        │       └── answers: Y.Map
        │           └── questionKey: Y.Map
        │               ├── value: any
        │               ├── notes: string
        │               └── updatedAt: number
        ├── pdfs: Y.Map
        │   └── fileName: Y.Map
        │       ├── key: string
        │       ├── size: number
        │       └── uploadedAt: number
        └── reconciliation: Y.Map
```

**Location:** Documented in `/packages/docs/guides/yjs-sync.md:16-31`

### Awareness Protocol

**Server:** Broadcasts awareness updates to all clients

```typescript
// packages/workers/src/durable-objects/ProjectDoc.ts:467-486
this.awareness.on('update', ({ added, updated, removed }, origin) => {
  const changedClients = added.concat(updated, removed);
  if (changedClients.length > 0) {
    // Encode and broadcast
    const message = encoding.toUint8Array(encoder);
    this.broadcastBinary(message, origin);
  }
});
```

**Client:** Can set local awareness state

```javascript
// Example (not currently used in UI):
const awareness = connectionManager.getAwareness();
awareness.setLocalStateField('user', {
  name: user.name,
  color: '#ff0000',
  cursor: { line: 5, column: 10 },
});
```

**Gap:** Awareness data is tracked but NOT displayed in UI

**Missing Features:**

- No "User X is viewing this checklist" indicators
- No cursor positions shown
- No "User Y is typing" indicators
- No user avatars on active fields

**Recommendation:** Add awareness indicators

```jsx
// Proposed: packages/web/src/components/checklist/AwarenessIndicator.jsx
const awareness = connectionManager.getAwareness();

createEffect(() => {
  awareness.on('update', ({ added, updated }) => {
    const states = awareness.getStates();
    const activeUsers = Array.from(states.values()).filter(state => state.user?.checklistId === checklistId);

    setActiveUsers(activeUsers);
  });
});

return (
  <div class='flex -space-x-2'>
    <For each={activeUsers()}>{user => <Avatar src={user.image} title={user.name} />}</For>
  </div>
);
```

**Priority:** Low (nice-to-have)

### Session Management

**Server tracks sessions:**

```typescript
// packages/workers/src/durable-objects/ProjectDoc.ts:145-151
private sessions: Map<WebSocket, SessionData>;

interface SessionData {
  user: { id: string };
  awarenessClientId: number | null;
}
```

**Session lifecycle:**

1. WebSocket connects
2. Auth verified (D1 membership check)
3. Session stored with user info
4. Awareness client ID stored when first awareness message received
5. Session removed on disconnect
6. Awareness state cleaned up

**Location:** `/packages/workers/src/durable-objects/ProjectDoc.ts:490-669`

**Rating:** EXCELLENT

---

## Local-First Maturity Model

### Maturity Levels (1-5)

**Level 1: Online-Only**

- No offline support
- No local persistence
- Network required for all operations

**Level 2: Basic Caching**

- Read-only cache
- No offline writes
- Simple invalidation

**Level 3: Offline Reads + Queue**

- Read from cache offline
- Writes queue and sync
- Basic conflict handling

**Level 4: Optimistic Updates**

- Instant UI updates
- Background sync
- Automatic conflict resolution
- Awareness of sync state

**Level 5: Fully Local-First**

- Local-first by default
- P2P sync (optional server)
- Rich conflict resolution
- Offline-first UX

### CoRATES Assessment: Level 3.5

**Breakdown by Feature:**

| Feature                 | Level | Rationale                            |
| ----------------------- | ----- | ------------------------------------ |
| **Y.Doc Sync**          | 5     | CRDT, offline edits, automatic merge |
| **API Cache**           | 3     | Offline reads, no mutation queue     |
| **Conflict Resolution** | 5     | Automatic, CRDT-based                |
| **Persistence**         | 4     | Multi-layer, durable, no eviction    |
| **Network Resilience**  | 4     | Smart reconnect, exponential backoff |
| **Offline UX**          | 2     | No indicators, no service worker     |
| **Optimistic Updates**  | 1     | None (Yjs is fast enough)            |
| **Awareness/Presence**  | 3     | Tracked but not displayed            |
| **Service Worker**      | 0     | Disabled                             |

**Overall:** 3.5 (between Offline Reads and Optimistic Updates)

### Gaps to Level 4

1. Enable service worker (offline app shell)
2. Add offline UX indicators (syncing, last synced)
3. Display awareness/presence in UI
4. Add optimistic UI for mutations
5. Implement cache eviction policies

### Gaps to Level 5

1. P2P sync (WebRTC, no server required)
2. Rich conflict resolution UI
3. Granular sync control
4. Offline-first mutations (queue)
5. IndexedDB quota management with user choice

---

## Recommendations

### Critical (Must-Do)

#### C1: Enable Service Worker for Web Package

**Issue:** App completely broken on first offline load

**Solution:**

1. Uncomment service worker registration in `/packages/web/src/main.jsx`
2. Scope to `/app.html` and assets only (not landing pages)
3. Test offline loading, navigation, cache busting

**Implementation:**

```javascript
// packages/web/src/main.jsx (add after line 17)
if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      })
      .then(reg => {
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.info('[SW] New version available');
              // Optional: Show "Update available" toast
            }
          });
        });
      });
  });
}
```

**Effort:** 2-4 hours
**Impact:** HIGH - Transforms offline UX from "broken" to "functional"
**Priority:** CRITICAL

#### C2: Add Global Offline Indicator

**Issue:** Users don't know when offline

**Solution:**

```jsx
// packages/web/src/Layout.jsx or Navbar.jsx
import useOnlineStatus from '@/primitives/useOnlineStatus';

function OfflineBanner() {
  const isOnline = useOnlineStatus();

  return (
    <Show when={!isOnline()}>
      <div class='flex items-center gap-2 border-b bg-yellow-50 px-4 py-2'>
        <AlertCircle class='h-4 w-4 text-yellow-600' />
        <p class='text-sm text-yellow-800'>You're offline. Changes will sync when connection is restored.</p>
      </div>
    </Show>
  );
}
```

**Effort:** 1 hour
**Impact:** HIGH - User awareness
**Priority:** CRITICAL

### High Priority

#### H1: Add Background Refetch Indicators

**Issue:** Users don't know if cached data is being refreshed

**Solution:**

```jsx
// packages/web/src/components/dashboard/ProjectsSection.jsx
const { data, isRefetching, dataUpdatedAt } = useProjectList();

<Show when={isRefetching()}>
  <div class='flex items-center gap-2 text-sm text-gray-600'>
    <Spinner class='h-4 w-4 animate-spin' />
    Syncing project list...
  </div>
</Show>;
```

**Effort:** 2-3 hours
**Impact:** Medium - Transparency
**Priority:** HIGH

#### H2: Add "Last Synced" Timestamps

**Issue:** Users can't tell if data is fresh or stale

**Solution:**

```jsx
import { formatDistanceToNow } from 'date-fns';

<Show when={dataUpdatedAt()}>
  <span class='text-xs text-gray-500'>Last synced {formatDistanceToNow(dataUpdatedAt(), { addSuffix: true })}</span>
</Show>;
```

**Effort:** 2-3 hours
**Impact:** Medium - Trust
**Priority:** HIGH

#### H3: Implement IndexedDB Quota Management

**Issue:** No handling when storage quota exceeded

**Solution:**

```javascript
// packages/web/src/primitives/useProject/index.js

async function handleQuotaError(projectId) {
  const estimate = await navigator.storage.estimate();
  const usedPercent = (estimate.usage / estimate.quota) * 100;

  if (usedPercent > 80) {
    // Show modal: "Storage almost full. Delete old projects?"
    const projects = await db.projects.orderBy('updatedAt').toArray();
    // UI: List projects with size, allow deletion
  }
}

// Wrap Dexie operations
try {
  connectionEntry.dexieProvider = DexieYProvider.load(project.ydoc);
} catch (err) {
  if (err.name === 'QuotaExceededError') {
    await handleQuotaError(projectId);
  }
}
```

**Effort:** 6-8 hours
**Impact:** Medium - Prevents data loss
**Priority:** HIGH

### Medium Priority

#### M1: Add PDF Cache LRU Eviction

**Issue:** PDFs accumulate indefinitely

**Solution:**

```javascript
// packages/web/src/primitives/pdfCache.js
const MAX_PDF_CACHE_SIZE_MB = 100;

async function evictLeastRecentlyUsed() {
  const pdfs = await db.pdfs.orderBy('cachedAt').toArray();

  let totalSize = pdfs.reduce((sum, pdf) => sum + pdf.size, 0);
  const maxSize = MAX_PDF_CACHE_SIZE_MB * 1024 * 1024;

  for (const pdf of pdfs) {
    if (totalSize <= maxSize) break;
    await db.pdfs.delete(pdf.id);
    totalSize -= pdf.size;
  }
}

// Call before caching new PDF
await evictLeastRecentlyUsed();
await cachePdf(pdfData);
```

**Effort:** 3-4 hours
**Impact:** Medium - Prevents quota issues
**Priority:** MEDIUM

#### M2: Migrate Auth Cache to IndexedDB

**Issue:** localStorage size limits (5-10MB)

**Solution:**

```javascript
// packages/web/src/api/auth-cache.js
import { db } from '@/primitives/db';

export async function saveAuthCache(userData) {
  await db.authCache.put({
    key: 'current-user',
    data: userData,
    timestamp: Date.now(),
  });
}

export async function loadAuthCache() {
  const cache = await db.authCache.get('current-user');
  if (!cache) return null;

  const age = Date.now() - cache.timestamp;
  if (age > AUTH_CACHE_MAX_AGE) {
    await db.authCache.delete('current-user');
    return null;
  }

  return cache.data;
}
```

**Effort:** 4-5 hours
**Impact:** Low - Robustness
**Priority:** MEDIUM

#### M3: Add Connection Status Badges

**Issue:** No visual sync status per project

**Solution:**

```jsx
// packages/web/src/components/dashboard/ProjectCard.jsx
const { connected, synced } = useProject(project.id);

<Badge
  variant={
    synced() ? 'success'
    : connected() ?
      'warning'
    : 'error'
  }
>
  {synced() ?
    'Synced'
  : connected() ?
    'Syncing...'
  : 'Offline'}
</Badge>;
```

**Effort:** 3-4 hours
**Impact:** Medium - Status visibility
**Priority:** MEDIUM

### Low Priority

#### L1: Add Awareness Indicators

**Issue:** No visibility of other users' presence

**Solution:**

```jsx
// packages/web/src/components/checklist/ChecklistView.jsx
const awareness = connectionManager.getAwareness();

createEffect(() => {
  awareness.on('update', ({ added, updated, removed }) => {
    const states = awareness.getStates();
    const activeUsers = Array.from(states.values()).filter(state => state.user?.checklistId === checklistId);
    setActiveUsers(activeUsers);
  });
});

<div class='flex -space-x-2'>
  <For each={activeUsers()}>{user => <Avatar src={user.image} title={`${user.name} is viewing`} />}</For>
</div>;
```

**Effort:** 6-8 hours
**Impact:** Low - Collaboration UX
**Priority:** LOW

#### L2: Add Optimistic UI for Mutations

**Issue:** Small lag for API mutations (not Yjs)

**Solution:**

```javascript
// packages/web/src/primitives/useProjectList.js
import { useMutation } from '@tanstack/solid-query';

const createProjectMutation = useMutation({
  mutationFn: createProject,
  onMutate: async newProject => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['projects'] });

    // Snapshot previous value
    const previous = queryClient.getQueryData(['projects']);

    // Optimistically update
    queryClient.setQueryData(['projects'], old => [
      ...old,
      {
        ...newProject,
        id: `temp-${Date.now()}`,
        status: 'creating',
      },
    ]);

    return { previous };
  },
  onError: (err, variables, context) => {
    // Rollback on error
    queryClient.setQueryData(['projects'], context.previous);
  },
  onSettled: () => {
    // Refetch
    queryClient.invalidateQueries({ queryKey: ['projects'] });
  },
});
```

**Effort:** 8-10 hours (complex state management)
**Impact:** Low - Yjs already fast
**Priority:** LOW

#### L3: Skip Retries When Offline

**Issue:** Wastes 3 retry attempts when offline

**Solution:**

```javascript
// packages/web/src/lib/queryClient.js:223
retry: (failureCount, error) => {
  if (!navigator.onLine) return false;
  return failureCount < 3;
};
```

**Effort:** 30 minutes
**Impact:** Low - Only saves ~14s delay
**Priority:** LOW

---

## Implementation Roadmap

### Week 1 (Critical)

1. Enable service worker for web package (C1)
2. Add global offline banner (C2)
3. Test offline scenarios thoroughly

**Deliverables:**

- Functional offline app shell
- User awareness of connection status
- No white screen on offline load

### Week 2 (High Priority)

1. Add background refetch indicators (H1)
2. Add "last synced" timestamps (H2)
3. Implement quota management (H3)

**Deliverables:**

- Transparent sync status
- Trust in data freshness
- Protected against quota errors

### Week 3 (Medium Priority)

1. Add PDF cache eviction (M1)
2. Migrate auth cache to IndexedDB (M2)
3. Add connection status badges (M3)

**Deliverables:**

- Sustainable cache sizes
- Robust auth caching
- Per-project sync visibility

### Month 2 (Low Priority)

1. Add awareness indicators (L1)
2. Add optimistic UI where needed (L2)
3. Small optimizations (L3)

**Deliverables:**

- Enhanced collaboration UX
- Perceived performance gains
- Minor efficiency improvements

---

## Conclusion

CoRATES has **strong local-first foundations** anchored by a well-designed Yjs CRDT synchronization system. The multi-layer persistence strategy (Dexie/y-dexie, TanStack Query, form state, PDF cache) provides comprehensive offline data availability. Network resilience is excellent with smart reconnection, access control enforcement, and graceful degradation.

### Key Strengths

1. **CRDT-based sync** - Automatic conflict resolution, no manual handling needed
2. **Unified Dexie database** - Clean architecture with y-dexie integration
3. **Connection registry pattern** - Prevents duplicate connections, proper cleanup
4. **Smart online detection** - Verified with real requests, debounced
5. **Local project mode** - Complete offline functionality without account

### Critical Gaps

1. **Service worker disabled** - No offline app shell (HIGH IMPACT)
2. **No offline UX indicators** - Users unaware of sync state
3. **Missing cache eviction** - Risk of quota exceeded
4. **No awareness UI** - Presence tracked but not shown
5. **No optimistic updates** - Small perceived latency (minor issue)

### Recommended Priority

**Immediate (Week 1):**

- Enable service worker (transforms offline UX)
- Add offline banner (user awareness)

**Short-term (Weeks 2-3):**

- Sync status indicators (transparency)
- Quota management (data protection)
- Cache eviction policies (sustainability)

**Long-term (Month 2+):**

- Awareness indicators (collaboration UX)
- Optimistic UI (perceived performance)
- Minor optimizations

With these improvements, CoRATES will achieve **Level 4 local-first maturity** and provide best-in-class offline support for a collaborative web application.

---

**Report End**

For implementation assistance or questions, consult the development team.
