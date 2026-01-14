# Yjs Sync Guide

This guide explains how collaborative editing works in CoRATES using Yjs CRDTs, Durable Objects, and WebSocket connections.

## Overview

CoRATES uses Yjs (Yet another CRDT) for real-time collaborative editing. The architecture consists of:

- **Frontend**: Yjs documents synced via WebSocket
- **Backend**: Durable Object holding authoritative Yjs document
- **Persistence**: IndexedDB on client, Durable Object storage on server
- **Sync Protocol**: y-protocols/sync for document updates, y-protocols/awareness for presence

## Architecture

### Yjs Document Structure

The Yjs document is organized hierarchically:

```
Project (Y.Doc)
├── meta (Y.Map) - Project metadata (name, description, etc.)
├── members (Y.Map) - Project members (userId => { role, joinedAt })
└── reviews (Y.Map) - Reviews/Studies
    └── reviewId (Y.Map)
        ├── id, name, description, createdAt, updatedAt
        ├── checklists (Y.Map)
        │   └── checklistId (Y.Map)
        │       ├── id, title, assignedTo, status
        │       └── answers (Y.Map) - questionKey => { value, notes, updatedAt, updatedBy }
        └── pdfs (Y.Array) - PDF metadata
```

### Durable Object Implementation

The ProjectDoc Durable Object holds the authoritative Yjs document:

```js
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

// y-websocket message types
const messageSync = 0;
const messageAwareness = 1;

/**
 * ProjectDoc Durable Object
 *
 * Holds the authoritative Y.Doc for a project with hierarchical structure.
 */
export class ProjectDoc {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map(); // Map<WebSocket, { user, awarenessClientId }>
    this.doc = null;
    this.awareness = null;
  }
}
```

### Document Initialization and Persistence

The Durable Object loads persisted state on initialization and saves on every update:

```js
async initializeDoc() {
  if (!this.doc) {
    this.doc = new Y.Doc();
    this.awareness = new awarenessProtocol.Awareness(this.doc);

    // Load persisted state if exists
    const persistedState = await this.state.storage.get('yjs-state');
    if (persistedState) {
      Y.applyUpdate(this.doc, new Uint8Array(persistedState));
    }

    // Persist the FULL document state on every update
    this.doc.on('update', async (update, origin) => {
      const fullState = Y.encodeStateAsUpdate(this.doc);
      await this.state.storage.put('yjs-state', Array.from(fullState));
      // Broadcast update to all connected clients
      this.broadcastBinary(message, origin);
    });
  }
}
```

## Client-Side Sync

### Unified Dexie Database

CoRATES uses a unified Dexie database with the `y-dexie` addon for client-side persistence. This provides:

- Single IndexedDB database for all client data
- Native Y.Doc persistence via y-dexie addon
- PDF cache, operation queue, avatar cache, and more

```js
import Dexie from 'dexie';
import yDexie from 'y-dexie';

class CoratesDB extends Dexie {
  constructor() {
    super('corates', { addons: [yDexie] });

    this.version(1).stores({
      // Y.Doc stored as 'ydoc' property via y-dexie
      projects: 'id, orgId, updatedAt, ydoc: Y.Doc',
      pdfs: 'id, projectId, studyId, cachedAt',
      ops: '++id, idempotencyKey, status, createdAt',
      avatars: 'userId, cachedAt',
      formStates: 'key, type, timestamp',
      localChecklists: 'id, createdAt, updatedAt',
      localChecklistPdfs: 'checklistId, updatedAt',
      queryCache: 'key',
    });
  }
}

export const db = new CoratesDB();
```

### Connection Registry

The `useProject` hook uses a connection registry to prevent multiple connections to the same project:

```js
const connectionRegistry = new Map();

function getOrCreateConnection(projectId) {
  if (!projectId) return null;

  if (connectionRegistry.has(projectId)) {
    const entry = connectionRegistry.get(projectId);
    entry.refCount++;
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

### useProject Hook

The `useProject` primitive manages client-side Yjs connection with y-dexie persistence:

```js
import { DexieYProvider } from 'y-dexie';
import { db } from '../db.js';

function connect() {
  const { ydoc } = connectionEntry;

  // Ensure the project row exists in Dexie, then load the Y.Doc
  db.projects.get(projectId).then(async existingProject => {
    if (!existingProject) {
      await db.projects.put({ id: projectId, updatedAt: Date.now() });
    }

    const project = await db.projects.get(projectId);

    // Load the Dexie Y.Doc and apply its state
    connectionEntry.dexieProvider = DexieYProvider.load(project.ydoc);

    connectionEntry.dexieProvider.whenLoaded.then(() => {
      // Apply persisted state from Dexie to our Y.Doc
      const persistedState = Y.encodeStateAsUpdate(project.ydoc);
      Y.applyUpdate(ydoc, persistedState);

      // Subscribe to updates to persist them to Dexie
      ydoc.on('update', (update, origin) => {
        if (origin !== 'dexie-sync') {
          Y.applyUpdate(project.ydoc, update, 'dexie-sync');
        }
      });
    });
  });
}
```

### Sync Manager

The sync manager handles bidirectional sync between Yjs and the store:

```js
export function createSyncManager(projectId, getYDoc) {
  /**
   * Sync from Y.Doc to store
   * Called when Y.Doc changes (from local edits or remote sync)
   */
  function syncFromYDoc() {
    const ydoc = getYDoc();
    if (!ydoc) return;

    const metaYMap = ydoc.getMap('meta');
    const membersYMap = ydoc.getMap('members');
    const reviewsYMap = ydoc.getMap('reviews');

    // Convert Yjs structures to plain objects
    const meta = yMapToPlain(metaYMap);
    const members = Array.from(membersYMap.entries()).map(([userId, memberData]) => ({
      userId,
      ...yMapToPlain(memberData),
    }));

    const studies = Array.from(reviewsYMap.entries())
      .map(([studyId, studyYMap]) => buildStudyFromYMap(studyId, studyData, studyYMap))
      .filter(Boolean);

    // Update store
    projectStore.setProjectData(projectId, { meta, members, studies });
    projectStore.setConnectionState(projectId, { synced: true });
  }

  return { syncFromYDoc };
}
```

### y-dexie Persistence

Client-side persistence uses y-dexie, which stores Y.Doc directly in Dexie tables:

```js
import { DexieYProvider } from 'y-dexie';
import { db } from '../db.js';

