# Local-First Comparison: Outline vs CoRATES

## Overview

This report compares local-first architecture patterns between Outline and CoRATES, focusing on offline support, real-time collaboration, conflict resolution, and data persistence strategies.

| Aspect                  | CoRATES                          | Outline                |
| ----------------------- | -------------------------------- | ---------------------- |
| **CRDT Library**        | Yjs                              | Yjs                    |
| **Server Sync**         | Cloudflare Durable Objects       | Hocuspocus (Node.js)   |
| **Client Persistence**  | Dexie (IndexedDB) via y-dexie    | y-indexeddb            |
| **Offline Mode**        | Full offline with local projects | Limited (cache only)   |
| **Conflict Resolution** | Automatic (CRDT)                 | Automatic (CRDT)       |
| **Real-time Protocol**  | WebSocket (custom DO handler)    | WebSocket (Hocuspocus) |

---

## 1. Architecture Comparison

### CoRATES: Cloudflare Durable Objects

CoRATES uses Cloudflare Durable Objects as the authoritative server-side state holder:

```
Client (SolidJS)
    |
    +-- y-dexie (Dexie IndexedDB persistence)
    |
    +-- WebSocket --> Durable Object (ProjectDoc)
                          |
                          +-- Y.Doc (authoritative state)
                          |
                          +-- DO Storage (persistence)
```

**Key Files:**

- [packages/workers/src/durable-objects/ProjectDoc.js](packages/workers/src/durable-objects/ProjectDoc.js) - Server-side Y.Doc holder
- [packages/web/src/primitives/useProject/index.js](packages/web/src/primitives/useProject/index.js) - Client hook
- [packages/web/src/primitives/db.js](packages/web/src/primitives/db.js) - Unified Dexie database

**Strengths:**

- Edge-deployed (low latency globally)
- Automatic scaling per project
- No separate database for CRDT state
- Single-writer guarantee from DO

**Trade-offs:**

- Cloudflare-specific (vendor lock-in)
- Limited debugging tools
- No built-in revision history

---

### Outline: Hocuspocus Server

Outline uses Hocuspocus, a Node.js-based collaboration server:

```
Client (React)
    |
    +-- y-indexeddb (IndexedDB persistence)
    |
    +-- HocuspocusProvider --> Hocuspocus Server
                                   |
                                   +-- Y.Doc (in-memory)
                                   |
                                   +-- PostgreSQL (persistence via PersistenceExtension)
```

**Key Files:**

- `server/collaboration/PersistenceExtension.ts` - Database sync
- `app/scenes/Document/components/MultiplayerEditor.tsx` - Client setup
- `server/commands/documentCollaborativeUpdater.ts` - Save logic

**Strengths:**

- Self-hostable
- PostgreSQL integration for querying
- Built-in revision history
- Mature ecosystem (Hocuspocus extensions)

**Trade-offs:**

- Single server (scaling requires Redis)
- Higher latency for distributed users
- Separate CRDT state from document model

---

## 2. Client-Side Persistence

### CoRATES: Unified Dexie Database

CoRATES uses a single Dexie database with multiple tables:

```javascript
// packages/web/src/primitives/db.js
class CoratesDB extends Dexie {
  constructor() {
    super('corates', { addons: [yDexie] });

    this.version(1).stores({
      projects: 'id, orgId, updatedAt, ydoc: Y.Doc', // Y.Doc via y-dexie
      pdfs: 'id, projectId, studyId, cachedAt', // PDF cache
      ops: '++id, idempotencyKey, status', // Operation queue
      avatars: 'userId, cachedAt', // Avatar cache
      formStates: 'key, type', // Form persistence
      localChecklists: 'id, type', // Offline checklists
      queryCache: 'key', // TanStack Query cache
    });
  }
}
```

**Advantages:**

- Single database for all offline data
- Y.Doc stored directly in Dexie (y-dexie addon)
- Unified cleanup on sign-out
- Operation queue for offline mutations (future)

---

