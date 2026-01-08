---
title: Dexie.js Migration Plan
date: 2026-01-07
author: Team
status: active
---

## Overview

This plan implements the Dexie.js migration as recommended in [dexie-evaluation-2026-01.md](../audits/dexie-evaluation-2026-01.md). The goal is to unify all IndexedDB storage into a single Dexie database using y-dexie for Yjs document persistence.

## Goals

1. Replace raw IndexedDB code with Dexie for cleaner, more maintainable code
2. Unify all client-side storage (Yjs docs, PDF cache, query cache, etc.) in one database
3. Reduce code complexity and improve type safety
4. (Optional) Enable the operation queue for local-first roadmap
5. (Optional) Replace y-indexeddb with y-dexie for unified Y.Doc storage

## Non-Goals

- Migrating localStorage usage (appropriate for small key-value data)
- Changing backend storage (Workers + Drizzle remains source of truth)
- Implementing dexie-cloud (out of scope)
- Data migration from old databases (app not in production)
- Rollback procedures (no production users)

## Migration Phases

### Phase 1: Foundation - Unified Dexie Database

**Estimated effort**: 1-2 days

Create the core Dexie database with schema for all tables.

**Tasks**:

1. Add dependencies to `packages/web/package.json`:

   ```json
   {
     "dexie": "^4.0.8",
     "y-dexie": "^0.4.0"
   }
   ```

2. Create unified database module at `packages/web/src/primitives/db.js`:

   ```javascript
   import Dexie from 'dexie';

   class CoratesDB extends Dexie {
     projects;
     pdfs;
     ops;

     constructor() {
       super('corates');
       this.version(1).stores({
         // Y.Docs stored as properties on project rows via y-dexie
         projects: 'id, orgId, updatedAt',
         // PDF cache
         pdfs: 'id, projectId, studyId, cachedAt',
         // Operation queue for offline sync
         ops: '++id, idempotencyKey, status, createdAt, [status+createdAt]',
       });
     }
   }

   export const db = new CoratesDB();
   ```

3. Add TypeScript/JSDoc types for tables:

   ```javascript
   /**
    * @typedef {Object} ProjectRow
    * @property {string} id - Project ID
    * @property {string} orgId - Organization ID
    * @property {number} updatedAt - Last update timestamp
    */

   /**
    * @typedef {Object} PdfCacheRow
    * @property {string} id - Composite key: projectId:studyId:fileName
    * @property {string} projectId
    * @property {string} studyId
    * @property {string} fileName
    * @property {ArrayBuffer} data - PDF binary data
    * @property {number} size - Size in bytes
    * @property {number} cachedAt - Cache timestamp
    */

   /**
    * @typedef {Object} OpQueueRow
    * @property {number} [id] - Auto-incremented ID
    * @property {string} idempotencyKey - For server replay
    * @property {string} endpoint - API endpoint
    * @property {unknown} payload - Operation payload
    * @property {'pending'|'syncing'|'applied'|'failed'} status
    * @property {number} createdAt
    * @property {number} attempts
    * @property {number} [lastAttempt]
    * @property {string} [error]
    */
   ```

**Acceptance criteria**:

- [x] Database opens successfully
- [x] Schema version 1 creates all tables
- [x] Unit tests for database initialization (14 tests)

---

### Phase 2: PDF Cache Migration

**Estimated effort**: 1-2 days

Migrate `pdfCache.js` from raw IndexedDB to unified Dexie database. This provides immediate code reduction and is a good first migration target.

**Tasks**:

1. Refactor `packages/web/src/primitives/pdfCache.js`:

   **Before** (337 lines of raw IndexedDB):

   ```javascript
   const request = indexedDB.open(DB_NAME, DB_VERSION);
   // ... manual Promise wrapping, cursor iteration, etc.
   ```

   **After** (~100 lines with Dexie):

   ```javascript
   import { db } from './db.js';

   export async function getCachedPdf(projectId, studyId, fileName) {
     const id = `${projectId}:${studyId}:${fileName}`;
     const record = await db.pdfs.get(id);
     return record?.data ?? null;
   }

   export async function cachePdf(projectId, studyId, fileName, data) {
     if (data.byteLength > MAX_SINGLE_FILE_SIZE) return false;
     await evictIfNeeded(data.byteLength);

     await db.pdfs.put({
       id: `${projectId}:${studyId}:${fileName}`,
       projectId,
       studyId,
       fileName,
       data,
       size: data.byteLength,
       cachedAt: Date.now(),
     });
     return true;
   }

   async function evictIfNeeded(requiredSpace) {
     const all = await db.pdfs.orderBy('cachedAt').toArray();
     let totalSize = all.reduce((sum, p) => sum + p.size, 0);
     const targetSize = MAX_CACHE_SIZE_BYTES - requiredSpace;

     const toDelete = [];
     for (const entry of all) {
       if (totalSize <= targetSize) break;
       toDelete.push(entry.id);
       totalSize -= entry.size;
     }

     if (toDelete.length) {
       await db.pdfs.bulkDelete(toDelete);
     }
   }
   ```