// The ydoc property on project rows is managed by y-dexie
const project = await db.projects.get(projectId);
connectionEntry.dexieProvider = DexieYProvider.load(project.ydoc);
```

**Key difference from y-indexeddb:** y-dexie integrates directly with Dexie, allowing Y.Doc to be stored alongside other project data in a single database.

## WebSocket Connection

### Connection Lifecycle

1. **Connect**: Client opens WebSocket to Durable Object
2. **Authenticate**: Session token sent in query parameter or header
3. **Sync**: Initial document state sent from server
4. **Subscribe**: Client subscribes to updates
5. **Update**: Changes broadcast to all connected clients

### WebSocket Message Types

- `messageSync` (0): Document update messages
- `messageAwareness` (1): Presence/awareness updates

### Handling Updates

```js
// Client receives update
ws.onmessage = event => {
  const data = JSON.parse(event.data);
  if (data.type === 'sync' || data.type === 'update') {
    const update = new Uint8Array(data.update);
    Y.applyUpdate(ydoc, update);
    // Sync manager will update the store
  }
};
```

## Offline Support

### Client-Side

- **Dexie/y-dexie**: All Yjs updates persisted locally in unified database
- **Queue**: Changes queue when offline (in `ops` table)
- **Sync**: Automatic sync when connection restored

### Server-Side

- **Durable Object Storage**: Full document state persisted
- **State Vector**: Efficient diff-based sync on reconnect

### Local Projects

Local projects (prefixed with `local-`) work entirely offline without WebSocket connection:

```js
const isLocalProject = () => projectId && projectId.startsWith('local-');

// For local projects, don't connect to WebSocket
if (isLocalProject()) {
  projectStore.setConnectionState(projectId, {
    connecting: false,
    connected: true,
    synced: true,
  });
  return;
}
```

## Data Operations

### Reading Data

Read from the store (which is kept in sync with Yjs):

```js
import projectStore from '@/stores/projectStore.js';

const studies = () => projectStore.getStudies(projectId);
const meta = () => projectStore.getMeta(projectId);
```

### Writing Data

Write via action store, which updates Yjs:

```js
import projectActionsStore from '@/stores/projectActionsStore';

// Create study
await projectActionsStore.createStudy({
  id: studyId,
  name: 'Study Name',
});

// Update checklist answer
await projectActionsStore.updateChecklistAnswer(studyId, checklistId, 'q1', {
  value: 'yes',
  notes: 'Based on section 2.1',
});
```

### Yjs Data Structures

Use appropriate Yjs types:

- **Y.Map**: For key-value objects (meta, members, answers)
- **Y.Array**: For ordered lists (PDFs)
- **Y.Text**: For collaborative text (notes)

```js
// Update Y.Map
const metaYMap = ydoc.getMap('meta');
metaYMap.set('name', 'New Project Name');

// Update Y.Array
const pdfsYArray = studyYMap.get('pdfs');
pdfsYArray.push([{ id: pdfId, name: 'document.pdf' }]);

// Update nested Y.Map
const answersYMap = checklistYMap.get('answers');
const answerData = answersYMap.get('q1') || new Y.Map();
answerData.set('value', 'yes');
answersYMap.set('q1', answerData);
```

## Awareness (Presence)

Awareness protocol tracks user presence:

- Current cursor position
- User information
- Custom presence data

```js
import * as awarenessProtocol from 'y-protocols/awareness';

const awareness = new awarenessProtocol.Awareness(ydoc);
awareness.setLocalStateField('user', {
  name: 'John Doe',
  color: '#ff0000',
});
```

## Conflict Resolution

Yjs uses CRDTs (Conflict-free Replicated Data Types) for automatic conflict resolution:

- **No conflicts**: All changes merge automatically
- **Last write wins**: For scalar values (strings, numbers)
- **Ordered merging**: For arrays (based on logical timestamps)

## Best Practices

### DO

- Read from store, not directly from Yjs
- Write via action stores, not directly to Yjs
- Use Y.Map for objects, Y.Array for lists
- Handle offline scenarios gracefully
- Clean up connections when components unmount

### DON'T

- Don't modify Yjs structures directly from components
- Don't bypass the store when reading data
- Don't create new Y.Doc instances for the same project
- Don't forget to handle connection errors
- Don't store large binary data in Yjs (use R2/storage instead)

## Related Guides

- [State Management Guide](/guides/state-management) - For store patterns
- [Primitives Guide](/guides/primitives) - For useProject hook
- [Architecture Diagrams](/architecture/diagrams/08-yjs-sync) - For visual architecture