### Outline: Per-Document IndexedDB

Outline creates separate IndexedDB databases per document:

```typescript
// app/scenes/Document/components/MultiplayerEditor.tsx
useLayoutEffect(() => {
  const name = `document.${documentId}`;
  const localProvider = new IndexeddbPersistence(name, ydoc);
  // ...
}, [documentId]);
```

**Advantages:**

- Simple per-document isolation
- Standard y-indexeddb library
- No custom persistence code

**Disadvantages:**

- Many IndexedDB databases (one per document)
- No centralized cache management
- Manual cleanup required on logout

---

## 3. Real-Time Sync Protocol

### CoRATES: Custom Durable Object Handler

CoRATES implements the y-websocket protocol directly in a Durable Object:

```javascript
// packages/workers/src/durable-objects/ProjectDoc.js
async handleWebSocket(request) {
  const { user } = await this.authenticateRequest(request);
  await this.initializeDoc();

  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);

  this.state.acceptWebSocket(server);

  // Send initial sync
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  syncProtocol.writeSyncStep1(encoder, this.doc);
  server.send(encoding.toUint8Array(encoder));

  return new Response(null, { status: 101, webSocket: client });
}
```

**Features:**

- Full y-websocket protocol (sync + awareness)
- Per-project Durable Object isolation
- Automatic persistence to DO storage
- Member authorization on connect

---

### Outline: Hocuspocus Provider

Outline uses the standard HocuspocusProvider:

```typescript
// app/scenes/Document/components/MultiplayerEditor.tsx
const provider = new HocuspocusProvider({
  url: `${env.COLLABORATION_URL}/collaboration`,
  name: `document.${documentId}`,
  document: ydoc,
  token,
  parameters: { editorVersion: EDITOR_VERSION },
});

provider.on('synced', () => setRemoteSynced(true));
provider.on('status', ev => ui.setMultiplayerStatus(ev.status));
```

**Features:**

- Standard Hocuspocus library
- Built-in reconnection logic
- Awareness protocol for presence
- Version compatibility checks

---

## 4. Offline Support Comparison

### CoRATES: Full Offline Mode

CoRATES supports true offline-first with local-only projects:

| Feature           | Online Projects      | Local Projects      |
| ----------------- | -------------------- | ------------------- |
| **Persistence**   | Dexie + Server       | Dexie only          |
| **Sync**          | WebSocket to DO      | None (offline only) |
| **Data Location** | Server authoritative | Client only         |
| **Sharing**       | Yes                  | No                  |

```javascript
// packages/web/src/primitives/useProject/index.js
export function useProject(projectId) {
  const isLocalProject = () => projectId?.startsWith('local-');

  // Local projects never connect to server
  if (isLocalProject()) {
    // Initialize Y.Doc with Dexie persistence only
    connectionEntry.dexieProvider = DexieYProvider.for(ydoc, projectId);
  } else {
    // Online projects connect via WebSocket
    connectionEntry.connectionManager = createConnectionManager(/*...*/);
  }
}
```

**Offline Capabilities:**

- Create and edit local checklists without internet
- PDF caching for offline viewing
- Form state preservation across OAuth redirects
- TanStack Query cache for API responses

---

### Outline: Cache-Based Offline

Outline has limited offline support (cache-only):

```typescript
// app/scenes/Document/components/MultiplayerEditor.tsx
const showCache = !isLocalSynced && !isRemoteSynced;

return (
  <>
    {showCache && (
      <Editor
        defaultValue={props.defaultValue}
        readOnly  // Cache is read-only
        ref={ref}
      />
    )}
    <Editor
      readOnly={props.readOnly || editorVersionBehind}
      extensions={extensions}
      // ...
    />
  </>
);
```

**Offline Capabilities:**

- Read cached documents from IndexedDB
- No offline editing (read-only mode)
- Reconnection when online

**Missing:**

- No offline document creation
- No offline editing queue
- No local-only document mode

---

## 5. Conflict Resolution

