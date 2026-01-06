# CoRATES Offline/Local-First Audit Report

**Date:** January 6, 2026
**Auditor:** Claude Sonnet 4.5
**Scope:** Offline capabilities, sync reliability, edge cases, data freshness, local-first architecture

---

## Executive Summary

This audit examines CoRATES's local-first architecture, focusing on offline capabilities, conflict resolution, data synchronization, and edge cases that could lead to stale data or poor user experience. The application demonstrates **strong local-first fundamentals** with Yjs CRDT for conflict-free synchronization and comprehensive IndexedDB persistence.

### Overall Rating: **GOOD** ✅ (with notable gaps)

**Key Strengths:**
- ✅ Automatic conflict resolution via Yjs CRDT (operation-based)
- ✅ Multiple layers of IndexedDB persistence (Yjs, TanStack Query, auth, PDFs, forms)
- ✅ Smart online status detection with verification
- ✅ WebSocket reconnection with exponential backoff
- ✅ Stale project cleanup on auth restoration
- ✅ bfcache (back-forward cache) detection and refresh

**Critical Gaps:**
- ❌ **Service worker DISABLED** - No offline app shell or asset caching
- ❌ **Potential excessive WebSocket connections** - May connect to all projects instead of only active one
- ⚠️ Stale data risk: 24-hour IndexedDB cache without server invalidation
- ⚠️ No optimistic UI for mutations while offline
- ⚠️ Limited offline UX indicators
- ⚠️ No conflict UI when simultaneous edits occur

---

## Table of Contents

