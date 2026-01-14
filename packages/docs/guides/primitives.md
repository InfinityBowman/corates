# Primitives Guide

This guide explains the primitives (hooks) pattern in CoRATES, when to create primitives, and how to structure them.

## Overview

Primitives are reusable SolidJS hooks that encapsulate business logic, state management, and side effects. They keep components lean by moving logic out of components into reusable functions.

## What Are Primitives?

Primitives are similar to React hooks - they're functions that:

- Start with `use` (e.g., `useProject`, `useSubscription`)
- Use SolidJS reactive primitives (`createSignal`, `createStore`, `createMemo`, `createEffect`)
- Return reactive values and helper functions
- Can be composed together
- Handle their own cleanup

## When to Create a Primitive

### Create a Primitive When

1. **Logic is reused** - Multiple components need the same logic
2. **Complex state/effects** - Managing connections, subscriptions, or complex state
3. **Business logic** - Domain-specific operations (e.g., project operations, auth)
4. **Side effects** - API calls, WebSocket connections, event listeners

### Use a Component When

1. **UI-only** - Pure rendering with no business logic
2. **Component-specific** - Logic that only applies to one component

### Use a Utility When

1. **Pure functions** - No state or side effects
2. **Stateless operations** - Data transformations, validations

### Use a Store When

1. **Global state** - Shared across many components/features
2. **Persistent state** - Needs to survive navigation

### Decision Tree

```
Is this logic reusable across multiple components?
├─ YES → Does it manage state or side effects?
│   ├─ YES → Create a primitive (hook)
│   └─ NO → Create a utility function
│
└─ NO → Is it business logic or state management?
    ├─ YES → Consider if it should be a store (if global) or primitive (if scoped)
    └─ NO → Keep in component
```

## Primitive Structure

### Basic Primitive Pattern

```js
import { createSignal, createEffect, onCleanup } from 'solid-js';

export function useMyPrimitive(options = {}) {
  // Internal state
  const [value, setValue] = createSignal(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal(null);

  // Side effects
  createEffect(() => {
    // React to changes
    const someValue = options.someProp?.();
    if (someValue) {
      // Do something
    }
  });

  // Cleanup
  onCleanup(() => {
    // Clean up subscriptions, timers, etc.
  });

  // Helper functions
  async function doSomething() {
    setLoading(true);
    try {
      // Perform operation
      setValue(result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  // Return reactive values and helpers
  return {
    value,
    loading,
    error,
    doSomething,
  };
}
```

### Primitive with Store Integration

Primitives often interact with stores:

```js
import projectStore from '@/stores/projectStore.js';
import projectActionsStore from '@/stores/projectActionsStore';

export function useProjectData(projectId) {
  // Read from store reactively
  const project = () => projectStore.getProject(projectId);
  const studies = () => projectStore.getStudies(projectId);
  const connectionState = () => projectStore.getConnectionState(projectId);

  // Helper to check if connected
  const isConnected = () => connectionState().connected;

  return {
    project,
    studies,
    isConnected,
    connectionState,
  };
}
```

## Primitive Examples

### useProject - Complex Connection Management

The `useProject` primitive manages Yjs connections, sync, and project operations using a connection registry pattern and y-dexie for persistence:

```js
import { DexieYProvider } from 'y-dexie';
import { db } from '../db.js';

/**
 * Global connection registry to prevent multiple connections to the same project.
 * Each project ID maps to a connection instance with reference counting.
 */
const connectionRegistry = new Map();

export function useProject(projectId) {
  const isOnline = useOnlineStatus();
  const isLocalProject = () => projectId && projectId.startsWith('local-');

  // Get or create a shared connection for this project
  const connectionEntry = getOrCreateConnection(projectId);

  function connect() {
    const { ydoc } = connectionEntry;

    // Set up Dexie persistence using y-dexie
    db.projects.get(projectId).then(async existingProject => {
      if (!existingProject) {
        await db.projects.put({ id: projectId, updatedAt: Date.now() });
      }

      const project = await db.projects.get(projectId);
      connectionEntry.dexieProvider = DexieYProvider.load(project.ydoc);

      connectionEntry.dexieProvider.whenLoaded.then(() => {
        // Apply persisted state from Dexie
        const persistedState = Y.encodeStateAsUpdate(project.ydoc);
        Y.applyUpdate(ydoc, persistedState);
      });
    });
  }
}
```

This primitive:

- Uses a connection registry with reference counting
- Manages WebSocket connections to Durable Objects
- Handles y-dexie persistence for offline support
- Coordinates sync between Yjs and the store
- Provides operations for studies, checklists, PDFs, reconciliation
- Handles cleanup on disconnect

### useSubscription - Resource-Based Primitive

The `useSubscription` primitive uses `createResource` for async data:

```js
export function useSubscription() {
  const { isLoggedIn } = useBetterAuth();

  // Only fetch subscription when user is logged in
  const [subscription, { refetch, mutate }] = createResource(() => (isLoggedIn() ? getSubscriptionSafe() : null), {
    initialValue: DEFAULT_SUBSCRIPTION,
  });

  const tier = createMemo(() => subscription()?.tier ?? 'free');
  // ... permission helpers
}
```

This primitive:

- Uses `createResource` for async data fetching
- Provides memoized computed values
- Handles loading and error states
- Returns permission helpers

### useProjectData - Lightweight Store Wrapper

The `useProjectData` primitive provides a lightweight way to read project data:

```js
export function useProjectData(projectId, options = {}) {
  const { autoConnect = true } = options;

  // If autoConnect is enabled and we don't have a connection, establish one
  let projectHook = null;
  if (autoConnect) {
    const connectionState = () => projectStore.getConnectionState(projectId);
    const needsConnection = () => !connectionState().connected && !connectionState().connecting;

    if (needsConnection()) {
      projectHook = useProject(projectId);
    }
  }

  // Return reactive getters that read from the store
  return {
    studies: () => projectStore.getStudies(projectId),
    members: () => projectStore.getMembers(projectId),
    meta: () => projectStore.getMeta(projectId),
    connected: () => projectStore.getConnectionState(projectId).connected,
    // ... other helpers
  };
}
```

This primitive:

- Provides reactive getters from the store
- Optionally establishes connections
- Keeps components simple when only reading data

### useOnlineStatus - Simple Signal Primitive

Simple primitives can just wrap browser APIs:

```js
import { createSignal, onMount, onCleanup } from 'solid-js';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = createSignal(typeof navigator !== 'undefined' ? navigator.onLine : true);

  onMount(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    onCleanup(() => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    });
  });

  return isOnline;
}
```

This primitive:

- Wraps browser API in a reactive signal
- Handles event listener cleanup
- Works in SSR contexts (checks for `navigator`)

## Primitive Composition

Primitives can use other primitives:

```js
import useOnlineStatus from '../useOnlineStatus.js';
import projectStore from '@/stores/projectStore.js';

export function useProject(projectId) {
  // Use another primitive
  const isOnline = useOnlineStatus();

  // Use store
  const connectionState = () => projectStore.getConnectionState(projectId);

  // Combine primitives
  const canSync = () => isOnline() && connectionState().connected;

  return {
    isOnline,
    connectionState,
    canSync,
  };
}
```

## Using Primitives in Components

Import and use primitives directly in components:

```js
import { useProjectData } from '@/primitives/useProjectData.js';

function MyComponent(props) {
  // Use the primitive
  const { studies, isConnected } = useProjectData(props.projectId);

  return (
    <div>
      <Show when={isConnected()}>
        <For each={studies()}>{study => <StudyCard study={study} />}</For>
      </Show>
    </div>
  );
}
```

## Primitive Lifecycle

### Initialization

Primitives are called during component render:

```js
function MyComponent() {
  // Primitive is initialized here
  const data = useMyPrimitive();

  // Use the primitive's return values
  return <div>{data.value()}</div>;
}
```

### Cleanup

Use `onCleanup` for cleanup logic:

```js
export function useMyPrimitive() {
  createEffect(() => {
    const interval = setInterval(() => {
      // Do something
    }, 1000);

    onCleanup(() => {
      clearInterval(interval);
    });
  });
}
```

### Multiple Instances

Each component call creates a new primitive instance:

```js
function Component() {
  // These are separate instances
  const project1 = useProject('project-1');
  const project2 = useProject('project-2');

  // Each manages its own state
}
```

## Best Practices

### DO

- Use `use` prefix for primitives
- Return reactive values (signals, memos)
- Handle cleanup with `onCleanup`
- Compose primitives together
- Keep primitives focused on one concern
- Use stores for shared state, primitives for component-scoped state

### DON'T

- Don't call primitives conditionally
- Don't use primitives for pure utilities
- Don't expose raw setters from stores (use action stores)
- Don't create primitives that duplicate store functionality
- Don't forget cleanup for subscriptions/timers