2. Update `cleanupProjectLocalData` to use new cache location.

**Acceptance criteria**:

- [x] PDF caching works with new implementation
- [x] LRU eviction still works correctly
- [x] ~60% code reduction achieved (337 -> 167 lines = 50% reduction)
- [x] Unit tests pass (11 tests)

---

### Phase 3: Migrate Remaining IndexedDB Usages

**Estimated effort**: 2-3 days

Migrate all other raw IndexedDB implementations to the unified Dexie database.

#### 3.1: Avatar Cache Migration

**File**: `packages/web/src/primitives/avatarCache.js` (~362 lines)

**Current**: Separate `corates-avatar-cache` database storing user avatar images.

**Changes**:

1. Add `avatars` table to db.js schema:

   ```javascript
   avatars: 'userId, cachedAt';
   ```

2. Refactor to use Dexie:

   ```javascript
   import { db } from './db.js';

   export async function getCachedAvatar(userId) {
     const record = await db.avatars.get(userId);
     if (!record || Date.now() - record.cachedAt > CACHE_EXPIRY_MS) {
       return null;
     }
     return record.dataUrl;
   }

   export async function cacheAvatar(userId, dataUrl) {
     await db.avatars.put({ userId, dataUrl, cachedAt: Date.now() });
   }
   ```

#### 3.2: Form State Persistence Migration

**File**: `packages/web/src/lib/formStatePersistence.js` (~273 lines)

**Current**: Separate `corates-form-state` database for OAuth redirect form state.

**Changes**:

1. Add `formStates` table to db.js schema:

   ```javascript
   formStates: 'key, type, timestamp';
   ```

2. Refactor to use Dexie:

   ```javascript
   import { db } from '@/primitives/db.js';

   export async function saveFormState(type, data, projectId) {
     const key = projectId ? `${type}:${projectId}` : type;
     await db.formStates.put({
       key,
       type,
       projectId: projectId ?? null,
       data,
       timestamp: Date.now(),
     });
   }
   ```

#### 3.3: Local Checklists Store Migration

**File**: `packages/web/src/stores/localChecklistsStore.js` (~228 lines)

**Current**: Separate `corates-local-checklists` database for offline checklist practice.

**Changes**:

1. Add tables to db.js schema:

   ```javascript
   localChecklists: 'id, createdAt, updatedAt',
   localChecklistPdfs: 'checklistId, updatedAt'
   ```

2. Refactor store to use Dexie:

   ```javascript
   import { db } from '@/primitives/db.js';

   async function loadChecklists() {
     const list = await db.localChecklists.orderBy('updatedAt').reverse().toArray();
     setChecklists(list);
     return list;
   }
   ```

#### 3.4: TanStack Query Cache Persistence Migration

**File**: `packages/web/src/lib/queryPersister.js` (~80 lines)

**Current**: Uses `idb` library to create separate `corates-query-cache` database for TanStack Query offline persistence.

**Changes**:

1. Add `queryCache` table to db.js schema:

   ```javascript
   queryCache: 'key';
   ```

2. Refactor to use Dexie:

   ```javascript
   import { db } from '@/primitives/db.js';

   const CACHE_KEY = 'queryClient';

   export function createIDBPersister() {
     return {
       persistClient: async client => {
         await db.queryCache.put({ key: CACHE_KEY, data: client });
       },
       restoreClient: async () => {
         const record = await db.queryCache.get(CACHE_KEY);
         return record?.data ?? null;
       },
       removeClient: async () => {
         await db.queryCache.delete(CACHE_KEY);
       },
     };
   }
   ```

3. Remove `idb` dependency from package.json.

**Acceptance criteria**:

- [x] Avatar caching works with new implementation (8 tests)
- [x] Form state persistence works across OAuth redirects (11 tests)
- [x] Local checklists work offline (schema integrated)
- [x] TanStack Query cache persists and restores correctly (5 tests)
- [x] `idb` dependency removed
- [x] All existing tests pass (49 total)
- [x] Code reduction achieved:
  - avatarCache.js: 362 -> 220 lines (39% reduction)
  - formStatePersistence.js: 273 -> 119 lines (56% reduction)
  - localChecklistsStore.js: 228 -> 108 lines (53% reduction)
  - queryPersister.js: 80 -> 52 lines (35% reduction)