Both projects use Yjs CRDTs, which provide automatic conflict resolution:

### How Yjs Merges Concurrent Edits

```
User A: "Hello World" -> "Hello Beautiful World"
User B: "Hello World" -> "Hello Wonderful World"

After sync: "Hello Beautiful Wonderful World" (or similar merge)
```

### CoRATES: Hierarchical Y.Map Structure

```javascript
// Project structure in Y.Doc
Project Y.Doc
  +-- meta: Y.Map { name, description, createdAt }
  +-- members: Y.Map { [userId]: { role, joinedAt } }
  +-- reviews: Y.Map { [studyId]: {
        name, createdAt,
        checklists: Y.Map { [checklistId]: {
          answers: Y.Map { [questionKey]: { value, notes } }
        }}
      }}
```

**Conflict Scenarios Handled:**

- Two users edit different checklist answers: Auto-merged
- Two users rename study simultaneously: Last-write-wins per field
- User removed while editing: Changes preserved until disconnect

---

### Outline: ProseMirror + Y.Doc

```typescript
// Outline stores rich text in Y.XmlFragment
const type = doc.get('default', Y.XmlFragment);
```

**Conflict Scenarios Handled:**

- Two users edit different paragraphs: Auto-merged
- Two users edit same paragraph: Character-level merge
- Cursor positions tracked via awareness

---

## 6. Data Persistence Strategy

### CoRATES: Dual Storage

| Layer      | Storage           | Purpose              |
| ---------- | ----------------- | -------------------- |
| **Client** | Dexie (IndexedDB) | Offline persistence  |
| **Server** | DO Storage        | Authoritative state  |
| **Backup** | D1 (SQLite)       | Metadata + relations |

```javascript
// Server persistence in Durable Object
async initializeDoc() {
  const stored = await this.state.storage.get('ydoc');
  if (stored) {
    Y.applyUpdate(this.doc, new Uint8Array(stored));
  }
}

// Auto-save on changes
this.doc.on('update', async (update) => {
  await this.state.storage.put('ydoc', Y.encodeStateAsUpdate(this.doc));
});
```

---

### Outline: PostgreSQL + Redis

| Layer      | Storage     | Purpose               |
| ---------- | ----------- | --------------------- |
| **Client** | y-indexeddb | Offline cache         |
| **Server** | PostgreSQL  | Authoritative state   |
| **Cache**  | Redis       | Collaborator tracking |

```typescript
// server/collaboration/PersistenceExtension.ts
async onStoreDocument({ document, documentName }) {
  const state = Y.encodeStateAsUpdate(document);

  await documentCollaborativeUpdater({
    documentId,
    ydoc: document,
    sessionCollaboratorIds,
  });
}

// server/commands/documentCollaborativeUpdater.ts
const state = Y.encodeStateAsUpdate(ydoc);
const content = yDocToProsemirrorJSON(ydoc, "default");

document.state = Buffer.from(state);
document.content = content;
await document.save();
```

---

## 7. Presence and Awareness

### CoRATES: Basic Awareness

```javascript
// packages/web/src/primitives/useProject/connection.js
awareness.setLocalStateField('user', {
  id: userId,
  name: userName,
  color: userColor,
});
```

**Features:**

- User presence per project
- Cursor position (future)
- Connection status

---

### Outline: Rich Presence

```typescript
// app/editor/extensions/Multiplayer.ts
const userAwarenessCache = new Map<string, { aw: UserAwareness; changedAt: Date }>();

// Track scroll position
const syncScrollPosition = throttle(() => {
  provider.setAwarenessField('scrollY', window.scrollY / window.innerHeight);
}, 250);

// Track editing state
presence.touch(documentId, currentUser.id, isEditing);
```

**Features:**

- User presence with avatars
- Cursor positions with names
- Scroll position sync (follow mode)
- Idle detection (disconnect when inactive)

---

## 8. Additional Outline Features (Not in CoRATES)

### 8.1 Revision History System

Outline has a complete revision history system that CoRATES lacks:

```typescript
// server/models/Revision.ts - Revision model
class Revision {
  id: string;
  documentId: string;
  title: string;
  content: ProsemirrorData; // JSON snapshot
  text: string; // Markdown (deprecated)
  editorVersion: string; // Editor version tracking
  collaboratorIds: string[]; // Who contributed to this revision
  userId: string; // Primary author
  name: string | null; // Optional named revision
  revisionCount: number; // Version number
}

// Automatic revision creation on document save
// server/commands/revisionCreator.ts
async function revisionCreator({ event, document, user }) {
  const collaboratorIds = await Redis.defaultClient.smembers(Document.getCollaboratorKey(document.id));
  await Revision.createFromDocument(ctx, document, collaboratorIds);
}
```

**Features:**

- Automatic revision snapshots on save
- Named revisions (like git tags)
- Restore document to any revision
- Visual diff between revisions
- Export revisions as HTML/Markdown/PDF
- Tracks all collaborator IDs per revision

**API Endpoints:**

- `POST /api/revisions.list` - List all revisions for a document
- `POST /api/revisions.info` - Get a specific revision
- `POST /api/documents.restore` - Restore to a revision
- `POST /api/revisions.delete` - Delete a revision

### 8.2 Collaborator Attribution

Outline tracks who contributed to each document in real-time:

```typescript
// server/commands/documentCollaborativeUpdater.ts
export default async function documentCollaborativeUpdater({
  documentId,
  ydoc,
  sessionCollaboratorIds, // IDs of users who edited since last save
}) {
  // Extract collaborators from Yjs PermanentUserData
  const pud = new Y.PermanentUserData(ydoc);
  const pudIds = Array.from(pud.clients.values());

  const collaboratorIds = uniq([
    ...document.collaboratorIds, // Existing collaborators
    ...sessionCollaboratorIds, // Current session collaborators
    ...pudIds, // From Yjs client data
  ]);

  await document.update({
    collaboratorIds,
    lastModifiedById,
  });
}
```

**Features:**

- `document.collaboratorIds` - Array of all user IDs who edited
- Uses Redis Set to track session collaborators
- `Y.PermanentUserData` for CRDT-level attribution
- UI shows collaborator avatars with presence status

### 8.3 Editor Version Compatibility

Outline checks client/server editor version compatibility:

```typescript
// app/scenes/Document/components/MultiplayerEditor.tsx
const provider = new HocuspocusProvider({
  parameters: {
    editorVersion: EDITOR_VERSION, // Sent to server
  },
  // ...
});

// Server rejects outdated clients
provider.on('close', event => {
  if (event.code === EditorUpdateError.code) {
    setEditorVersionBehind(true);
    // Show "Please refresh to update editor" notice
  }
});
```

```typescript
// server/commands/documentCollaborativeUpdater.ts
const editorVersion =
  document.editorVersion && clientVersion ?
    semver.gt(clientVersion, document.editorVersion) ?
      clientVersion
    : document.editorVersion
  : (clientVersion ?? document.editorVersion);
```

**Benefits:**

- Prevents protocol mismatches
- Forces client refresh on breaking changes
- Tracks document's "last edited with" version

### 8.4 State Backfill Scripts

Outline has migration scripts to backfill/repair CRDT state:

```typescript
// server/scripts/20221008000000-backfill-crdt.ts
// Convert Markdown text to CRDT state
export default async function main() {
  const documents = await Document.unscoped().findAll({
    where: { state: null }, // Documents without CRDT state
  });

  for (const document of documents) {
    const ydoc = new Y.Doc();
    const type = ydoc.get('default', Y.XmlFragment);
    const doc = parser.parse(document.text);

    // Apply Prosemirror doc to Y.Doc
    updateYFragment(type.doc, type, doc, { mapping: new Map() });

    const state = Y.encodeStateAsUpdate(ydoc);
    document.state = Buffer.from(state);
    await document.save();
  }
}

// server/scripts/20221029000000-crdt-to-text.ts
// Regenerate Markdown from CRDT (opposite direction)
// server/scripts/20231119000000-backfill-document-content.ts
// Backfill JSON content from CRDT state
// server/scripts/20231119000000-backfill-revision-content.ts
// Backfill revision content
```

