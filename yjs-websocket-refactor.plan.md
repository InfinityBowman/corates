# Y.js WebSocket Provider Refactor Plan

## Goal

Migrate from custom JSON-based WebSocket protocol to `y-websocket` library to enable:

- Built-in awareness protocol (real-time cursors, presence indicators)
- Battle-tested reconnection and sync logic
- Reduced frontend code complexity

## Current State

### Frontend (`packages/web/src/primitives/useProject/connection.js`)

- Custom WebSocket connection manager (~190 lines)
- Manual reconnection with exponential backoff
- JSON message format: `{ type: 'sync'|'update', update: [...] }`
- No awareness support

### Backend (`packages/workers/src/durable-objects/ProjectDoc.js`)

- Cloudflare Durable Object with WebSocket handling
- JSON protocol for sync/update messages
- Custom presence: `user-joined`, `user-left` messages
- Auth via cookies before WebSocket upgrade

---

## Phase 1: Backend - Implement y-websocket Binary Protocol

**Files to modify:**

- `packages/workers/src/durable-objects/ProjectDoc.js`

**Tasks:**

### 1.1 Add y-protocols dependency

```bash
cd packages/workers && pnpm add y-protocols
```

### 1.2 Implement message encoding/decoding

The y-websocket protocol uses binary messages with a message type byte prefix:

- `0` = sync message (sync step 1, sync step 2, update)
- `1` = awareness message

```js
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

const messageSync = 0;
const messageAwareness = 1;
```

### 1.3 Refactor `handleWebSocket` method

Replace JSON message handling with binary protocol:

```js
// Current (JSON):
server.send(JSON.stringify({ type: 'sync', update: Array.from(currentState) }));

// New (binary):
const encoder = encoding.createEncoder();
encoding.writeVarUint(encoder, messageSync);
syncProtocol.writeSyncStep1(encoder, this.doc);
server.send(encoding.toUint8Array(encoder));
```

### 1.4 Add Awareness instance

```js
constructor(state, env) {
  // ... existing code
  this.awareness = null
}

async initializeDoc() {
  if (!this.doc) {
    this.doc = new Y.Doc()
    this.awareness = new awarenessProtocol.Awareness(this.doc)

    // Clean up awareness on client disconnect
    this.awareness.on('update', ({ added, updated, removed }, origin) => {
      const changedClients = added.concat(updated, removed)
      // Broadcast awareness to all clients
    })
    // ... rest of init
  }
}
```

### 1.5 Handle incoming binary messages

```js
server.addEventListener('message', async event => {
  const data = new Uint8Array(event.data);
  const decoder = decoding.createDecoder(data);
  const messageType = decoding.readVarUint(decoder);

  switch (messageType) {
    case messageSync:
      // Handle sync protocol messages
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.readSyncMessage(decoder, encoder, this.doc, server);
      if (encoding.length(encoder) > 1) {
        server.send(encoding.toUint8Array(encoder));
      }
      break;
    case messageAwareness:
      // Handle awareness updates
      awarenessProtocol.applyAwarenessUpdate(this.awareness, decoding.readVarUint8Array(decoder), server);
      break;
  }
});
```

### 1.6 Broadcast updates properly

```js
// On Y.Doc update
this.doc.on('update', (update, origin) => {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  syncProtocol.writeUpdate(encoder, update);
  const message = encoding.toUint8Array(encoder);

  this.sessions.forEach(session => {
    if (session !== origin && session.readyState === WebSocket.OPEN) {
      session.send(message);
    }
  });
});
```

---

## Phase 2: Frontend - Switch to WebsocketProvider

**Files to modify:**

- `packages/web/src/primitives/useProject/connection.js`
- `packages/web/package.json`

**Tasks:**

### 2.1 Add y-websocket dependency

```bash
cd packages/web && pnpm add y-websocket
```

### 2.2 Rewrite connection.js

Replace entire file with WebsocketProvider usage:

```js
import { WebsocketProvider } from 'y-websocket';
import { getWsBaseUrl } from '@config/api.js';
import projectStore from '@/stores/projectStore.js';

export function createConnectionManager(projectId, ydoc, options) {
  const { onSync, isLocalProject } = options;

  let provider = null;

  function connect() {
    if (isLocalProject()) return;

    const wsUrl = `${getWsBaseUrl()}/api/project/${projectId}`;

    provider = new WebsocketProvider(wsUrl, projectId, ydoc, {
      connect: true,
      // WebsocketProvider handles reconnection automatically
    });

    provider.on('status', ({ status }) => {
      projectStore.setConnectionState(projectId, {
        connected: status === 'connected',
        connecting: status === 'connecting',
      });
    });

    provider.on('sync', isSynced => {
      if (isSynced && onSync) onSync();
    });

    provider.on('connection-error', event => {
      projectStore.setConnectionState(projectId, {
        error: 'Connection error',
        connected: false,
      });
    });
  }

  function disconnect() {
    if (provider) {
      provider.destroy();
      provider = null;
    }
  }

  function reconnect() {
    disconnect();
    connect();
  }

  function getAwareness() {
    return provider?.awareness;
  }

  return {
    connect,
    disconnect,
    reconnect,
    getAwareness,
  };
}
```

### 2.3 Update useProject primitive (optional)

Expose awareness for components to use:

```js
// In useProject.js or wherever connection is consumed
const awareness = connectionManager.getAwareness();

// Set local user state
awareness?.setLocalState({
  user: { id: user.id, name: user.name, color: getUserColor(user.id) },
  cursor: null, // Will be updated by editor
});
```

---

## Phase 3: Implement Awareness Features (optional)

**New files to create:**

- `packages/web/src/primitives/useAwareness.js`
- `packages/web/src/components/PresenceIndicator.jsx`
- `packages/web/src/components/CollaboratorCursors.jsx`

### 3.1 Create useAwareness primitive (optional)

```js
import { createSignal, onCleanup } from 'solid-js';

export function useAwareness(awareness) {
  const [users, setUsers] = createSignal([]);

  if (!awareness) return { users };

  const updateUsers = () => {
    const states = [];
    awareness.getStates().forEach((state, clientId) => {
      if (clientId !== awareness.clientID && state.user) {
        states.push({ clientId, ...state });
      }
    });
    setUsers(states);
  };

  awareness.on('change', updateUsers);
  onCleanup(() => awareness.off('change', updateUsers));

  return { users };
}
```

### 3.2 Create presence indicator component (optional)

Shows avatars/names of connected users in project header.

### 3.3 Create cursor overlay component (optional)

Shows other users' cursor positions in shared editors.

---

## Phase 4: Testing & Migration

### 4.1 Test locally

- [ ] Backend handles binary protocol correctly
- [ ] Frontend connects and syncs
- [ ] Awareness updates propagate
- [ ] Reconnection works after disconnect
- [ ] Multiple clients see each other's presence

### 4.2 Do NOT Handle backward compatibility

Remove old unused code.

## Estimated Time

| Phase                       | Effort        |
| --------------------------- | ------------- |
| Phase 1: Backend protocol   | 2-3 hours     |
| Phase 2: Frontend provider  | 30-45 min     |
| Phase 3: Awareness features | 1-2 hours     |
| Phase 4: Testing            | 1 hour        |
| **Total**                   | **5-7 hours** |

---

## Dependencies to Add

```bash
# Backend (packages/workers)
pnpm add y-protocols lib0

# Frontend (packages/web)
pnpm add y-websocket
```

---

## Risks & Considerations

1. **Error handling**: y-websocket has different error events than your current implementation. Ensure projectStore updates correctly.

---

## References

- [y-websocket source](https://github.com/yjs/y-websocket)
- [y-protocols sync](https://github.com/yjs/y-protocols/blob/master/sync.js)
- [y-protocols awareness](https://github.com/yjs/y-protocols/blob/master/awareness.js)
- [Yjs docs - Providers](https://docs.yjs.dev/ecosystem/connection-provider)
- Use the corates mcp for yjs docs
