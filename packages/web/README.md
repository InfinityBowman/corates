# @corates/web

**Frontend SPA for CoRATES** - SolidJS application with offline-first architecture, real-time collaboration, and multi-tenant access control.

## Purpose

This package implements the entire frontend user interface for CoRATES, including:

- **Offline-first data layer** with IndexedDB and TanStack Query
- **Real-time collaboration** via Yjs CRDT and WebSocket sync
- **Multi-tenant UI** for organizations, projects, studies, and checklists
- **PDF annotation** using EmbedPDF for systematic review workflows
- **Authentication** via Better Auth with social providers
- **Billing management** with Stripe integration
- **Admin dashboard** for platform management

## Tech Stack

- **Framework:** SolidJS 1.9+ (reactive, fine-grained updates)
- **Routing:** @solidjs/router 0.15+
- **State Management:** TanStack Query (server state), Yjs (CRDT), Signals (local state)
- **Offline Storage:** IndexedDB (5 separate databases)
- **Real-time Sync:** y-websocket + y-indexeddb
- **Styling:** Tailwind CSS 4.1+
- **PDF Viewer:** EmbedPDF 2.1+ with annotation support
- **Auth:** Better Auth 1.4+ (client SDK)
- **Build Tool:** Vite 7.3+

## Key Entry Points

| File                                                                             | Purpose                                                |
| -------------------------------------------------------------------------------- | ------------------------------------------------------ |
| [src/main.jsx](src/main.jsx)                                                     | App initialization, QueryClient setup, bfcache handler |
| [src/Routes.jsx](src/Routes.jsx)                                                 | All route definitions (auth, protected, admin)         |
| [src/Layout.jsx](src/Layout.jsx)                                                 | Main layout with sidebar and navbar                    |
| [src/api/better-auth-store.js](src/api/better-auth-store.js)                     | ⚠️ Auth state management (HIGH BLAST RADIUS)           |
| [src/lib/queryClient.js](src/lib/queryClient.js)                                 | TanStack Query configuration with offline support      |
| [src/lib/queryKeys.js](src/lib/queryKeys.js)                                     | Centralized query key factory                          |
| [src/primitives/useProject.js](src/primitives/useProject.js)                     | Project Yjs document sync hook                         |
| [src/components/project/ProjectView.jsx](src/components/project/ProjectView.jsx) | Main project view with tabs                            |

## Key Exports

This package is a SPA that gets bundled and doesn't export modules. Instead, it provides UI components organized by domain:

### Component Structure

```
src/
├── components/
│   ├── auth/           # SignIn, SignUp, ProtectedGuard
│   ├── project/        # ProjectView, tabs (studies, team, settings)
│   ├── checklist/      # ChecklistYjsWrapper, LocalChecklistView
│   ├── billing/        # BillingPage, BillingPlansPage
│   ├── admin/          # AdminDashboard, OrgList, DatabaseViewer
│   └── profile/        # ProfilePage, SettingsPage
├── primitives/         # Hooks (useProject, useOnlineStatus, useNotifications)
├── api/                # API client, better-auth-store
├── lib/                # Utilities (queryClient, queryKeys, yjsUtils)
└── config/             # Configuration (API_BASE, feature flags)
```

## Development

```bash
# Install dependencies
pnpm install

# Run development server (Vite)
pnpm dev

# Build for production (outputs to dist/, copies to landing package)
pnpm build

# Run tests
pnpm test

# Run tests with UI
pnpm test:ui

# Analyze bundle size
pnpm analyze
```

## Configuration

### Environment Variables

Required environment variables (see `.env.example`):

```bash
VITE_API_BASE           # API URL (e.g., https://api.corates.com)
VITE_BASEPATH           # Base path for router (e.g., /app)
VITE_GOOGLE_CLIENT_ID   # OAuth client ID (public)
```

### IndexedDB Databases

The app uses 5 separate IndexedDB databases:

1. **`corates-query-cache`** - TanStack Query offline cache (projects, orgs, subscriptions)
2. **`corates-auth-cache`** - Better Auth session and avatar cache
3. **`corates-pdf-cache`** - PDF file cache for offline access
4. **`corates-form-state`** - Form state persistence (auto-save)
5. **`y-indexeddb-${projectId}`** - Per-project Yjs document storage

## Architecture

### Offline-First Strategy

```
Online Mode:
  User Action → Query/Mutation → API → Success → Update Cache → UI Update

Offline Mode:
  User Action → IndexedDB → Optimistic UI Update → Queue for Sync

Reconnection:
  Online Event → Verify Connectivity → Retry Failed Mutations → Refetch Queries
```

