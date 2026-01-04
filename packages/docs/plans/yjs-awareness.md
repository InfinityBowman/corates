# Yjs awareness plan

## Goal

Add awareness for various parts of the application to use.

## Phase 1: Implement awareness features

### 1. Update `useProject` primitive

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

New files to create:

- `packages/web/src/primitives/useAwareness.js`
- `packages/web/src/components/PresenceIndicator.jsx`
- `packages/web/src/components/CollaboratorCursors.jsx`

### 1.1 Create `useAwareness` primitive

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

### 1.2 Create presence indicator component

Shows avatars/names of connected users in project header.

### 1.3 Create cursor overlay component (optional)

Shows other users' cursor positions in shared editors.

## Phase 2: Testing and migration

### 2.1 Test locally

- [ ] Awareness updates propagate
- [ ] Multiple clients see each other's presence

## References

- [y-websocket source](https://github.com/yjs/y-websocket)
- [y-protocols sync](https://github.com/yjs/y-protocols/blob/master/sync.js)
- [y-protocols awareness](https://github.com/yjs/y-protocols/blob/master/awareness.js)
- [Yjs docs - Providers](https://docs.yjs.dev/ecosystem/connection-provider)
- Use the CoRATES MCP tools for Yjs docs
