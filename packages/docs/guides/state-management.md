# State Management Guide

This guide explains how state management works in CoRATES, covering the store architecture pattern, when to use stores vs props, and implementation patterns.

## Overview

CoRATES uses a centralized store architecture built on SolidJS's `createStore` for managing application state. The pattern separates **read operations** (data stores) from **write operations** (action stores), providing clear boundaries and eliminating prop drilling.

## Store Architecture Pattern

### Read Stores vs Action Stores

The codebase uses a separation pattern:

- **Read Stores** (`*Store.js`) - Hold cached data and provide getters/selectors
- **Action Stores** (`*ActionsStore.js`) - Manage write operations and mutations

```js
// Read from store
import projectStore from '@/stores/projectStore.js';
const projects = () => projectStore.getProjectList();

// Write via actions store
import projectActionsStore from '@/stores/projectActionsStore';
projectActionsStore.createProject({ name: 'New Project' });
```

### Key Benefits

- **No prop drilling** - Components import stores directly
- **Single source of truth** - Data lives in one place
- **Clear separation** - Reads vs writes are explicit
- **Reactive updates** - SolidJS store updates trigger UI re-renders
- **Offline support** - Stores handle caching and persistence

## When to Use Stores

### Use Stores For

1. **Shared/cross-feature state** - Data used across multiple components/features
2. **Persistent data** - Data that should survive navigation
3. **Cached API data** - Data fetched from APIs that should be cached
4. **Connection state** - WebSocket/Yjs connection status
5. **User session** - Authentication state and user data

### Use Props For

1. **Local component configuration** - Settings specific to one component
2. **Parent-child communication** - Data passed directly from parent
3. **UI state only** - Modal open/close, form field values (unless shared)

### Use Context For

1. **Feature-scoped state** - State that only matters within a feature tree
2. **Avoid if possible** - Prefer stores for shared state

### Decision Tree

```
Is this state shared across multiple components/features?
├─ YES → Use a store
│   └─ Does it need write operations?
│       ├─ YES → Create both *Store.js and *ActionsStore.js
│       └─ NO → Create just *Store.js
│
└─ NO → Is it configuration for a single component?
    ├─ YES → Use props
    └─ NO → Use createSignal or createStore (local state)
```

## Store Implementation Patterns

### Creating a Read Store

Read stores use SolidJS `createStore` for reactive state management:

```js
import { createStore, produce } from 'solid-js/store';

function createMyStore() {
  const [store, setStore] = createStore({
    items: [],
    loading: false,
    error: null,
  });

  // Getters
  function getItems() {
    return store.items;
  }

  function getItem(id) {
    return store.items.find(item => item.id === id);
  }

  // Setters (internal use only, prefer action stores for mutations)
  function setItems(items) {
    setStore('items', items);
  }

  // Complex updates using produce
  function updateItem(id, updates) {
    setStore(
      produce(s => {
        const item = s.items.find(item => item.id === id);
        if (item) {
          Object.assign(item, updates);
        }
      })
    );
  }

  return {
    store, // Expose raw store for reactive access
    getItems,
    getItem,
    setItems,
    updateItem,
  };
}

// Create singleton
const myStore = createMyStore();
export default myStore;
```

### Creating an Action Store

Action stores manage write operations and coordinate with read stores:

```js
import myStore from '@/stores/myStore.js';
import { handleFetchError } from '@/lib/error-utils.js';
import { showToast } from '@corates/ui';
import { API_BASE } from '@config/api.js';

function createMyActionsStore() {
  async function createItem(data) {
    try {
      const response = await handleFetchError(
        fetch(`${API_BASE}/api/items`, {
          method: 'POST',
          body: JSON.stringify(data),
          credentials: 'include',
        }),
        { showToast: true }
      );

      const newItem = await response.json();

      // Update read store
      const currentItems = myStore.getItems();
      myStore.setItems([...currentItems, newItem]);

      showToast.success('Item created');
      return newItem;
    } catch (error) {
      // Error already handled by handleFetchError
      throw error;
    }
  }

  async function updateItem(id, updates) {
    try {
      const response = await handleFetchError(
        fetch(`${API_BASE}/api/items/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(updates),
          credentials: 'include',
        }),
        { showToast: true }
      );

      const updatedItem = await response.json();

      // Update read store
      myStore.updateItem(id, updatedItem);

      showToast.success('Item updated');
      return updatedItem;
    } catch (error) {
      throw error;
    }
  }

  return {
    createItem,
    updateItem,
  };
}

