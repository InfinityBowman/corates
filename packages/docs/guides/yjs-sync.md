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

```1:39:packages/workers/src/durable-objects/ProjectDoc.js
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { verifyAuth } from '../auth/config.js';
import { createDb } from '../db/client.js';
import { projectMembers } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

// y-websocket message types
const messageSync = 0;
const messageAwareness = 1;

/**
 * ProjectDoc Durable Object
 *
 * Holds the authoritative Y.Doc for a project with hierarchical structure:
 *
 * Project (this DO)
 *   - meta: Y.Map (project metadata: name, description, createdAt, etc.)
 *   - members: Y.Map (userId => { role, joinedAt })
 *   - reviews: Y.Map (reviewId => {
 *       id, name, description, createdAt, updatedAt,
 *       checklists: Y.Map (checklistId => {
 *         id, title, assignedTo (userId), status, createdAt, updatedAt,
 *         answers: Y.Map (questionKey => { value, notes, updatedAt, updatedBy })
 *       })
 *     })
 */
export class ProjectDoc {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    // Map<WebSocket, { user, awarenessClientId }>
    this.sessions = new Map();
    this.doc = null;
    this.awareness = null;
  }
```

### Document Initialization and Persistence

```286:327:packages/workers/src/durable-objects/ProjectDoc.js
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
      // This ensures we don't lose data when the DO restarts
      this.doc.on('update', async (update, origin) => {
        // Encode the full document state, not just the incremental update
        const fullState = Y.encodeStateAsUpdate(this.doc);
        await this.state.storage.put('yjs-state', Array.from(fullState));

        // Broadcast update to all connected clients (except origin)
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.writeUpdate(encoder, update);
        const message = encoding.toUint8Array(encoder);
        this.broadcastBinary(message, origin);
      });

      // Broadcast awareness updates to all clients
      this.awareness.on('update', ({ added, updated, removed }, origin) => {
        const changedClients = added.concat(updated, removed);
        if (changedClients.length > 0) {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, messageAwareness);
          encoding.writeVarUint8Array(
            encoder,
            awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients),
          );
          const message = encoding.toUint8Array(encoder);
          this.broadcastBinary(message, origin);
        }
      });
    }
  }
```

## Client-Side Sync

### useProject Hook

The `useProject` primitive manages client-side Yjs connection:

```149:190:packages/web/src/primitives/useProject/index.js
export function useProject(projectId) {
  // Check if this is a local-only project
  const isLocalProject = () => projectId && projectId.startsWith('local-');

  // Get shared connection from registry
  const connectionEntry = getOrCreateConnection(projectId);

  const isOnline = useOnlineStatus();

  // Reactive getters from store
  const connectionState = createMemo(() => projectStore.getConnectionState(projectId));
  const connected = () => connectionState().connected;
  const connecting = () => connectionState().connecting;
  const synced = () => connectionState().synced;
  const error = () => connectionState().error;

  const projectData = createMemo(() => projectStore.getProject(projectId));
  const studies = () => projectData()?.studies || [];
  const meta = () => projectData()?.meta || {};
  const members = () => projectData()?.members || [];

  // Helper to get the current Y.Doc from the shared connection
  const getYDoc = () => connectionEntry?.ydoc || null;

  // Connect to the project's WebSocket (or just IndexedDB for local projects)
  function connect() {
    if (!projectId || !connectionEntry) return;

    // If already initialized, just return - connection is shared
    if (connectionEntry.initialized) return;

    // Mark as initializing to prevent race conditions
    connectionEntry.initialized = true;

    // Set this as the active project
    projectStore.setActiveProject(projectId);
    projectStore.setConnectionState(projectId, { connecting: true, error: null });

    const { ydoc } = connectionEntry;

    // Initialize sync manager
    connectionEntry.syncManager = createSyncManager(projectId, getYDoc);

    // Initialize domain operation modules
    connectionEntry.studyOps = createStudyOperations(projectId, getYDoc, synced);
    connectionEntry.checklistOps = createChecklistOperations(projectId, getYDoc, synced);
    connectionEntry.pdfOps = createPdfOperations(projectId, getYDoc, synced);
    connectionEntry.reconciliationOps = createReconciliationOperations(projectId, getYDoc, synced);
```

### Sync Manager

The sync manager handles bidirectional sync between Yjs and the store:

```14:53:packages/web/src/primitives/useProject/sync.js
export function createSyncManager(projectId, getYDoc) {
  /**
   * Sync from Y.Doc to store
   * Called when Y.Doc changes (from local edits or remote sync)
   */
  function syncFromYDoc() {
    const ydoc = getYDoc();
    if (!ydoc) return;

    try {
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
        .map(([studyId, studyYMap]) => {
          const studyData = yMapToPlain(studyYMap);
          return buildStudyFromYMap(studyId, studyData, studyYMap);
        })
        .filter(Boolean);

      // Update store
      projectStore.setProjectData(projectId, { meta, members, studies });
      projectStore.setConnectionState(projectId, { synced: true });
    } catch (error) {
      console.error('Error syncing from Y.Doc:', error);
      projectStore.setConnectionState(projectId, { error: error.message });
    }
  }

  return { syncFromYDoc };
}
```

### IndexedDB Persistence

Client-side persistence uses y-indexeddb:

```js
import { IndexeddbPersistence } from 'y-indexeddb';

// Set up IndexedDB persistence for offline support
connectionEntry.indexeddbProvider = new IndexeddbPersistence(
  `corates-project-${projectId}`,
  connectionEntry.ydoc
);
```

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
ws.onmessage = (event) => {
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

- **IndexedDB**: All Yjs updates persisted locally
- **Queue**: Changes queued when offline
- **Sync**: Automatic sync when connection restored

### Server-Side

- **Durable Object Storage**: Full document state persisted
- **State Vector**: Efficient diff-based sync on reconnect

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
await projectActionsStore.updateChecklistAnswer(
  studyId,
  checklistId,
  'q1',
  { value: 'yes', notes: 'Based on section 2.1' }
);
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
