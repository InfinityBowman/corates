# Real-Time Sync Flow (CRDT)

How local-first sync works with Yjs CRDTs.

```mermaid
sequenceDiagram
    participant Client1 as Client A
    participant IDB as IndexedDB
    participant DO as ProjectDoc (Durable Object)
    participant Client2 as Client B

    Note over Client1,Client2: Local-First Architecture

    Client1->>IDB: Save change locally
    Client1->>DO: WebSocket: sync update
    DO->>DO: Merge Yjs CRDT
    DO->>Client2: Broadcast update
    Client2->>IDB: Persist merged state

    Note over Client1,IDB: Offline scenario
    Client1->>IDB: Save changes offline
    Client1--xDO: Connection lost
    Note over Client1: Continue working...
    Client1->>DO: Reconnect + sync
    DO->>DO: Auto-merge (conflict-free)
    DO->>Client1: Sync complete
```

## How It Works

### Local-First Principles

1. **All changes are local first** - Data saves to IndexedDB immediately
2. **Background sync** - Changes push to server when connected
3. **Conflict-free** - Yjs CRDTs automatically merge concurrent edits

### Offline Support

- Users can continue working without internet
- Changes queue locally in IndexedDB
- On reconnect, all changes sync and merge automatically

### Durable Objects

- One `ProjectDoc` per project holds the authoritative Yjs document
- WebSocket connections enable real-time collaboration
- State persists across worker restarts