const myActionsStore = createMyActionsStore();
export default myActionsStore;
```

### Store with localStorage Caching

Stores can cache data in localStorage for offline support:

```88:97:packages/web/src/stores/projectStore.js
  const [store, setStore] = createStore({
    // Cached project data by projectId (Y.js data: studies, members, meta)
    projects: {},
    // Currently active project
    activeProjectId: null,
    // Connection states by projectId
    connections: {},
    // Project list from API (for dashboard)
    projectList: initialProjectList,
  });
```

Example caching pattern:

```26:49:packages/web/src/stores/projectStore.js
  function loadCachedProjectList() {
    if (typeof window === 'undefined') return null;
    try {
      const cached = localStorage.getItem(PROJECT_LIST_CACHE_KEY);
      const timestamp = localStorage.getItem(PROJECT_LIST_CACHE_TIMESTAMP_KEY);
      const cachedUserId = localStorage.getItem(PROJECT_LIST_CACHE_USER_ID_KEY);
      if (!cached || !timestamp) return null;

      const age = Date.now() - parseInt(timestamp, 10);
      if (age > PROJECT_LIST_CACHE_MAX_AGE) {
        // Cache expired, clear it
        localStorage.removeItem(PROJECT_LIST_CACHE_KEY);
        localStorage.removeItem(PROJECT_LIST_CACHE_TIMESTAMP_KEY);
        localStorage.removeItem(PROJECT_LIST_CACHE_USER_ID_KEY);
        return null;
      }

      return { projects: JSON.parse(cached), userId: cachedUserId };
    } catch (err) {
      console.error('Error loading cached project list:', err);
      return null;
    }
  }
```

## Using Stores in Components

### Reading from Stores

Import the store directly and use getters:

```js
import projectStore from '@/stores/projectStore.js';

function MyComponent() {
  // Reactive getter - updates when store changes
  const projects = () => projectStore.getProjectList();

  // Direct access to store (if needed)
  const activeProjectId = () => projectStore.store.activeProjectId;

  return (
    <div>
      <For each={projects()}>
        {project => <ProjectCard project={project} />}
      </For>
    </div>
  );
}
```

### Writing via Action Stores

Import the action store and call mutation methods:

```js
import projectActionsStore from '@/stores/projectActionsStore';

function CreateProjectForm() {
  async function handleSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);

    await projectActionsStore.createProject({
      name: formData.get('name'),
      description: formData.get('description'),
    });
    // Store updates automatically, UI re-renders
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
    </form>
  );
}
```

### Never Prop-Drill Store Data

```js
// WRONG - prop drilling
function App() {
  const projects = () => projectStore.getProjectList();
  return <ProjectList projects={projects()} />;
}

function ProjectList({ projects }) {
  return <ProjectDashboard projects={projects} />;
}

// CORRECT - import store directly
function ProjectList() {
  const projects = () => projectStore.getProjectList();
  return <ProjectDashboard />;
}

function ProjectDashboard() {
  // Import store directly, no props needed
  const projects = () => projectStore.getProjectList();
  // ...
}
```

## Store Examples

### Project Store

The project store manages project data, connection states, and caching:

```99:112:packages/web/src/stores/projectStore.js
  function getProject(projectId) {
    return store.projects[projectId];
  }

  /**
   * Get active project data
   */
  function getActiveProject() {
    if (!store.activeProjectId) return null;
    return store.projects[store.activeProjectId] || null;
  }

  /**
   * Set the active project
   */
  function setActiveProject(projectId) {
    setStore('activeProjectId', projectId);
  }