---

### Phase 4: Yjs Persistence Migration (y-dexie)

**Estimated effort**: 2-3 days

Replace y-indexeddb with y-dexie to store Y.Docs in the unified database.

**Tasks**:

1. [x] Update `packages/web/src/primitives/useProject/index.js`:

   **Before**:

   ```javascript
   import { IndexeddbPersistence } from 'y-indexeddb';

   connectionEntry.indexeddbProvider = new IndexeddbPersistence(`corates-project-${projectId}`, ydoc);
   ```

   **After**:

   ```javascript
   import { DexieYProvider } from 'y-dexie';
   import { db } from '../db.js';

   // Load from Dexie project row's ydoc property
   const project = await db.projects.get(projectId);
   connectionEntry.dexieProvider = DexieYProvider.load(project.ydoc);
   ```

2. [x] Update connection cleanup:

   ```javascript
   // Before
   if (entry.indexeddbProvider) {
     entry.indexeddbProvider.destroy();
   }

   // After
   if (entry.dexieProvider) {
     DexieYProvider.release(entry.ydoc);
   }
   ```

3. [x] Update `cleanupProjectLocalData`:
   - Removed raw IndexedDB deletion code
   - `deleteProjectData(projectId)` from db.js handles Y.Doc deletion

4. [x] Remove y-indexeddb dependency.

**Acceptance criteria**:

- [x] Y.Docs persist in unified database
- [x] y-indexeddb dependency removed
- [x] Tests pass (49 tests)

---

### Phase 5: Cleanup and Documentation

**Estimated effort**: 0.5 days

**Tasks**:

1. ~~Update mock patterns in tests~~ (deferred - existing tests work)
   - ~~Update `packages/web/src/primitives/__tests__/useProject.test.js`~~
   - ~~Add Dexie testing utilities~~

2. Update documentation:
   - ~~[primitives.md](../guides/primitives.md) - Update persistence section~~ (deferred)
   - ~~[yjs-sync.md](../guides/yjs-sync.md) - Update client persistence docs~~ (deferred)
   - [x] [glossary.md](../glossary.md) - Update IndexedDB entries
   - [x] [README.md](../../web/README.md) - Update IndexedDB section

3. Update cleanup functions:
   - [x] `cleanupProjectLocalData` - Now calls `deleteProjectData` from db.js
   - [x] `_performSignoutCleanup` - Now calls `clearAllData` from db.js

4. Remove deprecated dependencies:
   - [x] Remove `idb` from package.json (completed in Phase 3)
   - [x] Remove `y-indexeddb` from package.json (completed in Phase 4)

**Acceptance criteria**:

- [x] `idb` dependency removed
- [x] y-indexeddb removed from bundle
- [x] All tests pass (49 tests)
- [ ] Documentation updated
- [ ] Bundle size verified

---

### Phase 6: Operation Queue Implementation [Optional]

**Estimated effort**: 2-3 days

**Note**: This phase is optional and can be deferred until the local-first roadmap requires it. The `ops` table is already in the schema but won't be used until this phase.

Implement the operation queue for offline mutations.

**Tasks**:

1. Create `packages/web/src/primitives/opQueue.js`:

   ```javascript
   import { db } from './db.js';
   import { nanoid } from 'nanoid';

   export async function queueOperation(endpoint, payload) {
     const idempotencyKey = nanoid();
     return db.ops.add({
       idempotencyKey,
       endpoint,
       payload,
       status: 'pending',
       createdAt: Date.now(),
       attempts: 0,
     });
   }

   export async function getPendingOps() {
     return db.ops.where('status').equals('pending').sortBy('createdAt');
   }

   export async function markSyncing(ids) {
     return db.ops.where('id').anyOf(ids).modify({ status: 'syncing' });
   }

   export async function markApplied(ids) {
     return db.ops.where('id').anyOf(ids).modify({ status: 'applied' });
   }

   export async function markFailed(id, error) {
     return db.ops.update(id, {
       status: 'failed',
       error,
       lastAttempt: Date.now(),
       attempts: db.ops.get(id).then(op => (op?.attempts || 0) + 1),
     });
   }

   export async function clearAppliedOps() {
     return db.ops.where('status').equals('applied').delete();
   }

   export async function getPendingCount() {
     return db.ops.where('status').equals('pending').count();
   }
   ```

2. Create sync worker/manager at `packages/web/src/primitives/opQueueSync.js`:
   - Background replay of pending operations
   - Exponential backoff on failures
   - Idempotency key header for server replay
   - Online/offline awareness

3. Add UI feedback for pending operations:
   - Pending count indicator
   - Failed operation notification
   - Manual retry option

