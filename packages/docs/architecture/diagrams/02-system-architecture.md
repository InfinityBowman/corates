# System Architecture

How the frontend, backend, and storage layers connect.

```mermaid
flowchart TB
    subgraph Client["Browser (React 19)"]
        UI[shadcn/ui Components]
        Stores[Zustand Stores<br/>authStore, projectStore, adminStore]
        Query[TanStack Query Cache]
        SyncClient[cf-sync Client<br/>ConnectionPool]
        IDB[(IndexedDB<br/>cf-sync caches + app caches)]
    end

    subgraph MainWorker["App Worker (TanStack Start)"]
        Routes[File-based API Routes<br/>/api/*]
        Auth[Better Auth]

        subgraph DurableObjects["Durable Objects"]
            WorkspaceDO[WorkspaceDO<br/>One per project<br/>Row sync & content]
            UserSession[UserSession<br/>One per user<br/>Notifications]
        end
        EmailQueue[Cloudflare Queue<br/>Email delivery]
    end

    subgraph StripeWorker["Stripe Purchases Worker (Hono)"]
        StripeWebhook[POST /api/billing/purchases/webhook]
    end

    subgraph Storage["Cloudflare Storage"]
        D1[(D1<br/>Users, Orgs, Projects<br/>& Access Control)]
        R2[(R2<br/>PDF Documents)]
    end

    UI --> Stores
    UI --> Query
    Stores --> SyncClient
    SyncClient <-->|"WebSocket<br/>/api/sync/:projectId"| WorkspaceDO
    SyncClient <--> IDB
    UI <-->|"WebSocket<br/>Notifications"| UserSession
    Query -->|"REST"| Routes
    Routes --> Auth
    Routes --> D1
    Routes --> R2
    Routes -->|"send notification"| UserSession
    StripeWebhook -->|"verifies + writes"| D1
    WorkspaceDO -->|"authorize on connect<br/>reads D1 membership"| D1
```

## Key Components

### Frontend (React 19)

- **UI**: shadcn/ui primitives colocated under `@/components/ui/`, styled with Tailwind v4
- **Routing**: TanStack Router file-based routes under `packages/web/src/routes/`
- **Client state**: Zustand stores in `@/stores/` (authStore, projectStore, adminStore, pdfPreviewStore)
- **Server state**: TanStack Query, with hooks in `@/hooks/`
- **Sync client**: `ConnectionPool` (`packages/web/src/project/`) owns ref-counted engine sessions per project; rows are cached in per-project `cf-sync:<projectId>` IndexedDB databases alongside the app's Dexie caches
- **Notification WebSocket**: Real-time connection to UserSession for user-level notifications (project invites, etc.)

### Backend (Cloudflare Workers)

Two Workers are deployed:

- **App Worker (`packages/web`)**: TanStack Start -- serves the SPA and all `/api/*` routes. Shared backend logic lives in `@corates/workers` (imported as a library).
- **Stripe Purchases Worker (`packages/stripe-purchases`)**: Hono-based, isolated for deploy-cadence. Receives Stripe webhooks, verifies signatures, writes to the same D1 database.

Both Workers share:

- **Better Auth**: Authentication and session management (in the main app Worker; the Stripe worker does not authenticate user sessions)
- **Durable Objects**:
  - **WorkspaceDO**: One per project, holds the authoritative sync-engine rows for real-time collaboration and content storage
  - **UserSession**: One per user, manages WebSocket connections for real-time notifications (e.g., project invites)
- **Cloudflare Queue**: Async email delivery with retries and dead letter queue, consumed by Postmark

### Storage

- **D1**: SQLite database for users, project metadata (id, name, description), and access control (project_members table). Source of truth for authorization.
- **Durable Objects**:
  - **WorkspaceDO**: Persistent DO storage for the row collections containing all project content (studies, checklists, answers). One workspace per project; membership and project metadata stay in D1.
  - **UserSession**: Stores pending notifications when users are offline, manages WebSocket connections for real-time delivery. One UserSession per user.
- **R2**: Object storage for PDF documents

### UserSession Notification Flow

The `UserSession` Durable Object is the per-user push channel. Two kinds of message travel over it, both typed by the `UserSessionEvent` union in `@corates/shared/notifications` so server and client cannot drift:

- **Events** are ephemeral cache-invalidation signals (membership changes, subscription updates, project deletion). They are not persisted anywhere except the DO's short pending queue.
- **Notifications** are D1 rows in the `notifications` table addressed to one user (for example "your invitation was accepted"). Creating one goes through `createNotification` in `@corates/workers/commands/notifications`, which inserts the row, trims the user to their newest 200, and then pushes a `notification:new` event carrying the row.

Delivery:

1. **When an action commits**, the command sends the event to that user's UserSession DO via the `notifyUser` helpers
2. **If the user is connected** via WebSocket, the message is delivered immediately
3. **If the user is offline**, the DO stores the message as "pending" and flushes it on the next connect
4. **Frontend connects** to `/api/sessions/:userId` via WebSocket; `useMembershipSync` invalidates TanStack Query caches for events and prepends `notification:new` rows into the notification queries
5. **On every (re)connect** the client refetches the notification list and unread count from D1, which is the source of truth, so the pending queue is only a fast path for notifications

The navbar bell reads and marks notifications through the server functions in `notifications.functions.ts`; rows store a `type` plus a JSON `data` payload and the client renders the copy.

This is separate from the sync-engine WebSockets (`/api/sync/:projectId`), which handle collaborative editing of project content.