```

### Project Actions Store

The actions store manages all write operations:

```26:67:packages/web/src/stores/projectActionsStore/index.js
function createProjectActionsStore() {
  /**
   * Map of projectId -> Y.js connection operations
   * Set by useProject hook when connecting
   * @type {Map<string, Object>}
   */
  const connections = new Map();

  /**
   * The currently active project ID.
   * Set by ProjectView when a project is opened.
   * Most methods use this automatically so components don't need to pass it.
   */
  let activeProjectId = null;

  // ============================================================================
  // Internal: Active Project & User Access
  // ============================================================================

  /**
   * Set the active project (called by ProjectView on mount)
   */
  function _setActiveProject(projectId) {
    activeProjectId = projectId;
  }

  /**
   * Clear the active project (called by ProjectView on unmount)
   */
  function _clearActiveProject() {
    activeProjectId = null;
  }

  /**
   * Get the active project ID, throws if none set
   */
  function getActiveProjectId() {
    if (!activeProjectId) {
      throw new Error('No active project - are you inside a ProjectView?');
    }
    return activeProjectId;
  }

  /**
   * Get active project ID or null (for components that just need to check)
   */
  function getActiveProjectIdOrNull() {
    return activeProjectId;
  }

  /**
   * Get current user ID from auth store
   */
  function getCurrentUserId() {
    const auth = useBetterAuth();
    return auth.user()?.id || null;
  }
```

### Better Auth Store

The auth store wraps Better Auth with caching and offline support:

```18:65:packages/web/src/api/better-auth-store.js
function createBetterAuthStore() {
  // Track online status without reactive primitives (for singleton context)
  const [isOnline, setIsOnline] = createSignal(navigator.onLine);

  // Listen for online/offline events
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => setIsOnline(true));
    window.addEventListener('offline', () => setIsOnline(false));
  }

  function loadCachedAuth() {
    if (typeof window === 'undefined') return null;
    try {
      const cached = localStorage.getItem(AUTH_CACHE_KEY);
      const timestamp = localStorage.getItem(AUTH_CACHE_TIMESTAMP_KEY);
      if (!cached || !timestamp) return null;

      const age = Date.now() - parseInt(timestamp, 10);
      if (age > AUTH_CACHE_MAX_AGE) {
        localStorage.removeItem(AUTH_CACHE_KEY);
        localStorage.removeItem(AUTH_CACHE_TIMESTAMP_KEY);
        return null;
      }

      return JSON.parse(cached);
    } catch (err) {
      console.error('Error loading cached auth:', err);
      return null;
    }
  }

  // Save auth data to localStorage
  function saveCachedAuth(userData) {
    if (typeof window === 'undefined') return;
    try {
      if (userData) {
        localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(userData));
        localStorage.setItem(AUTH_CACHE_TIMESTAMP_KEY, Date.now().toString());
      } else {
        localStorage.removeItem(AUTH_CACHE_KEY);
        localStorage.removeItem(AUTH_CACHE_TIMESTAMP_KEY);
      }
    } catch (err) {
      console.error('Error saving cached auth:', err);
    }
  }
```

## Store Lifecycle and Cleanup

### Initialization

Stores are singletons created at module load time:

```604:607:packages/web/src/stores/projectStore.js
// Create singleton store without createRoot
// createStore doesn't need a reactive owner/root context
const projectStore = createProjectStore();

export default projectStore;
```

### Cache Validation

Stores should validate cached data when appropriate:

```498:534:packages/web/src/stores/projectStore.js
  function validateProjectListCache(currentUserId) {
    if (!currentUserId) {
      // No user ID, clear the cache
      setStore('projectList', {
        items: [],
        loaded: false,
        loading: false,
        error: null,
        cachedUserId: null,
      });
      // Clear localStorage cache
      localStorage.removeItem(PROJECT_LIST_CACHE_KEY);
      localStorage.removeItem(PROJECT_LIST_CACHE_TIMESTAMP_KEY);
      localStorage.removeItem(PROJECT_LIST_CACHE_USER_ID_KEY);
      return;
    }

    const cachedUserId = store.projectList.cachedUserId;

    // If cached user ID doesn't match current user, clear the cache
    if (cachedUserId && cachedUserId !== currentUserId) {
      console.log(
        '[projectStore] Cached project list belongs to different user, clearing cache',
      );
      setStore('projectList', {
        items: [],
        loaded: false,
        loading: false,
        error: null,
        cachedUserId: null,
      });
      // Clear localStorage cache
      localStorage.removeItem(PROJECT_LIST_CACHE_KEY);
      localStorage.removeItem(PROJECT_LIST_CACHE_TIMESTAMP_KEY);
      localStorage.removeItem(PROJECT_LIST_CACHE_USER_ID_KEY);
    }
  }
```

## Best Practices

### DO

- Separate read stores from action stores
- Use `produce` for complex nested updates
- Cache data in localStorage for offline support
- Validate cached data (expiry, user matching, etc.)
- Use getters/selectors instead of exposing raw store
- Import stores directly in components (no prop drilling)

### DON'T

- Don't prop-drill store data
- Don't mutate store directly (use setters or action stores)
- Don't expose raw `setStore` from read stores
- Don't create stores for local component state
- Don't forget to handle cache invalidation

## Related Guides

- [Primitives Guide](/guides/primitives) - For store-like patterns that are component-scoped
- [Component Development Guide](/guides/components) - For component state patterns
- [Yjs Sync Guide](/guides/yjs-sync) - For understanding how Yjs updates stores