**Scripts Available:**

- `backfill-crdt.ts` - Create CRDT state from Markdown
- `crdt-to-text.ts` - Regenerate Markdown from CRDT
- `backfill-document-content.ts` - Generate JSON content from state
- `backfill-revision-content.ts` - Backfill revision JSON content

### 8.5 Document Publish/Unpublish Workflow

Outline has a draft -> published workflow:

```typescript
// server/models/Document.ts
class Document {
  publishedAt: Date | null; // null = draft

  async publish(ctx, { collectionId, silent, event }) {
    this.publishedAt = new Date();
    // Add to collection structure
    // Fire 'documents.publish' event
  }

  async unpublishWithCtx(ctx, { detach }) {
    // Remove from collection
    // Convert back to draft
    this.publishedAt = null;
    this.createdById = user.id; // Transfer ownership
  }
}
```

**Features:**

- Documents can exist as private drafts
- Publish to a collection makes visible to team
- Unpublish returns to draft state
- Fire events for integrations (Slack, webhooks)

### 8.6 Real-time Event Broadcasting

Outline broadcasts document events to all connected clients:

```typescript
// app/components/WebsocketProvider.tsx
socket.on('documents.update', async event => {
  // Reload document from server
  const document = documents.get(event.documentId);
  if (document) {
    await document.fetch();
  }
});

socket.on('collections.update.index', async event => {
  // Refetch collection structure
  for (const collectionDescriptor of event.collectionIds) {
    const collection = collections.get(collectionDescriptor.id);
    await collection?.fetchDocuments({ force: true });
  }
});
```

**Event Types:**

- `documents.update` - Document content changed
- `documents.publish` - Document published
- `documents.delete` - Document deleted
- `collections.update.index` - Collection structure changed
- `users.update` - User profile changed

### 8.7 Idle User Management

```typescript
// app/scenes/Document/components/MultiplayerEditor.tsx
const isIdle = useIdle();
const isVisible = usePageVisibility();

useEffect(() => {
  if (isIdle && !isVisible) {
    // Close WebSocket connection
    provider.disconnect();
  } else if (!isIdle || isVisible) {
    provider.connect();
  }
}, [isIdle, isVisible]);
```

**Features:**

- Automatic disconnect after inactivity
- Reconnect when tab becomes visible
- Reduces server connections for idle users
- Selection cursors fade after 10s inactivity

### 8.8 PermanentUserData for Attribution

```typescript
// Uses Yjs PermanentUserData for CRDT-level user tracking
const pud = new Y.PermanentUserData(ydoc);
const pudIds = Array.from(pud.clients.values());
```

This allows tracking which user made each CRDT operation, enabling:

- Fine-grained attribution
- Audit trails
- Blame functionality

---

## 9. Recommendations for CoRATES

### High Priority

1. **Add Idle Disconnect** (from Outline)

   ```javascript
   // Disconnect WebSocket when tab is hidden/idle
   useEffect(() => {
     if (isIdle && !isVisible) {
       connectionManager.disconnect();
     } else if (!isIdle || isVisible) {
       connectionManager.connect();
     }
   }, [isIdle, isVisible]);
   ```

   **Benefit:** Reduce server load, save resources

2. **Operation Queue for Offline Mutations**

   ```javascript
   // packages/web/src/primitives/db.js already has ops table
   // Implement queue processing:
   async function processOfflineQueue() {
     const pending = await db.ops.where('status').equals('pending').toArray();
     for (const op of pending) {
       try {
         await fetch(op.endpoint, { method: 'POST', body: op.payload });
         await db.ops.update(op.id, { status: 'applied' });
       } catch (e) {
         await db.ops.update(op.id, { attempts: op.attempts + 1 });
       }
     }
   }
   ```

   **Benefit:** True offline-first for non-CRDT operations

