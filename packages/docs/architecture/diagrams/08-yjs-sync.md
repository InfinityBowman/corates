```mermaid
flowchart TB
    subgraph Client["Client (Local-First)"]
        UI[UI Components]
        SyncClient[cf-sync client<br/>Row Collections]
        IDB[(cf-sync IndexedDB<br/>+ Dexie app caches)]
        Cache[PDF Cache]
    end

    subgraph Server["Server (Authoritative)"]
        DO[ProjectSyncDO<br/>Row State]
        D1[(D1<br/>Metadata & Membership)]
        R2[(R2<br/>PDFs)]
    end

    SyncClient <-->|"Local First"| IDB
    SyncClient <-->|"WebSocket Sync<br/>named mutators"| DO
    UI -->|"Read/Write"| SyncClient
    Cache -->|"Cache"| IDB
    DO -->|"Authorize on connect"| D1
```