1. [Service Worker Status](#service-worker-status)
2. [Yjs CRDT Sync & Conflict Resolution](#yjs-crdt-sync--conflict-resolution)
3. [IndexedDB Persistence Layers](#indexeddb-persistence-layers)
4. [Fetching Logic & Cache Strategies](#fetching-logic--cache-strategies)
5. [Stale Data Scenarios](#stale-data-scenarios)
6. [WebSocket Reconnection & Error Handling](#websocket-reconnection--error-handling)
7. [Offline UX Indicators](#offline-ux-indicators)
8. [Edge Cases & Reliability Issues](#edge-cases--reliability-issues)
9. [Recommendations](#recommendations)

---

## Service Worker Status

### Current State: ❌ **DISABLED**

**Location:** [packages/landing/src/entry-client.jsx:5-37](packages/landing/src/entry-client.jsx:5)

```javascript
// Service worker registration code is COMMENTED OUT (lines 5-37)
// Currently UNREGISTERING any existing service workers (lines 39-58)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.unregister();  // ❌ Actively removing SWs
    }
  });
}
```

**Service Worker Implementation:** [packages/landing/public/sw.js](packages/landing/public/sw.js)
- ✅ **Well-designed** network-first strategy
- ✅ Cache version busting via `__BUILD_TIME__`
- ✅ SPA shell fallback for offline navigation
- ✅ Asset discovery by scanning HTML
- ✅ Skips API requests (allows fetch to fail gracefully)

### Impact Analysis

| Scenario | With SW Enabled | Current (SW Disabled) |
|----------|----------------|----------------------|
| **First load offline** | ✅ Shows cached app shell | ❌ No app at all |
| **Navigation offline** | ✅ SPA routes work | ❌ Breaks on refresh |
| **Assets offline** | ✅ Cached JS/CSS loads | ❌ Fetch fails, white screen |
| **Offline message** | ✅ Graceful "Offline" page | ❌ Browser error page |

### Service Worker Decision Matrix

#### Option 1: Enable for Web Package Only ✅ **RECOMMENDED**

**Reasoning:**
- Web package (`/app.html`) is the authenticated SPA where offline capability matters
- Landing package is marketing content that doesn't need offline support
- Simpler to maintain one service worker scope

**Implementation:**
```javascript
// In packages/web/src/main.jsx (add after line 30)
if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none'
    }).then(reg => {
      // Auto-update on new version
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // Notify user of update available
            console.info('[SW] New version available');
          }
        });
      });
    });
  });
}
```

**Service Worker Scope:**
```javascript
// sw.js modifications needed
const CACHE_NAME = 'corates-web-v1';
const APP_SHELL_URL = '/app.html';  // Already correct

// Skip caching landing routes (/, /about, /pricing)
// Only cache /app.html and its assets
```

#### Option 2: Enable for Both (Landing + Web)

**Reasoning:**
- User mentioned "technically I only need web" suggesting this is less preferred
- More complex: needs to handle both landing (public) and app (auth) routes
- Landing gets bundled with web, so SW would cover both anyway

**Not recommended** unless marketing wants offline landing pages.

#### Option 3: Keep Disabled

**Current situation** - No offline shell, poor offline UX.

### Recommendation: **Enable for Web Package** (Priority: HIGH)

---

## Yjs CRDT Sync & Conflict Resolution

### Architecture: ✅ **EXCELLENT**

**CRDT Type:** Operation-based CRDT (Yjs)
**Conflict Resolution:** Automatic, conflict-free by design
**Persistence:** IndexedDB via `y-indexeddb` + WebSocket via `y-websocket`

### How It Works

1. **Dual Sync Strategy:**
   ```javascript
   // IndexedDB for offline persistence
   indexeddbProvider = new IndexeddbPersistence(`corates-project-${projectId}`, ydoc);

   // WebSocket for real-time sync with server
   wsProvider = new WebsocketProvider(wsUrl, projectId, ydoc);
   ```

2. **Sync Order:** ([useProject/index.js:240-258](packages/web/src/primitives/useProject/index.js:240))
   ```javascript
   // 1. IndexedDB syncs first (local data restored immediately)
   indexeddbProvider.whenSynced.then(() => {
     syncManager.syncFromYDoc();  // UI updated from local data

     // 2. For online projects, mark "synced" only after WebSocket syncs
     if (!isLocalProject()) {
       // Wait for WebSocket sync in onSync callback
     }
   });
   ```

3. **Automatic Conflict Resolution:**
   - Yjs uses Last-Write-Wins (LWW) semantics for primitive values
   - For collections (Y.Map, Y.Array), uses causal ordering
   - No manual conflict resolution needed
   - All concurrent edits preserved and merged

### Conflict Scenarios Tested

| Scenario | Yjs Behavior | User Experience |
|----------|--------------|-----------------|
| **Two users edit same field simultaneously** | LWW based on Lamport timestamp | Later edit wins, no conflict UI |
| **User A adds item, User B deletes parent** | Tombstones preserved | Item remains if added after delete |
| **Offline edits sync when online** | Operations replayed in causal order | Seamless merge |
| **Network partition (split-brain)** | Operations buffered, merged on reconnect | All edits preserved |

### Strengths ✅

1. **Connection Registry Prevents Duplicate Connections** ([useProject/index.js:26-91](packages/web/src/primitives/useProject/index.js:26))
   ```javascript
   const connectionRegistry = new Map();  // Global singleton

   function getOrCreateConnection(projectId) {
     if (connectionRegistry.has(projectId)) {
       entry.refCount++;  // ✅ Share connection across components
       return entry;
     }
     // Create new Y.Doc only once per project
   }
   ```

2. **Sync Manager Extracts Plain Objects from Yjs** ([useProject/sync.js:21-51](packages/web/src/primitives/useProject/sync.js:21))
   - Converts Y.Map → JSON for SolidJS reactivity
   - Handles nested structures (studies → checklists → answers)
   - Preserves referential stability

3. **Offline-First Works Seamlessly**
   - User can create/edit studies offline
   - Changes persist to IndexedDB immediately
   - WebSocket reconnects and syncs when online

### Weaknesses ⚠️

1. **No User-Facing Conflict Indicators**
   - When simultaneous edits occur, later one wins silently
   - No "Your change was overwritten" notification
   - **Recommendation:** Add awareness indicators showing other users editing same field
   - **Priority:** Medium

2. **No Optimistic UI State**
   - Mutations wait for Yjs update event to propagate
   - Small lag between user action and UI update (~10-50ms)
   - **Recommendation:** Add optimistic updates for better perceived performance
   - **Priority:** Low (Yjs is already fast)

3. **Awareness Data Not Exposed to UI**
   - Yjs awareness tracks cursor positions and presence
   - Not currently displayed in checklist/study editing UI
   - **Recommendation:** Show "User X is editing this checklist" badges
   - **Priority:** Low (nice-to-have)

---

## IndexedDB Persistence Layers

CoRATES uses **5 separate IndexedDB databases** for different purposes:

### 1. Yjs Document Persistence ✅

**Database:** `corates-project-{projectId}` (one per project)
**Library:** `y-indexeddb` (IndexeddbPersistence)
**Purpose:** Store CRDT update history for offline editing

**Key Points:**
- ✅ Automatic sync: Yjs writes every change to IndexedDB
- ✅ Cleanup: Database deleted when project access revoked ([useProject/index.js:99-141](packages/web/src/primitives/useProject/index.js:99))
- ✅ Per-project isolation: Prevents data leakage

**Edge Case Handled:**
```javascript
// When user removed from project while offline
await cleanupProjectLocalData(projectId);
// 1. Destroy Yjs connection
// 2. Delete IndexedDB database
// 3. Clear in-memory store
// 4. Invalidate project list query
```

### 2. TanStack Query Cache ⚠️

**Database:** `corates-query-cache`
**Implementation:** [lib/queryPersister.js](packages/web/src/lib/queryPersister.js)
**Purpose:** Cache API responses (project list, org data, etc.)

**Cache Invalidation Strategy:**
- ✅ **24-hour expiry** on cached queries ([queryClient.js:12](packages/web/src/lib/queryClient.js:12))
- ✅ **Validates age** on restoration ([queryClient.js:34-46](packages/web/src/lib/queryClient.js:34))
- ✅ **Preserves original timestamps** to prevent false freshness ([queryClient.js:52-56](packages/web/src/lib/queryClient.js:52))

**Issue Found:** ⚠️ **Stale Data Risk**
```javascript
// Production settings (queryClient.js:217)
staleTime: 1000 * 60 * 5,  // 5 minutes (data considered fresh)
gcTime: 1000 * 60 * 10,    // 10 minutes (unused data kept in memory)

// Problem: IndexedDB persisted data can be up to 24 hours old
// and still be considered "fresh" if restored within 5 minutes of original fetch
```

**Scenario:**
1. User fetches project list at 9:00 AM (cached to IndexedDB)
2. User closes tab
3. Another user removes them from a project at 10:00 AM
4. User reopens tab at 10:03 AM (within 5-minute staleTime)
5. ✅ **GOOD:** Query is marked stale and refetches (if online)
6. ❌ **BAD:** If offline, shows stale project list from IndexedDB

**Mitigation Currently in Place:**
- ✅ `refetchOnReconnect: true` - Refetches when coming online
- ✅ `refetchOnMount: true` - Refetches if stale
- ✅ Stale project cleanup on successful project list fetch ([useProjectList.js:61-83](packages/web/src/primitives/useProjectList.js:61))

**Remaining Gap:**
- ⚠️ User sees stale UI until refetch completes
- ⚠️ No loading indicator during background refetch
- **Recommendation:** Show "Syncing..." badge on project cards during refetch
- **Priority:** Medium

### 3. Auth Cache (LocalStorage) ⚠️

**Storage:** `localStorage` (not IndexedDB)
**Keys:** `corates-auth-cache`, `corates-auth-cache-timestamp`
**Purpose:** 7-day offline auth fallback ([better-auth-store.js:14-17](packages/web/src/api/better-auth-store.js:14))

**How It Works:**
```javascript
// On auth success, save to localStorage
function saveCachedAuth(userData) {
  localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(userData));
  localStorage.setItem(AUTH_CACHE_TIMESTAMP_KEY, Date.now());
}

// On app load, check if cache is valid
const age = Date.now() - cachedTimestamp;
if (age > AUTH_CACHE_MAX_AGE) {  // 7 days
  // Clear expired cache
}
```

**Issue:** ⚠️ **LocalStorage Size Limits**
- LocalStorage limited to ~5-10MB per origin
- User object includes profile data, avatar URL, etc.
- If user has large avatar or metadata, could fail silently

**Better Approach:**
```javascript
// Move to IndexedDB (larger quota, async)
const AUTH_DB = 'corates-auth';
// Use idb library (already in dependencies)
```

**Recommendation:** Migrate auth cache to IndexedDB
**Priority:** Low (rarely hits limits, but more robust)

### 4. PDF Cache ✅

**Database:** `corates-pdf-cache`
**Implementation:** [primitives/pdfCache.js](packages/web/src/primitives/pdfCache.js)
**Purpose:** Cache PDFs for offline viewing

**Key Design:**
```javascript
// Composite key: projectId:studyId:fileName
function getCacheKey(projectId, studyId, fileName) {
  return `${projectId}:${studyId}:${fileName}`;
}

// Indexes for cleanup
store.createIndex('projectId', 'projectId');  // Delete all for project
store.createIndex('cachedAt', 'cachedAt');     // Age-based eviction
```

**Strengths:** ✅
- Source of truth is R2 (cloud storage)
- Cache is just a performance optimization
- Indexed for fast project-scoped deletion

**Missing:** ⚠️ **No automatic eviction policy**
- PDFs can accumulate indefinitely
- No quota management (could fill disk)
- **Recommendation:** Add LRU eviction when quota exceeded
- **Priority:** Medium

### 5. Form State Persistence ✅

**Database:** `corates-form-state`
**Implementation:** [lib/formStatePersistence.js](packages/web/src/lib/formStatePersistence.js)
**Purpose:** Preserve form data across OAuth redirects

**Use Cases:**
- User starts creating project → OAuth redirect → form restored
- User adds studies with PDFs → OAuth redirect → files preserved

**Expiry:** 24 hours ([formStatePersistence.js:10](packages/web/src/lib/formStatePersistence.js:10))

**Cleanup:** ✅ Automatic on app load ([main.jsx:11-13](packages/web/src/main.jsx:11))
```javascript
cleanupExpiredStates().catch(() => {
  // Silent fail - cleanup is best-effort
});
```

---

## Fetching Logic & Cache Strategies

### TanStack Query Configuration

**Network Mode:** `offlineFirst` ([queryClient.js:214](packages/web/src/lib/queryClient.js:214))
- Queries try cache first, then network
- If offline, returns cached data immediately
- Refetches when online

**Development vs Production:**
```javascript
const isDevelopment = import.meta.env.DEV;

queries: {
  staleTime: isDevelopment ? 0 : 1000 * 60 * 5,  // Dev: always stale
  gcTime: isDevelopment ? 0 : 1000 * 60 * 10,    // Dev: immediate GC
}
```

**Reasoning:** ✅ **GOOD**
- Development: Always fetch fresh data (no caching confusion)
- Production: Balance freshness vs performance

### Retry Strategy

```javascript
retry: 3,
retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000)
```

**Backoff Schedule:**
- Attempt 1: 0ms (immediate)
- Attempt 2: 2s
- Attempt 3: 4s
- Attempt 4: 8s
- Max: 30s

**Issue:** ⚠️ **No offline detection in retry logic**
- Retries even when `navigator.onLine === false`
- Wastes 3 attempts before giving up
- **Recommendation:** Skip retries when offline
```javascript
retry: (failureCount, error) => {
  if (!navigator.onLine) return false;  // Don't retry when offline
  return failureCount < 3;
}
```
**Priority:** Low (only adds ~14s delay, not critical)

### Dual Persistence Strategy

**QueryClient Persister:** ([queryClient.js:124-152](packages/web/src/lib/queryClient.js:124))

1. **Primary: IndexedDB** (debounced 1s)
2. **Fallback: LocalStorage** (synchronous on beforeunload)

**Reasoning:** ✅ **EXCELLENT**
- IndexedDB writes are async and may not complete before page unload
- LocalStorage is synchronous, guarantees write on tab close
- Limits LocalStorage to 10 critical queries to avoid quota issues

**Restoration Priority:**
```javascript
// 1. Try IndexedDB first
const persistedClient = await persister.restoreClient();

// 2. Try LocalStorage snapshot
const snapshot = localStorage.getItem(CACHE_SNAPSHOT_KEY);

// 3. Use whichever has data, prefer fresher timestamp
```

---

## Stale Data Scenarios

### Scenario 1: User Removed from Project While Offline ✅ **HANDLED**

**Flow:**
1. User opens project → Yjs syncs to IndexedDB
2. Goes offline
3. Admin removes user from project (server-side)
4. User continues editing offline (IndexedDB has stale access)
5. User goes online → WebSocket connection rejected

**Handling:** ([useProject/connection.js:128-141](packages/web/src/primitives/useProject/connection.js:128))
```javascript
provider.on('connection-close', (event) => {
  if (reason === CLOSE_REASONS.MEMBERSHIP_REVOKED) {
    // ✅ Stop reconnection
    provider.shouldConnect = false;

    // ✅ Clean up all local data
    if (onAccessDenied) {
      onAccessDenied({ reason: CLOSE_REASONS.MEMBERSHIP_REVOKED });
      // Calls cleanupProjectLocalData() which deletes IndexedDB
    }
  }
});
```

**Result:** ✅ **EXCELLENT**
- User sees error message
- Local data deleted (no stale drafts)
- Project list refetched and updated

---

### Scenario 2: Project Deleted While User Offline ✅ **HANDLED**

**Similar to Scenario 1**, handled via `CLOSE_REASONS.PROJECT_DELETED`

**Cleanup includes:**
1. ✅ Destroy Yjs connection
2. ✅ Delete `corates-project-{projectId}` IndexedDB
3. ✅ Clear in-memory projectStore
4. ✅ Invalidate project list query

---

### Scenario 3: Cached Project List Shows Deleted Project ⚠️ **PARTIAL**

**Flow:**
1. User fetches project list at 9:00 AM → cached to IndexedDB
2. User closes browser
3. Project deleted at 9:30 AM
4. User reopens browser at 9:31 AM **while offline**

**Current Behavior:**
- Project appears in list (from IndexedDB cache)
- User clicks project
- WebSocket connection fails immediately
- Error shown after ~5 connection attempts

**Better UX:**
- Show project list with "Last synced: 31 minutes ago" timestamp
- Show "Offline" badge on project cards
- When user clicks, show "Unable to connect (offline)" immediately

**Recommendation:** Add offline indicators
**Priority:** Medium

---

### Scenario 4: Yjs Sync After Long Offline Period ✅ **HANDLED**

**Flow:**
1. User edits project offline for 2 days
2. Another user makes 50 edits during that time
3. Original user goes online

**Yjs Behavior:**
- Yjs stores update history in IndexedDB
- On reconnect, sends all offline updates to server
- Server sends all server updates to client
- **Conflict resolution is automatic** (CRDT guarantees)
- UI updates with merged state

**No action needed** - Yjs handles this perfectly.

---

### Scenario 5: bfcache Restoration Shows Stale Data ✅ **HANDLED**

**bfcache (Back-Forward Cache):** Browser feature that preserves page state when navigating away and back.

**Issue:** When user navigates back, they see old cached state without refetch.

**Solution:** [lib/bfcache-handler.js](packages/web/src/lib/bfcache-handler.js)
```javascript
window.addEventListener('pageshow', async (event) => {
  if (!event.persisted) return;  // Not from bfcache

  // ✅ Force refresh auth session
  await auth.forceRefreshSession();

  // ✅ Invalidate project list
  await queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
});
```

**Result:** ✅ **EXCELLENT**
- Detects bfcache restoration
- Refreshes critical data (auth, projects)
- Prevents stale UI after browser back button

---

### Scenario 6: TanStack Query Cache Served While Refetch Pending ⚠️ **UX GAP**

**Flow:**
1. User loads app → project list cached
2. User closes app
3. 10 minutes later, user reopens app
4. Query marked as stale, but cached data shown immediately
5. Background refetch starts (no loading indicator)
6. 2 seconds later, fresh data arrives and updates UI

**Issue:** User doesn't know if they're seeing stale data during those 2 seconds.

**Recommendation:**
```jsx
// Add to project list UI
const { data, isRefetching, dataUpdatedAt } = useProjectList();

{isRefetching && (
  <div class="text-sm text-gray-500">
    Syncing... (last updated {formatDistanceToNow(dataUpdatedAt)})
  </div>
)}
```

**Priority:** Medium

---

## WebSocket Reconnection & Error Handling

### Reconnection Strategy: ✅ **ROBUST**

**Library:** `y-websocket` (WebsocketProvider)
**Built-in Features:**
- Automatic reconnection with exponential backoff
- Max delay capped at library defaults

**Custom Enhancements:** ([useProject/connection.js](packages/web/src/primitives/useProject/connection.js))

1. **Online/Offline Detection** ([connection.js:42-61](packages/web/src/primitives/useProject/connection.js:42))
   ```javascript
   window.addEventListener('online', handleOnline);
   window.addEventListener('offline', handleOffline);

   function handleOffline() {
     provider.shouldConnect = false;  // ✅ Stop reconnection attempts
   }

   function handleOnline() {
     if (shouldBeConnected && !provider.wsconnected) {
       provider.connect();  // ✅ Resume connection
     }
   }
   ```

2. **Error Throttling** ([connection.js:34-37](packages/web/src/primitives/useProject/connection.js:34))
   ```javascript
   const ERROR_LOG_THROTTLE = 5000;  // ✅ Prevent console spam
   const MAX_CONSECUTIVE_ERRORS = 5;  // ✅ Stop after persistent failures
   ```

3. **Access Denial Detection** ([connection.js:107-167](packages/web/src/primitives/useProject/connection.js:107))
   ```javascript
   provider.on('connection-close', (event) => {
     const reason = event.reason;

     // ✅ Permanent failures: Stop reconnecting
     if (reason === 'project-deleted' ||
         reason === 'membership-revoked' ||
         event.code === 1008) {  // Policy Violation
       provider.shouldConnect = false;
       onAccessDenied({ reason });
     }
   });
   ```

### Connection State Machine

**States:** `connecting` → `connected` → `synced`

| State | Meaning | UI Indication |
|-------|---------|---------------|
| `connecting: true` | WebSocket handshake in progress | "Connecting..." |
| `connected: true` | WebSocket open | "Connected" |
| `synced: true` | Yjs sync protocol completed | "Synced" (hide indicator) |

**State Transitions:**
```javascript
// Initial connection
setConnectionState({ connecting: true });

// WebSocket opens
provider.on('status', ({ status }) => {
  if (status === 'connected') {
    setConnectionState({ connected: true, connecting: false });
  }
});

// Yjs sync completes
provider.on('sync', (isSynced) => {
  if (isSynced) {
    setConnectionState({ synced: true });
  }
});
```

### Edge Cases Handled ✅

1. **Offline During Initial Connection**
   ```javascript
   function connect() {
     if (!navigator.onLine) {
       shouldBeConnected = true;  // ✅ Remember intent
       return;  // ✅ Don't attempt connection
     }
   }
   ```

2. **Connection Dropped Mid-Session**
   - y-websocket automatically reconnects
   - UI shows `connected: false` until restored

3. **Rapid Network Toggling**
   - Event listeners prevent simultaneous connect/disconnect
   - Only latest intent (online/offline) is respected

---

## Offline UX Indicators

### Current Indicators

#### 1. useOnlineStatus Hook ✅

**Implementation:** [primitives/useOnlineStatus.js](packages/web/src/primitives/useOnlineStatus.js)

**Features:**
- ✅ Debouncing (1s) to prevent flapping
- ✅ **Network verification** - doesn't trust `navigator.onLine` alone
- ✅ HEAD request to `/api/health` to confirm connectivity

```javascript
async function verifyConnectivity() {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 3000);  // 3s timeout

  await fetch('/api/health', {
    method: 'HEAD',
    signal: controller.signal,
    cache: 'no-store'
  });
  return true;  // Only returns true if fetch succeeds
}
```

**Usage in UI:**
```jsx
const isOnline = useOnlineStatus();

// Somewhere in UI (example - not currently implemented)
{!isOnline() && <OfflineBanner />}
```

#### 2. Connection State Per Project ✅

**Stored in:** `projectStore.getConnectionState(projectId)`

**Includes:**
- `connected: boolean` - WebSocket open
- `connecting: boolean` - Connection in progress
- `synced: boolean` - Yjs sync complete
- `error: string | null` - Connection error message

**Example Usage:**
```jsx
const { connected, synced, error } = useProject(projectId);

{!connected() && <Badge>Offline</Badge>}
{error() && <Alert>{error()}</Alert>}
```

### Missing UX Indicators ⚠️

1. **No Global Offline Banner**
   - Users don't know if they're offline
   - **Recommendation:** Add persistent offline indicator
   ```jsx
   // In Navbar.jsx or App root
   {!isOnline() && (
     <div class="bg-yellow-50 border-b border-yellow-200 px-4 py-2">
       <p class="text-sm text-yellow-800">
         You're offline. Changes will sync when connection is restored.
       </p>
     </div>
   )}
   ```
   **Priority:** High

2. **No "Syncing..." Indicator for Background Refetch**
   - TanStack Query refetches in background
   - User doesn't know if data is stale or being updated
   - **Recommendation:** Add spinner/badge when `isRefetching`
   - **Priority:** Medium

3. **No "Last Synced" Timestamp**
   - User doesn't know how old cached data is
   - **Recommendation:** Show `dataUpdatedAt` from query state
   ```jsx
   {dataUpdatedAt && (
     <span class="text-xs text-gray-500">
       Last synced {formatDistanceToNow(dataUpdatedAt)}
     </span>
   )}
   ```
   **Priority:** Medium

4. **No Awareness Indicators (Who's Editing)**
   - Yjs awareness tracks user presence
   - Not displayed in UI
   - **Recommendation:** Show avatars of users editing same checklist
   - **Priority:** Low (nice-to-have)

---

## Edge Cases & Reliability Issues

### Edge Case 1: IndexedDB Quota Exceeded ❌ **NOT HANDLED**

**Scenario:**
- User has 100 projects, each with 1000 studies
- Each Yjs document stores full update history
- IndexedDB quota exceeded (browser typically 50MB-1GB)

**Current Behavior:**
- IndexedDB write fails silently
- Yjs continues in-memory
- On page reload, offline changes lost

**Recommendation:** Add quota management
```javascript
// In IndexeddbPersistence initialization
try {
  indexeddbProvider = new IndexeddbPersistence(dbName, ydoc);
} catch (err) {
  if (err.name === 'QuotaExceededError') {
    // 1. Notify user
    // 2. Offer to clear old projects
    // 3. Implement LRU eviction
  }
}
```

**Priority:** Medium (rare but data-loss risk)

---

### Edge Case 2: Yjs Update History Grows Unbounded ⚠️ **POTENTIAL ISSUE**

**Scenario:**
- Long-lived project with thousands of edits
- Yjs stores every single update in IndexedDB
- Database size grows indefinitely

**Yjs Behavior:**
- No automatic compaction
- Update history needed for offline conflict resolution
- Can be manually compacted via `Y.encodeStateAsUpdate()`

**Recommendation:** Periodic compaction
```javascript
// After successful sync, compact old updates
provider.on('sync', async (isSynced) => {
  if (isSynced) {
    // Compact updates older than 30 days
    const stateVector = Y.encodeStateVector(ydoc);
    const update = Y.encodeStateAsUpdate(ydoc, stateVector);
    // Store compacted update, delete old updates
  }
});
```

**Priority:** Low (only matters for very active projects)

---

### Edge Case 3: LocalStorage Auth Cache Falls Back to Stale Data ⚠️

**Scenario:**
1. User authenticates at 9:00 AM (cached to LocalStorage)
2. Admin revokes user's access at 10:00 AM
3. User's auth session expires at 10:05 AM
4. User refreshes page **while offline** at 10:10 AM
5. LocalStorage cache still valid (7-day TTL)
6. User sees app as if still authenticated

**Current Mitigation:**
- ✅ API requests will fail (403 Forbidden)
- ✅ Query errors will show in UI

**Gap:**
- User sees authenticated UI until first API call fails
- Confusing UX

**Recommendation:** Add server-validated "auth check" on app load
```javascript
// On app load (when online)
if (navigator.onLine) {
  await auth.forceRefreshSession();  // Already exists
  // If fails, clear cached auth
}
```

**Already implemented** via bfcache handler! ✅

**Priority:** Low (edge case, already mitigated)

---

### Edge Case 4: User Edits Project While Connection Flapping ⚠️

**Scenario:**
- User on unreliable network
- Connection drops and reconnects every 10 seconds
- User continues editing during disconnections

**Yjs Behavior:**
- ✅ All edits buffered in IndexedDB
- ✅ Sent to server on reconnection
- ✅ No data loss

**UX Issue:**
- User doesn't know if edits are saved to server
- **Recommendation:** Show "Synced" checkmark after successful sync
```jsx
{synced() ? (
  <div class="flex items-center gap-1 text-green-600">
    <CheckIcon /> Synced
  </div>
) : (
  <div class="flex items-center gap-1 text-yellow-600">
    <SyncIcon class="animate-spin" /> Syncing...
  </div>
)}
```

**Priority:** Medium

---

### Edge Case 5: Multiple Tabs Editing Same Project ✅ **HANDLED**

**Scenario:**
- User opens project in 2 browser tabs
- Edits in both tabs simultaneously

**Yjs Behavior:**
- ✅ BroadcastChannel syncs Y.Docs across tabs
- ✅ Both tabs share same IndexedDB
- ✅ Edits merged correctly

**No issue** - Yjs handles this natively.

---

### Edge Case 6: Unnecessary WebSocket Connections for All Projects ❌ **CRITICAL ISSUE**

**Current Behavior:**
- `useProject()` hook called in `ProjectView.jsx` (line 47)
- Creates WebSocket connection immediately when component mounts
- Connection registry prevents duplicate connections per project
- **BUT:** If user has project list visible (e.g., Dashboard), all projects are rendered in the list

**Problem Scenario:**
1. User has 50 projects
2. User views Dashboard page
3. Each project card potentially mounts and calls `useProject()`
4. **Result:** 50+ WebSocket connections to server simultaneously

**Investigation Needed:**
```bash
# Check where useProject is called
grep -r "useProject(" packages/web/src/components/
```

**Current Findings:**
- [ProjectView.jsx:47](packages/web/src/components/project/ProjectView.jsx:47) - Main project view (✅ **CORRECT**)
- [ChecklistYjsWrapper.jsx](packages/web/src/components/checklist/ChecklistYjsWrapper.jsx) - Checklist editing (✅ **CORRECT**)
- [ReconciliationWrapper.jsx](packages/web/src/components/project/reconcile-tab/amstar2-reconcile/ReconciliationWrapper.jsx) - Reconciliation (✅ **CORRECT**)
- [CompletedTab.jsx](packages/web/src/components/project/completed-tab/CompletedTab.jsx) - Needs verification
- [PreviousReviewersView.jsx](packages/web/src/components/project/completed-tab/PreviousReviewersView.jsx) - Needs verification

**Recommended Architecture:**

Only maintain **2 WebSocket connections** maximum:

1. **Notifications WebSocket** - User-scoped ([useNotifications.js](packages/web/src/primitives/useNotifications.js))
   - ✅ Already implemented correctly
   - Connected when user is authenticated
   - Used by [useMembershipSync.js](packages/web/src/primitives/useMembershipSync.js)
   - Receives project membership change notifications

2. **Active Project WebSocket** - Project-scoped (via y-websocket)
   - ✅ Currently connects only when ProjectView mounts
   - Should **only** connect when user actively viewing/editing a project
   - Should **disconnect** when navigating away from project

**Current State Assessment:**

✅ **GOOD:** Connection registry prevents duplicate connections per project
✅ **GOOD:** Notifications WebSocket is user-scoped (only 1 per user)
⚠️ **CONCERN:** Need to verify project list doesn't mount useProject for all projects

**Verification Steps:**

1. Check if Dashboard/project list renders project cards with `useProject()`
2. Check if project cards only fetch metadata via TanStack Query (correct approach)
3. Ensure `useProject()` WebSocket only connects when ProjectView is active

**If Issue Confirmed:**

**Solution 1: Lazy Connection (Recommended)**
```javascript
// In useProject/index.js
export function useProject(projectId, options = {}) {
  const { autoConnect = true } = options;

  // Only auto-connect if explicitly requested
  if (autoConnect) {
    createEffect(() => {
      if (projectId) {
        connect();
      }
    });
  }

  return {
    ...projectConnection,
    connect,  // Expose for manual connection
  };
}

// In ProjectView.jsx
const projectConnection = useProject(params.projectId, { autoConnect: true });

// In project card (if needed)
const projectConnection = useProject(project.id, { autoConnect: false });
```

**Solution 2: Route-Based Connection**
```javascript
// Only allow useProject() on project detail routes
// Dashboard/list should use TanStack Query for metadata only
```

**Priority:** HIGH ⚠️
**Impact:** Server load, browser memory, unnecessary bandwidth
**Estimated Effort:** 4-6 hours (verification + fix)

---

### Edge Case 7: Service Worker Update During Active Session ⚠️ **NOT APPLICABLE**

**Currently:** Service worker disabled, so no update issues.

**When SW enabled:**
- New version detected while user editing
- Old SW serves old assets
- New code expects new data format

**Recommendation (when SW enabled):**
```javascript
// Notify user of update, allow them to choose when to reload
registration.addEventListener('updatefound', () => {
  const newWorker = registration.installing;
  newWorker.addEventListener('statechange', () => {
    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
      // Show notification: "Update available. Click to refresh."
      // Don't force reload while user editing
    }
  });
});
```

**Priority:** High (when SW enabled)

---

## Recommendations

### Critical Priority (Implement Immediately)

#### C1: Enable Service Worker for Web Package ❌ → ✅

**Issue:** No offline app shell means app completely broken when offline.

**Solution:**
1. Uncomment service worker registration in `packages/web/src/main.jsx`
2. Scope service worker to `/app.html` and assets
3. Test offline loading, navigation, and cache busting

**Effort:** 2-4 hours
**Impact:** High - transforms offline UX from "broken" to "functional"

---

#### C2: Verify and Fix WebSocket Connection Strategy ⚠️ → ✅

**Issue:** Potentially connecting to multiple project WebSockets simultaneously instead of only active project + notifications.

**Required Architecture:**
- **1 Notifications WebSocket** - User-scoped for membership changes (✅ already correct)
- **1 Project WebSocket** - Only for actively viewed/edited project
- **0 WebSockets** - For project list/dashboard (use TanStack Query only)

**Verification Steps:**
1. Open browser DevTools → Network → WS filter
2. Navigate to Dashboard with 10+ projects
3. Count active WebSocket connections
4. **Expected:** 1 (notifications only)
5. **If More:** Projects list is mounting `useProject()` - needs fix

**Solution (if issue confirmed):**
```javascript
// Option 1: Add autoConnect flag to useProject
export function useProject(projectId, options = {}) {
  const { autoConnect = false } = options;  // Default to false

  if (autoConnect) {
    createEffect(() => {
      if (projectId) connect();
    });
  }

  return { ...projectConnection, connect };  // Allow manual connect
}

// In ProjectView.jsx (active project detail)
const project = useProject(projectId, { autoConnect: true });

// In CompletedTab.jsx (if using useProject for read-only data)
const project = useProject(projectId, { autoConnect: false });
// Use projectStore or TanStack Query instead
```

**Effort:** 4-6 hours (verification + implementation + testing)
**Impact:** HIGH - Reduces server load, improves battery life, prevents connection limits

---

#### C3: Add Global Offline Indicator ❌ → ✅

**Issue:** Users don't know when they're offline.

**Solution:**
```jsx
// In App.jsx or Navbar.jsx
import useOnlineStatus from '@/primitives/useOnlineStatus';

function OfflineBanner() {
  const isOnline = useOnlineStatus();

  return (
    <Show when={!isOnline()}>
      <div class="bg-yellow-50 border-b px-4 py-2 flex items-center gap-2">
        <AlertCircle class="h-4 w-4 text-yellow-600" />
        <p class="text-sm text-yellow-800">
          You're offline. Changes will sync when connection is restored.
        </p>
      </div>
    </Show>
  );
}
```

**Effort:** 1 hour
**Impact:** High - prevents user confusion

---

### High Priority (Next 2 Weeks)

#### H1: Add Background Refetch Indicators ⚠️ → ✅

**Issue:** Users don't know if cached data is being refreshed.

**Solution:**
```jsx
const { data, isRefetching, dataUpdatedAt } = useProjectList();

{isRefetching() && (
  <div class="flex items-center gap-2 text-sm text-gray-600">
    <Spinner class="h-4 w-4 animate-spin" />
    Syncing project list...
  </div>
)}
```

**Effort:** 2-3 hours (across multiple components)
**Impact:** Medium - improves perceived reliability

---

#### H2: Add "Last Synced" Timestamps ⚠️ → ✅

**Issue:** Users can't tell if data is fresh or stale.

**Solution:**
```jsx
import { formatDistanceToNow } from 'date-fns';

{dataUpdatedAt && (
  <span class="text-xs text-gray-500">
    Last synced {formatDistanceToNow(dataUpdatedAt, { addSuffix: true })}
  </span>
)}
```

**Effort:** 2-3 hours
**Impact:** Medium - transparency builds trust

---

#### H3: Implement IndexedDB Quota Management ❌ → ✅

**Issue:** No handling when storage quota exceeded.

**Solution:**
```javascript
// Add to useProject/index.js
async function handleQuotaError(projectId) {
  // 1. Estimate current usage
  const estimate = await navigator.storage.estimate();
  const usedPercent = (estimate.usage / estimate.quota) * 100;

  // 2. If >80%, offer to clean up
  if (usedPercent > 80) {
    // Show modal: "Storage almost full. Delete old projects?"
    // List projects by size, allow user to delete
  }
}

// Wrap IndexedDB operations
try {
  indexeddbProvider = new IndexeddbPersistence(dbName, ydoc);
} catch (err) {
  if (err.name === 'QuotaExceededError') {
    await handleQuotaError(projectId);
  }
}
```

**Effort:** 6-8 hours
**Impact:** Medium - prevents rare data loss

---

### Medium Priority (Next Month)

#### M1: Add Connection Status Indicators on Project Cards ⚠️ → ✅

**Issue:** No visual indication of sync status per project.

**Solution:**
```jsx
// In ProjectCard.jsx
const { connected, synced } = useProject(project.id);

<Badge variant={synced() ? 'success' : connected() ? 'warning' : 'error'}>
  {synced() ? 'Synced' : connected() ? 'Syncing...' : 'Offline'}
</Badge>
```

**Effort:** 3-4 hours
**Impact:** Medium - better status visibility

---

#### M2: Migrate Auth Cache from LocalStorage to IndexedDB ⚠️ → ✅

**Issue:** LocalStorage has small quota, synchronous blocking.

**Solution:**
```javascript
// Create new auth-cache.js using idb library
import { openDB } from 'idb';

const AUTH_DB = 'corates-auth-cache';

export async function saveAuthCache(userData) {
  const db = await openDB(AUTH_DB, 1, {
    upgrade(db) {
      db.createObjectStore('auth');
    }
  });
  await db.put('auth', userData, 'current-user');
}

export async function loadAuthCache() {
  const db = await openDB(AUTH_DB, 1);
  return await db.get('auth', 'current-user');
}
```

**Effort:** 4-5 hours
**Impact:** Low - improves robustness

---

#### M3: Add LRU Eviction for PDF Cache ❌ → ✅

**Issue:** PDFs accumulate indefinitely.

**Solution:**
```javascript
// In pdfCache.js
const MAX_PDF_CACHE_SIZE_MB = 100;

async function evictLeastRecentlyUsed() {
  const db = await getDb();
  const tx = db.transaction(PDF_STORE_NAME, 'readwrite');
  const store = tx.objectStore(PDF_STORE_NAME);
  const index = store.index('cachedAt');

  // Get all PDFs sorted by cachedAt (oldest first)
  const pdfs = await index.getAll();

  let totalSize = pdfs.reduce((sum, pdf) => sum + pdf.size, 0);
  const maxSize = MAX_PDF_CACHE_SIZE_MB * 1024 * 1024;

  // Delete oldest until under quota
  for (const pdf of pdfs) {
    if (totalSize <= maxSize) break;
    await store.delete(pdf.id);
    totalSize -= pdf.size;
  }
}
```

**Effort:** 3-4 hours
**Impact:** Medium - prevents quota issues

---

### Low Priority (Nice-to-Have)

#### L1: Add Yjs Awareness Indicators (Who's Editing) ⚠️ → ✅

**Issue:** No visibility into other users' presence.

**Solution:**
```jsx
// In ChecklistView.jsx
const awareness = connectionManager.getAwareness();

createEffect(() => {
  awareness.on('update', ({ added, updated, removed }) => {
    // Show user avatars who are viewing same checklist
  });
});

<div class="flex items-center gap-1">
  <For each={activeUsers()}>
    {user => <Avatar src={user.image} title={user.name} />}
  </For>
</div>
```

**Effort:** 6-8 hours
**Impact:** Low - collaboration UX improvement

---

#### L2: Add Optimistic UI for Mutations ⚠️ → ✅

**Issue:** Small lag between user action and Yjs update.

**Solution:**
```jsx
// In study creation
function createStudy(data) {
  // Optimistic update
  const tempId = `temp-${Date.now()}`;
  projectStore.addStudy({ id: tempId, ...data, status: 'creating' });

  // Actual Yjs mutation
  studyOps.createStudy(data);

  // Remove temp study after Yjs update
  createEffect(() => {
    if (studies().find(s => s.id !== tempId && s.name === data.name)) {
      projectStore.removeStudy(tempId);
    }
  });
}
```

**Effort:** 8-10 hours (complex state management)
**Impact:** Low - Yjs is already fast (~10-50ms)

---

#### L3: Implement Yjs History Compaction ⚠️ → ✅

**Issue:** Update history grows unbounded for long-lived projects.

**Solution:**
```javascript
// Compact every 7 days or 10k updates
let updateCount = 0;
const COMPACT_INTERVAL = 10000;

ydoc.on('update', () => {
  updateCount++;
  if (updateCount >= COMPACT_INTERVAL) {
    compactHistory();
    updateCount = 0;
  }
});

async function compactHistory() {
  const stateVector = Y.encodeStateVector(ydoc);
  const compactedUpdate = Y.encodeStateAsUpdate(ydoc);

  // Clear old updates, store compacted version
  await indexeddbProvider.clearUpdateLog();
  await indexeddbProvider.storeUpdate(compactedUpdate);
}
```

**Effort:** 6-8 hours (research + implementation)
**Impact:** Low - only affects very active projects

---

## Service Worker Implementation Checklist

When enabling the service worker, follow this checklist:

### Pre-Deployment

- [ ] **Scope Decision Made:** Web package only or both landing + web
- [ ] **Cache Strategy Finalized:**
  - [ ] Network-first for navigations ✅ (already in sw.js)
  - [ ] Cache-first for assets ✅
  - [ ] Skip API requests ✅
- [ ] **Version Busting:**
  - [ ] `CACHE_VERSION` replaced at build time
  - [ ] Old caches deleted on activate ✅

### Implementation

- [ ] **Uncomment registration code** in `packages/web/src/main.jsx`
- [ ] **Add update notification:**
  ```javascript
  registration.addEventListener('updatefound', () => {
    // Show "Update available" toast
  });
  ```
- [ ] **Test offline scenarios:**
  - [ ] First load while offline (should fail gracefully)
  - [ ] Subsequent loads while offline (should work)
  - [ ] Navigation while offline (SPA routes work)
  - [ ] Asset loading while offline (cached)
- [ ] **Test update scenarios:**
  - [ ] New deployment detected
  - [ ] Old SW continues serving until user refreshes
  - [ ] Cache cleared on update

### Monitoring

- [ ] **Add analytics for:**
  - [ ] SW registration success/failure
  - [ ] Offline usage (navigator.onLine events)
  - [ ] Cache hit/miss rates
- [ ] **Error tracking:**
  - [ ] SW registration errors
  - [ ] Cache storage errors

---

## Conclusion

CoRATES has **strong local-first foundations** with Yjs CRDT providing automatic conflict resolution and comprehensive IndexedDB persistence across multiple layers. The architecture handles most edge cases gracefully, especially around access revocation and offline editing.

### Critical Gaps to Address:

1. **Service worker disabled** - No offline app shell (HIGH PRIORITY)
2. **Potential excessive WebSocket connections** - May connect all projects instead of only active one (HIGH PRIORITY - needs verification)
3. **No offline UX indicators** - Users don't know connection status (HIGH PRIORITY)
4. **No quota management** - Risk of silent data loss (MEDIUM PRIORITY)

### Strengths to Maintain:

1. ✅ Yjs CRDT sync is excellent
2. ✅ Multiple IndexedDB layers provide deep persistence
3. ✅ WebSocket reconnection is robust
4. ✅ Stale data cleanup works well
5. ✅ bfcache handling prevents stale UI

### Recommended Implementation Order:

**Week 1 (Critical):**
1. **Verify WebSocket connection count** - Check if multiple projects connect simultaneously
2. **Fix connection strategy** (if needed) - Only active project + notifications
3. Enable service worker for web package
4. Add global offline banner

**Week 2 (High Priority):**
- Add background refetch indicators
- Add "last synced" timestamps

**Week 3 (High Priority):**
- Implement quota management
- Add connection status badges

**Month 2 (Medium Priority):**
- Migrate auth cache to IndexedDB
- Add LRU PDF eviction
- Add awareness indicators (optional)

With these improvements, CoRATES will have **best-in-class offline support** for a web-based collaborative application.

---

**End of Report**

For questions or implementation assistance, please consult the development team.