3. **Revision History System**

   ```javascript
   // Add revisions table to Dexie
   db.version(N).stores({
     revisions: '++id, projectId, createdAt, userId',
   });

   // Create revision on checklist save
   async function createRevision(projectId, ydoc, userId) {
     const state = Y.encodeStateAsUpdate(ydoc);
     await db.revisions.add({
       projectId,
       state,
       userId,
       collaboratorIds: getCurrentCollaborators(),
       createdAt: new Date(),
     });
   }
   ```

   **Benefit:** Undo mistakes, compliance, audit trails

### Medium Priority

4. **Collaborator Attribution**

   ```javascript
   // Track collaborators using Yjs PermanentUserData
   const pud = new Y.PermanentUserData(ydoc);
   pud.setUserMapping(doc, doc.clientID, userId);

   // On save, extract all collaborator IDs
   const collaboratorIds = Array.from(pud.clients.values());
   ```

5. **Version Compatibility Checks**

   ```javascript
   // Ensure client/server protocol compatibility
   provider.on('close', ev => {
     if (ev.code === EditorUpdateError.code) {
       setEditorVersionBehind(true);
       showUpgradeNotice();
     }
   });
   ```

6. **Event Broadcasting for Multi-Tab Sync**

   ```javascript
   // Broadcast channel for same-origin tabs
   const channel = new BroadcastChannel('corates-sync');

   channel.onmessage = event => {
     if (event.data.type === 'project.updated') {
       // Invalidate TanStack Query cache
       queryClient.invalidateQueries(['project', event.data.projectId]);
     }
   };
   ```

### Low Priority

7. **Follow Mode** (from Outline)
   - Allow users to follow another user's scroll position
   - Useful for presentations/demos

8. **Batch Persistence Optimization**
   - Debounce Y.Doc saves to reduce DO storage writes
   - Already partially implemented in Outline

9. **State Migration Tooling**
   ```javascript
   // Create scripts for data repair/migration
   // scripts/backfill-crdt.js - Recreate CRDT from checklist data
   // scripts/validate-state.js - Check for corrupted Y.Doc states
   ```

---

## 10. Summary

| Capability                   | CoRATES              | Outline                 | Winner  |
| ---------------------------- | -------------------- | ----------------------- | ------- |
| **True Offline Editing**     | Yes (local projects) | No                      | CoRATES |
| **Rich Presence**            | Basic                | Advanced                | Outline |
| **Self-Hostable**            | No (Cloudflare)      | Yes                     | Outline |
| **Global Latency**           | Low (edge)           | Higher (single server)  | CoRATES |
| **Revision History**         | No                   | Yes (full system)       | Outline |
| **Unified Storage**          | Yes (Dexie)          | No (per-doc)            | CoRATES |
| **Idle Disconnect**          | No                   | Yes                     | Outline |
| **Collaborator Attribution** | No                   | Yes (PermanentUserData) | Outline |
| **Editor Version Check**     | No                   | Yes                     | Outline |
| **Publish/Unpublish**        | No                   | Yes                     | Outline |
| **Event Broadcasting**       | No                   | Yes (WebSocket events)  | Outline |
| **State Migration Scripts**  | No                   | Yes (backfill tools)    | Outline |

### Key Takeaway

CoRATES has a more modern, edge-native architecture with better offline support, while Outline has more mature collaboration features (presence, history, idle management, attribution). The recommended path is to adopt Outline's presence and idle management patterns while keeping CoRATES's superior offline architecture.

### Priority Implementation Order

1. **Revision History** - Most impactful for users (undo mistakes, compliance)
2. **Idle Disconnect** - Resource savings, improved scalability
3. **Collaborator Attribution** - User trust, audit trails
4. **Event Broadcasting** - Multi-tab sync, real-time notifications
5. **Editor Version Compatibility** - Forward compatibility, safe upgrades
