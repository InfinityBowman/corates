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
            ProjectDoc[ProjectDoc<br/>One per project<br/>Yjs sync & content]
            EmailQueue[EmailQueue]
            UserSession[UserSession<br/>One per user<br/>Notifications]
        end
    end

    subgraph Storage["Cloudflare Storage"]
        D1[(D1<br/>Users, Project Metadata<br/>& Access Control)]
        R2[(R2<br/>PDF Documents)]
    end

    UI --> Stores
    Stores --> YjsClient
    YjsClient <-->|"WebSocket<br/>Yjs sync"| ProjectDoc
    YjsClient <--> IDB
    UI <-->|"WebSocket<br/>Notifications"| UserSession
    UI -->|"REST API"| Hono
    Hono --> Auth
    Hono --> D1
    Hono --> R2
    Hono -->|"send notification"| UserSession
    ProjectDoc -->|"reads access control"| D1
```

## Key Components

### Frontend (SolidJS)

- **UI Components**: Ark UI-based accessible components
- **Stores**: Centralized state management (no prop drilling)
- **Yjs Client**: CRDT sync with local IndexedDB persistence for project content
- **Notification WebSocket**: Real-time connection to UserSession for user-level notifications (project invites, etc.)

### Backend (Cloudflare Workers)

- **Hono API**: REST endpoints for CRUD operations
- **BetterAuth**: Authentication and session management
- **Durable Objects**:
  - **ProjectDoc**: One per project, holds Yjs document for real-time collaboration and content storage
  - **UserSession**: One per user, manages WebSocket connections for real-time notifications (e.g., project invites)
  - **EmailQueue**: Background email processing

### Storage

- **D1**: SQLite database for users, project metadata (id, name, description), and access control (project_members table). Source of truth for authorization.
- **Durable Objects**:
  - **ProjectDoc**: Persistent storage for Yjs documents containing all project content (studies, checklists, answers) and synced metadata. One ProjectDoc per project.
  - **UserSession**: Stores pending notifications when users are offline, manages WebSocket connections for real-time delivery. One UserSession per user.
- **R2**: Object storage for PDF documents

### UserSession Notification Flow

The `UserSession` Durable Object enables real-time, user-level notifications:

1. **When events occur** (e.g., user added to project), the Hono API sends a notification to that user's UserSession DO
2. **If the user is connected** via WebSocket, the notification is immediately delivered
3. **If the user is offline**, the notification is stored as "pending" and delivered when they reconnect
4. **Frontend connects** to `/api/sessions/:userId` via WebSocket to receive notifications in real-time

This is separate from ProjectDoc WebSockets, which handle collaborative editing of project content. UserSession handles user-level events like project invitations, membership changes, etc.