## Testing Primitives

Test primitives by rendering them in a test component:

```js
import { describe, it, expect } from 'vitest';
import { createRoot } from 'solid-js';
import useOnlineStatus from '../useOnlineStatus';

describe('useOnlineStatus', () => {
  it('should return online status', () => {
    let result;
    createRoot(dispose => {
      result = useOnlineStatus();
      dispose();
    });
    expect(result()).toBe(navigator.onLine);
  });
});
```

## Common Patterns

### Pattern: Resource Fetching

```js
import { createResource } from 'solid-js';

export function useData(id) {
  const [data, { refetch }] = createResource(
    () => id(),
    async id => {
      const response = await fetch(`/api/data/${id}`);
      return response.json();
    },
  );

  return {
    data,
    loading: () => data.loading,
    error: () => data.error,
    refetch,
  };
}
```

### Pattern: Store Integration

```js
import myStore from '@/stores/myStore.js';

export function useMyData(id) {
  // Read from store reactively
  const item = () => myStore.getItem(id());

  // Memoized computed value
  const displayName = createMemo(() => {
    const i = item();
    return i ? `${i.name} (${i.status})` : 'Loading...';
  });

  return {
    item,
    displayName,
  };
}
```

### Pattern: Connection Management

```js
export function useConnection(url) {
  const [connected, setConnected] = createSignal(false);
  let ws = null;

  createEffect(() => {
    const urlValue = url();
    if (!urlValue) return;

    ws = new WebSocket(urlValue);
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    onCleanup(() => {
      ws?.close();
      setConnected(false);
    });
  });

  return {
    connected,
    send: data => ws?.send(JSON.stringify(data)),
  };
}
```

## Organization Context Primitives

CoRATES uses organization-scoped routing. Two primitives help manage org and project context from URL params.

### useOrgContext

Resolves the current organization from URL params (`orgSlug`):

```js
import { useOrgContext } from '@primitives/useOrgContext.js';

function MyOrgComponent() {
  const {
    // Data
    orgSlug, // () => string - slug from URL
    currentOrg, // () => org object or null
    orgs, // () => array of user's orgs
    orgId, // () => string - resolved org ID
    orgName, // () => string - org name

    // Guard states
    isLoading, // () => boolean
    isError, // () => boolean
    hasNoOrgs, // () => boolean - user has no orgs
    orgNotFound, // () => boolean - slug doesn't match any org

    // Actions
    refetchOrgs, // () => void
  } = useOrgContext();

  return (
    <Show when={!isLoading() && !orgNotFound()}>
      <div>Current org: {orgName()}</div>
    </Show>
  );
}
```

### useOrgProjectContext

Combines org context with project context for project-level routes:

```js
import { useOrgProjectContext } from '@primitives/useOrgProjectContext.js';

function ProjectComponent() {
  const {
    // From org context
    orgSlug,
    orgId,
    orgName,
    currentOrg,
    isLoadingOrg,
    orgNotFound,
    hasNoOrgs,

    // Project context
    projectId, // () => string from URL
    basePath, // () => string - /orgs/:slug/projects/:id
    projectIdMissing, // () => boolean

    // Combined state
    isReady, // () => boolean - org resolved and project ID exists

    // Path builders
    getStudyPath, // (studyId) => string
    getChecklistPath, // (studyId, checklistId) => string
    getReconcilePath, // (studyId, c1Id, c2Id) => string
  } = useOrgProjectContext();

  return (
    <Show when={isReady()}>
      <a href={getStudyPath('study-123')}>View Study</a>
    </Show>
  );
}
```

### Path Builder Utilities

Build org-scoped URLs outside components:

```js
import { buildOrgProjectPath, buildStudyPath, buildChecklistPath } from '@primitives/useOrgProjectContext.js';

// /orgs/my-lab/projects/proj-123
buildOrgProjectPath('my-lab', 'proj-123');

// /orgs/my-lab/projects/proj-123/studies/study-456
buildStudyPath('my-lab', 'proj-123', 'study-456');
```

See the [Organizations Guide](/guides/organizations) for the complete org model.

## Related Guides

- [Organizations Guide](/guides/organizations) - For org model and routing patterns
- [State Management Guide](/guides/state-management) - For understanding stores vs primitives
- [Component Development Guide](/guides/components) - For using primitives in components
- [Yjs Sync Guide](/guides/yjs-sync) - For understanding `useProject` primitive
