---
title: Dexie.js Evaluation Audit
date: 2026-01-07
author: Team
---

## Summary

This audit evaluates whether Dexie.js would benefit the CoRATES codebase. After analyzing current IndexedDB usage patterns, planned local-first features, and the `y-dexie` add-on for Yjs integration, the recommendation is: **adopt Dexie.js with y-dexie** to unify all IndexedDB storage into a single database.

## Key Discovery: y-dexie

The `y-dexie` add-on allows storing Y.js documents alongside traditional data in a single Dexie database. This changes the calculus significantly.

### y-indexeddb vs y-dexie Comparison

| Feature                                   | y-indexeddb | y-dexie |
| ----------------------------------------- | ----------- | ------- |
| Persist single document                   | Yes         | Yes     |
| Garbage collect historical updates        | Yes         | Yes     |
| Multiple documents in same database       | No          | Yes     |
| Store docs as properties on indexed items | No          | Yes     |
| Sync with dexie-cloud                     | No          | Yes     |
| Optimized multi-document sync protocol    | No          | Yes     |

**Current limitation**: `y-indexeddb` creates one IndexedDB database per Y.Doc (`corates-project-{projectId}`). This makes it impossible to:

- Query across documents
- Store documents as properties on existing objects (e.g., a checklist row)
- Integrate with other app data in the same database

**y-dexie solution**: Store multiple Y.Docs in a single database, potentially as properties on checklist/project rows.

## Current IndexedDB Usage

### 1. Yjs Document Persistence (`y-indexeddb`)

**Location**: `packages/web/src/primitives/useProject/index.js`

```javascript
import { IndexeddbPersistence } from 'y-indexeddb';
connectionEntry.indexeddbProvider = new IndexeddbPersistence(`corates-project-${projectId}`, connectionEntry.ydoc);
```

**Purpose**: Persist Yjs CRDT documents for offline support and fast loading.

**Current Limitation**: Creates a separate IndexedDB database per project. This fragments storage and prevents unified queries.

**Assessment**: Strong candidate for migration to `y-dexie` to unify with other app data.

### 2. PDF Cache (`pdfCache.js`)

**Location**: `packages/web/src/primitives/pdfCache.js`

**Current Implementation**: Raw IndexedDB API (~300 lines)

```javascript
// Manual database opening
const request = indexedDB.open(DB_NAME, DB_VERSION);
request.onupgradeneeded = event => {
  const db = event.target.result;
  const store = db.createObjectStore(PDF_STORE_NAME, { keyPath: 'id' });
  store.createIndex('projectId', 'projectId', { unique: false });
  // ...
};

// Manual transactions for every operation
const transaction = db.transaction(PDF_STORE_NAME, 'readwrite');
const store = transaction.objectStore(PDF_STORE_NAME);
const request = store.put(record);
```

**Pain Points**:

- Verbose boilerplate for every operation (30+ lines per function)
- Manual Promise wrapping around IndexedDB events
- Manual cursor iteration for queries
- No built-in migration support beyond version numbers

**Assessment**: Strong candidate for Dexie migration. Would reduce code by ~60%.

### 3. localStorage Usage (Multiple Files)

**Locations**: 49+ usages across auth, layout, reconciliation, recents

**Current Patterns**:

- Auth flow state (`pendingEmail`, `oauthSignup`, `magicLinkSignup`)
- UI preferences (`sidebarWidth`, `sidebarMode`)
- Navigation state (`reconciliation-nav-*`)
- Recent items (`recents-nav`)
- Query cache snapshots

**Assessment**: localStorage is appropriate for small key-value data. No benefit from Dexie here.

## Planned Features Requiring IndexedDB

### Operation Queue (from Local-First Roadmap)

**Requirement**: "Implement persistent IndexedDB op-queue library (client) and `/api/sync/ops` endpoint (server)"

**Data Model**:

```typescript
interface QueuedOperation {
  id: string; // UUID
  idempotencyKey: string; // For server replay
  type: string; // Operation type
  payload: unknown; // Operation data
  status: 'pending' | 'syncing' | 'applied' | 'failed';
  createdAt: number;
  attempts: number;
  lastAttempt?: number;
  error?: string;
}
```

**Required Queries**:

- Get all pending ops (ordered by `createdAt`)
- Update status by ID
- Delete applied ops
- Count pending ops (for UI feedback)
- Bulk insert ops

**Assessment**: Perfect Dexie use case. Dexie provides:

- Clean schema definitions
- Indexed queries without manual cursor iteration
- Transaction helpers
- Built-in promises

## Dexie Benefits Analysis

### Code Reduction

**Before (raw IndexedDB)**:

```javascript
async function getPendingOps() {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('ops', 'readonly');
    const store = transaction.objectStore('ops');
    const index = store.index('status');
    const keyRange = IDBKeyRange.only('pending');
    const request = index.openCursor(keyRange);
    const results = [];
    request.onsuccess = event => {
      const cursor = event.target.result;
      if (cursor) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        results.sort((a, b) => a.createdAt - b.createdAt);
        resolve(results);
      }
    };
    request.onerror = () => reject(request.error);
  });
}
```

**After (Dexie)**:

```javascript
async function getPendingOps() {
  return db.ops.where('status').equals('pending').sortBy('createdAt');
}
```

### Schema Migrations

**Raw IndexedDB**: Manual version checks in `onupgradeneeded`

**Dexie**: Declarative schema versioning

```javascript
const db = new Dexie('corates-ops');
db.version(1).stores({
  ops: '++id, idempotencyKey, status, createdAt',
});
db.version(2).stores({
  ops: '++id, idempotencyKey, status, createdAt, [status+createdAt]',
});
```

### Type Safety

Dexie 4.x has excellent TypeScript support:

```typescript
interface Operation {
  id?: number;
  idempotencyKey: string;
  status: 'pending' | 'syncing' | 'applied' | 'failed';
  // ...
}

class OperationsDB extends Dexie {
  ops!: Table<Operation, number>;

  constructor() {
    super('corates-ops');
    this.version(1).stores({
      ops: '++id, idempotencyKey, status, createdAt',
    });
  }
}
```

### Bulk Operations

**Raw IndexedDB**: Manual loop with individual puts

**Dexie**: Native bulk methods

```javascript
await db.ops.bulkAdd(operations);
await db.ops.bulkPut(updates);
await db.ops.bulkDelete(ids);
```

## Bundle Size Impact

| Library     | Minified | Gzipped |
| ----------- | -------- | ------- |
| Dexie 4.x   | ~45 KB   | ~15 KB  |
| y-dexie     | ~5 KB    | ~2 KB   |
| y-indexeddb | ~8 KB    | ~3 KB   |

**Current bundle**: Already includes y-indexeddb (~3KB gzipped).

**With unified Dexie**: Replace y-indexeddb with Dexie + y-dexie = ~17KB gzipped total (+14KB net).

**Assessment**: Acceptable increase for the unified storage benefits and code reduction.

## y-dexie Integration

### How y-dexie Works

y-dexie stores Y.Docs as properties on Dexie table rows:

```javascript
import Dexie from 'dexie';
import { DexieYProvider } from 'y-dexie';

const db = new Dexie('corates');
db.version(1).stores({
  projects: 'id, name, updatedAt',
  checklists: 'id, projectId, type, status',
  pdfs: 'id, projectId, studyId, cachedAt',
  ops: '++id, idempotencyKey, status, createdAt',
});

// Y.Doc is stored as a property on the project row
const provider = new DexieYProvider(db, 'projects', projectId, ydoc);
```

### Benefits for CoRATES

1. **Single database**: All app data (projects, checklists, PDFs, ops, Y.Docs) in one IndexedDB
2. **Unified queries**: Can query projects by name AND include their Y.Doc state
3. **Atomic operations**: Transactions can span Y.Doc updates and regular data
4. **Simpler cleanup**: Delete project row = delete Y.Doc automatically
5. **Future dexie-cloud**: If we ever want cloud sync beyond Yjs, dexie-cloud works with y-dexie

## Recommended Adoption Strategy

### Phase 1: Unified Database Setup

Create a single Dexie database for all app data:

```javascript
// packages/web/src/primitives/db.js
import Dexie from 'dexie';

class CoratesDB extends Dexie {
  projects;
  checklists;
  pdfs;
  ops;

  constructor() {
    super('corates');
    this.version(1).stores({
      // Y.Docs stored as properties on project rows via y-dexie
      projects: 'id, orgId, updatedAt',
      // Checklist metadata (Y.Doc content stored on project)
      checklists: 'id, projectId, studyId, type, status',
      // PDF cache
      pdfs: 'id, projectId, studyId, cachedAt',
      // Operation queue for offline sync
      ops: '++id, idempotencyKey, status, createdAt, [status+createdAt]',
    });
  }
}

export const db = new CoratesDB();
```

### Phase 2: Migrate Yjs Persistence to y-dexie

Replace `y-indexeddb` with `y-dexie`:

```javascript
// packages/web/src/primitives/useProject/index.js
import { DexieYProvider } from 'y-dexie';
import { db } from '../db.js';

// Before (y-indexeddb)
// connectionEntry.indexeddbProvider = new IndexeddbPersistence(
//   `corates-project-${projectId}`,
//   connectionEntry.ydoc
// );

// After (y-dexie)
connectionEntry.dexieProvider = new DexieYProvider(db, 'projects', projectId, connectionEntry.ydoc);
```

### Phase 3: Operation Queue (New Code)

