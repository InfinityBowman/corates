# System Architecture

How the frontend, backend, and storage layers connect.

```mermaid
flowchart TB
    subgraph Client["Browser (SolidJS)"]
        UI[UI Components]
        Stores[Stores<br/>projectStore, adminStore]
        YjsClient[Yjs Client]
        IDB[(IndexedDB<br/>y-indexeddb)]
    end

    subgraph CF["Cloudflare Workers"]
        Hono[Hono API]
        Auth[BetterAuth]

        subgraph DurableObjects["Durable Objects"]
            ProjectDoc[ProjectDoc<br/>One per project]
            UserSession[UserSession]
            EmailQueue[EmailQueue]
        end
    end

    subgraph Storage["Cloudflare Storage"]
        D1[(D1<br/>Users, Projects, Members)]
        R2[(R2<br/>PDF Documents)]
    end

    UI --> Stores
    Stores --> YjsClient
    YjsClient <-->|"WebSocket"| ProjectDoc
    YjsClient <--> IDB
    UI -->|"REST API"| Hono
    Hono --> Auth
    Hono --> D1
    Hono --> R2
    ProjectDoc -->|"persist state"| D1
```

## Key Components

### Frontend (SolidJS)

- **UI Components**: Zag.js-based accessible components
- **Stores**: Centralized state management (no prop drilling)
- **Yjs Client**: CRDT sync with local IndexedDB persistence

### Backend (Cloudflare Workers)

- **Hono API**: REST endpoints for CRUD operations
- **BetterAuth**: Authentication and session management
- **Durable Objects**: Stateful real-time collaboration

### Storage

- **D1**: SQLite database for relational data
- **R2**: Object storage for PDF documents