### Real-Time Collaboration

Projects use Yjs CRDT for conflict-free real-time collaboration:

```javascript
// useProject hook manages WebSocket connection and Yjs document
const { ydoc, provider, awareness } = useProject(projectId);

// All edits are automatically synced via WebSocket to Durable Object
// Conflicts are resolved automatically using Yjs CRDT algorithm
```

**Important:** Currently connects to WebSocket for ALL projects on load (identified in offline audit as potential issue). Recommended to only connect active project + notifications.

### Authentication Flow

```
Sign In → Better Auth → Session Token (httpOnly cookie) + LocalStorage Cache
       ↓
  Auth Store (better-auth-store.js)
       ↓
  ProtectedGuard (route wrapper)
       ↓
  Authorized Components
```

**Offline Auth:** 7-day LocalStorage cache allows auth checks without network.

## Testing

```bash
# Run all tests
pnpm test

# Run with UI (Vitest UI on port 51234)
pnpm test:ui

# Run specific test file
pnpm test useProject
```

Test files are colocated with source in `__tests__/` directories.

### Testing Patterns

- **Component tests:** SolidJS Testing Library (e.g., `Dashboard.test.jsx`)
- **Hook tests:** Custom test harness with createRoot (e.g., `useProject.test.js`)
- **Utility tests:** Pure function tests (e.g., `queryKeys.test.js`)

## Important Patterns

### API Calls

Always use the centralized query key factory:

```javascript
import { queryKeys } from '@lib/queryKeys.js';
import { apiClient } from '@api/client.js';

const projectsQuery = createQuery(() => ({
  queryKey: queryKeys.projects.all,
  queryFn: () => apiClient.get('/api/users/me/projects'),
  staleTime: 1000 * 60 * 5, // 5 minutes
}));
```

### Form State Persistence

Forms automatically save to IndexedDB for recovery:

```javascript
import { useFormStatePersistence } from '@lib/formStatePersistence.js';

const { savedState, saveState, clearState } = useFormStatePersistence('create-project');

// Auto-saves every 2 seconds while user types
createEffect(() => {
  const timer = setTimeout(() => saveState(formData()), 2000);
  onCleanup(() => clearTimeout(timer));
});
```

### Error Handling

Always use domain errors from `@corates/shared`:

```javascript
import { handleApiError } from '@lib/error-utils.js';

try {
  const result = await apiClient.post('/api/projects', body);
} catch (error) {
  const domainError = handleApiError(error);
  // domainError has: { code, message, details, statusCode }
  toast.error(domainError.message);
}
```

### Yjs Document Access

```javascript
import { useProject } from '@primitives/useProject.js';

const { ydoc, provider, awareness, connected } = useProject(() => projectId);

// Access shared types
const studies = ydoc.getArray('studies');
const metadata = ydoc.getMap('metadata');

// Make changes (automatically synced)
ydoc.transact(() => {
  studies.push([{ id: uuid(), title: 'New Study' }]);
});
```

## Links

- **Backend API:** [packages/workers/](../workers/)
- **Shared Package:** [packages/shared/](../shared/)
- **UI Components:** [packages/ui/](../ui/)
- **Documentation:** [packages/docs/](../docs/)
- **Cursor Rules:** [.cursor/rules/](.cursor/rules/)
- **Offline/Local-First Audit:** [packages/docs/audits/offline-local-first-audit-2026-01.md](../docs/audits/offline-local-first-audit-2026-01.md)

## Safety Notes

⚠️ **High Blast Radius Files** - Extra caution required:

- [src/api/better-auth-store.js](src/api/better-auth-store.js) - All authentication state (793 lines)
- [src/lib/queryClient.js](src/lib/queryClient.js) - All offline query persistence
- [src/primitives/useProject.js](src/primitives/useProject.js) - All real-time collaboration
- [src/lib/queryKeys.js](src/lib/queryKeys.js) - Cache invalidation depends on consistency

Read the file header warnings before modifying these files.

## Known Issues

From [offline-local-first-audit-2026-01.md](../docs/audits/offline-local-first-audit-2026-01.md):

1. **Service Worker Disabled** - Currently commented out, prevents offline UI access
2. **Excessive WebSocket Connections** - May connect to all projects instead of just active + notifications
3. **No Stale Data Indicators** - Users can't tell when viewing cached data vs fresh data

See the audit for detailed recommendations and solutions.