Use the same Dexie database for the planned operation queue:

```javascript
// packages/web/src/primitives/opQueue.js
import { db } from './db.js';

export async function queueOperation(op) {
  return db.ops.add({
    ...op,
    status: 'pending',
    createdAt: Date.now(),
    attempts: 0,
  });
}

export async function getPendingOps() {
  return db.ops.where('status').equals('pending').sortBy('createdAt');
}

export async function markSynced(ids) {
  return db.ops.where('id').anyOf(ids).modify({ status: 'applied' });
}
```

### Phase 4: PDF Cache Migration

Migrate `pdfCache.js` to use the unified database:

```javascript
// packages/web/src/primitives/pdfCache.js (refactored)
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

## Data Migration

When switching from y-indexeddb to y-dexie, existing Y.Doc data needs migration:

```javascript
// One-time migration script
import { IndexeddbPersistence } from 'y-indexeddb';
import { DexieYProvider } from 'y-dexie';
import * as Y from 'yjs';
import { db } from './db.js';

async function migrateProject(projectId) {
  // 1. Load from old y-indexeddb
  const tempDoc = new Y.Doc();
  const oldProvider = new IndexeddbPersistence(`corates-project-${projectId}`, tempDoc);
  await oldProvider.whenSynced;

  // 2. Save to new y-dexie
  const newProvider = new DexieYProvider(db, 'projects', projectId, tempDoc);
  await newProvider.whenSynced;

  // 3. Delete old database
  await indexedDB.deleteDatabase(`corates-project-${projectId}`);

  // 4. Clean up
  oldProvider.destroy();
  newProvider.destroy();
  tempDoc.destroy();
}
```

## What NOT to Use Dexie For

1. **Small key-value data**: Keep localStorage for:
   - UI preferences
   - Auth flow state
   - Navigation state
2. **Query cache**: TanStack Query handles this already

## Y.js Ecosystem Compatibility

Dexie + y-dexie integrates with the Y.js ecosystem CoRATES may use:

**Already compatible**:

- Y.Doc persistence (via y-dexie)
- WebSocket sync (unchanged)
- Durable Object relay (unchanged)

**Future potential**:

- Rich-text editors: TipTap, ProseMirror, Lexical, Quill
- Code editors: CodeMirror, Monaco
- Drawing: Excalidraw, tldraw
- Block editors: BlockSuite/AFFiNE

## Alternatives Considered

| Library                   | Pros                                          | Cons                      |
| ------------------------- | --------------------------------------------- | ------------------------- |
| **Dexie.js + y-dexie**    | Unified storage, Y.js integration, TypeScript | Migration effort          |
| **Dexie.js (no y-dexie)** | Clean API, TypeScript support                 | Separate Y.js storage     |
| **y-indexeddb (current)** | Purpose-built for Y.js                        | One DB per doc, isolated  |
| **idb (Jake Archibald)**  | Minimal wrapper, Promise-based                | No Y.js, less query power |
| **PouchDB**               | Sync built-in                                 | Heavy, CouchDB-centric    |
| **localForage**           | Simple API                                    | No indexing, no queries   |
| **Raw IndexedDB**         | No dependency                                 | Verbose, error-prone      |

**Recommendation**: Dexie + y-dexie provides the best unified solution.

## Implementation Checklist

- [ ] Add `dexie` and `y-dexie` to `packages/web/package.json`
- [ ] Create unified `db.js` with schema for projects, checklists, pdfs, ops
- [ ] Migrate `useProject/index.js` from y-indexeddb to y-dexie
- [ ] Add migration script for existing y-indexeddb data
- [ ] Create `opQueue.js` using unified database
- [ ] Migrate `pdfCache.js` to use unified database
- [ ] Remove `y-indexeddb` dependency
- [ ] Update testing guide with Dexie mocking patterns
- [ ] Clean up old per-project IndexedDB databases

## Risks

1. **Migration complexity**: Need to migrate existing Y.Doc data from y-indexeddb
2. **y-dexie maturity**: Newer than y-indexeddb, less battle-tested
3. **Bundle size**: +14KB gzipped net increase
4. **Learning curve**: Team needs to learn Dexie API

## Mitigation

- Start with op queue (new code, no migration)
- Test y-dexie thoroughly before full migration
- Keep y-indexeddb as fallback during transition
- Migrate one project type at a time

## Conclusion

**Adopt Dexie.js** for:

- The planned operation queue (immediate)
- PDF cache (optional, when time permits)

**Keep current approach** for:

- Yjs persistence (y-indexeddb)
- Simple key-value data (localStorage)
- Query cache (TanStack Query)

The primary benefit is in the operation queue implementation, which is a core requirement for the local-first roadmap. Dexie will reduce complexity and improve maintainability for this critical feature.