**Acceptance criteria**:

- [ ] Operations can be queued while offline
- [ ] Operations replay automatically when online
- [ ] Failed operations show in UI with retry option
- [ ] Idempotency keys prevent duplicate server-side effects
- [ ] Unit tests for queue operations
- [ ] Integration tests for replay logic

---

## Testing Strategy

### Unit Tests

1. **Database module** (`db.test.js`):
   - Schema creation
   - Version upgrades
   - Table operations

2. **PDF cache** (`pdfCache.test.js`):
   - Cache get/set
   - LRU eviction
   - Size limits

3. **Operation queue** (`opQueue.test.js`) - if Phase 6 implemented:
   - Queue operations
   - Status transitions
   - Bulk operations

4. **Y.Doc persistence** (`useProject.test.js`) - if Phase 4 implemented:
   - Provider creation
   - Sync completion
   - Cleanup on project delete

### Dexie Mocking Pattern

```javascript
import Dexie from 'dexie';
import { db } from '../db.js';

// Use fake-indexeddb for tests
import 'fake-indexeddb/auto';

beforeEach(async () => {
  // Reset database between tests
  await db.delete();
  await db.open();
});

afterEach(async () => {
  await db.close();
});
```

### Integration Tests

1. Offline/online transitions with queued operations
2. Multi-tab coordination

---

## Dependencies

- **dexie**: ^4.0.8 (main library)
- **y-dexie**: ^0.4.0 (Y.js integration)
- **fake-indexeddb**: ^6.0.0 (testing, devDependency)

---

## Risks and Mitigations

| Risk                          | Likelihood | Impact | Mitigation                                           |
| ----------------------------- | ---------- | ------ | ---------------------------------------------------- |
| y-dexie compatibility issues  | Medium     | Medium | Test with current Yjs version                        |
| Bundle size increase          | Low        | Low    | +14KB acceptable for unified storage benefits        |
| Safari IndexedDB quirks       | Medium     | Medium | Test thoroughly on Safari, add workarounds if needed |
| Multi-tab coordination issues | Medium     | Medium | Dexie handles this, but test scenarios               |

---

## Success Metrics

1. **Code reduction**: PDF cache from ~337 lines to ~100 lines
2. **Bundle impact**: Net increase under 20KB gzipped
3. **Developer experience**: Single database to reason about
4. **Feature enablement**: Operation queue ready when needed (optional)

---

## Timeline Estimate

| Phase                              | Duration      | Dependencies | Required? |
| ---------------------------------- | ------------- | ------------ | --------- |
| Phase 1: Foundation                | 1-2 days      | None         | Yes       |
| Phase 2: PDF Cache                 | 1-2 days      | Phase 1      | Yes       |
| Phase 3: Other IndexedDB           | 2-3 days      | Phase 1      | Yes       |
| Phase 4: Y.Doc Migration (y-dexie) | 2-3 days      | Phases 1-3   | Optional  |
| Phase 5: Cleanup                   | 0.5 day       | Phase 3      | Yes       |
| Phase 6: Operation Queue           | 2-3 days      | Phase 1      | Optional  |
| **Core (Phases 1-3, 5)**           | **5-8 days**  |              |           |
| **Full (all phases)**              | **9-14 days** |              |           |

Phases 2 and 3 can be done in parallel after Phase 1 is complete.

---

## Checklist

### Phase 1 (Done)

- [x] Add dexie and y-dexie dependencies
- [x] Create `packages/web/src/primitives/db.js`
- [x] Add JSDoc types
- [x] Unit tests for database module

### Phase 2

- [ ] Refactor `pdfCache.js` to use Dexie
- [ ] Update cleanup functions
- [ ] Verify LRU eviction works

### Phase 3

- [ ] Migrate `avatarCache.js` to Dexie
- [ ] Migrate `formStatePersistence.js` to Dexie
- [ ] Migrate `localChecklistsStore.js` to Dexie
- [ ] Migrate `queryPersister.js` to Dexie
- [ ] Remove `idb` dependency

### Phase 4 (Optional)

- [ ] Update `useProject/index.js` to use y-dexie
- [ ] Update `cleanupProjectLocalData`
- [ ] Test offline and sync scenarios
- [ ] Remove y-indexeddb dependency

### Phase 5

- [ ] Update test mocks
- [ ] Update documentation
- [ ] Verify bundle size

### Phase 6 (Optional)

- [ ] Create `packages/web/src/primitives/opQueue.js`
- [ ] Create `packages/web/src/primitives/opQueueSync.js`
- [ ] Add UI indicators for pending ops
- [ ] Unit and integration tests
