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

The `useProject` primitive manages Yjs connections, sync, and project operations:

```149:160:packages/web/src/primitives/useProject/index.js
export function useProject(projectId) {
  const isOnline = useOnlineStatus();

  // Get or create a shared connection for this project
  const connection = getOrCreateConnection(projectId);

  // Initialize connection if not already initialized
  if (!connection.initialized) {
    connection.initialized = true;

    // Set up IndexedDB persistence
    connection.indexeddbProvider = new IndexeddbPersistence(
      `${INDEXEDDB_PREFIX}${projectId}`,
      connection.ydoc,
    );
```

This primitive:

- Manages WebSocket connections
- Handles IndexedDB persistence
- Coordinates sync between Yjs and the store
- Provides operations for studies, checklists, PDFs
- Handles cleanup on disconnect

### useSubscription - Resource-Based Primitive

The `useSubscription` primitive uses `createResource` for async data:

```55:75:packages/web/src/primitives/useSubscription.js
export function useSubscription() {
  const { isLoggedIn } = useBetterAuth();

  // Only fetch subscription when user is logged in
  // This prevents errors during signout when component is still mounted
  const [subscription, { refetch, mutate }] = createResource(
    () => (isLoggedIn() ? getSubscriptionSafe() : null),
    {
      initialValue: DEFAULT_SUBSCRIPTION,
    },
  );

  /**
   * Current subscription tier
   */
  const tier = createMemo(() => subscription()?.tier ?? 'free');

  /**
   * Whether the subscription is active
   */
```

This primitive:

- Uses `createResource` for async data fetching
- Provides memoized computed values
- Handles loading and error states
- Returns permission helpers

### useProjectData - Lightweight Store Wrapper

The `useProjectData` primitive provides a lightweight way to read project data:

```22:60:packages/web/src/primitives/useProjectData.js
export function useProjectData(projectId, options = {}) {
  const { autoConnect = true } = options;

  // If autoConnect is enabled and we don't have a connection, establish one
  // This ensures the store gets populated
  let projectHook = null;
  if (autoConnect) {
    // Only create connection if we need one
    const connectionState = () => projectStore.getConnectionState(projectId);
    const needsConnection = () => !connectionState().connected && !connectionState().connecting;

    if (needsConnection()) {
      projectHook = useProject(projectId);
    }
  }

  // Return reactive getters that read from the store
  return {
    // Data getters (reactive)
    studies: () => projectStore.getStudies(projectId),
    members: () => projectStore.getMembers(projectId),
    meta: () => projectStore.getMeta(projectId),

    // Connection state (reactive)
    connected: () => projectStore.getConnectionState(projectId).connected,
    connecting: () => projectStore.getConnectionState(projectId).connecting,
    synced: () => projectStore.getConnectionState(projectId).synced,
    error: () => projectStore.getConnectionState(projectId).error,

    // Helpers
    hasData: () => projectStore.hasProject(projectId),
    getStudy: studyId => projectStore.getStudy(projectId, studyId),
    getChecklist: (studyId, checklistId) =>
      projectStore.getChecklist(projectId, studyId, checklistId),

    // If we created a connection, expose disconnect
    disconnect: projectHook?.disconnect,
  };
}
```

This primitive:

- Provides reactive getters from the store
- Optionally establishes connections
- Keeps components simple when only reading data

### useOnlineStatus - Simple Signal Primitive

Simple primitives can just wrap browser APIs:

```1:30:packages/web/src/primitives/useOnlineStatus.js
import { createSignal, onMount, onCleanup } from 'solid-js';

/**
 * Hook to track online/offline status
 * Returns a reactive signal that updates when network status changes
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = createSignal(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

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

export default useOnlineStatus;
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

## Related Guides

- [State Management Guide](/guides/state-management) - For understanding stores vs primitives
- [Component Development Guide](/guides/components) - For using primitives in components
- [Yjs Sync Guide](/guides/yjs-sync) - For understanding `useProject` primitive
