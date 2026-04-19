# State Management Guide

CoRATES uses [Zustand](https://github.com/pmndrs/zustand) for client state. Stores live in `packages/web/src/stores/` and are imported directly by components (no prop drilling) and by non-component code (Yjs callbacks, API interceptors, etc.).

## When to use a store

Use a Zustand store for:

- Shared state across multiple components or routes
- State that needs to be read or written from outside React (Yjs callbacks, `queryClient` interceptors, `authFetch` helpers)
- Cached API data that should survive navigation
- Local persistence via `localStorage` + cross-tab sync

Use local React state (`useState`, `useReducer`) for:

- UI state scoped to a single component (open/close, form drafts)
- Values that don't need to be read from non-component code

Use TanStack Query for server state that is _only_ read from components. The Zustand project store exists because Yjs and the sync layer write to it from outside React.

## Current stores

| Store                | File                        | Middleware |
| -------------------- | --------------------------- | ---------- |
| `useAuthStore`       | `stores/authStore.ts`       | none       |
| `useProjectStore`    | `stores/projectStore.ts`    | `immer`    |
| `useAdminStore`      | `stores/adminStore.ts`      | none       |
| `usePdfPreviewStore` | `stores/pdfPreviewStore.ts` | none       |

## Store shape

State and actions are co-located in a single `create<State & Actions>()` call. Actions read via `get()` and write via `set()`.

```ts
import { create } from 'zustand';

interface State {
  count: number;
  error: string | null;
}

interface Actions {
  increment: () => void;
  setError: (error: string | null) => void;
  loadRemote: () => Promise<void>;
}

export const useExampleStore = create<State & Actions>()((set, get) => ({
  count: 0,
  error: null,

  increment: () => set({ count: get().count + 1 }),
  setError: error => set({ error }),

  loadRemote: async () => {
    try {
      const response = await fetch('/api/count');
      const { count } = await response.json();
      set({ count, error: null });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },
}));
```

## Reading from a store in a component

Subscribe to a single slice per `useStore` call. Zustand re-renders the component only when the selected value changes by reference.

```tsx
import { useAuthStore } from '@/stores/authStore';

function SignInForm() {
  const signin = useAuthStore(s => s.signin);
  const authError = useAuthStore(s => s.authError);
  // ...
}
```

Do not destructure the whole state (`const { signin, authError } = useAuthStore()`) -- that subscribes to every field and re-renders on any change.

## Reading selectors

Selectors are exported from the store file as **plain functions of state**, not hooks. They are called by passing them to `useStore`.

```ts
// stores/authStore.ts
export function selectIsLoggedIn(state: AuthState): boolean {
  if (state.isOnline) {
    if (state.sessionLoading && state.cachedUser) return true;
    return !!state.sessionUser;
  }
  return !!state.cachedUser;
}
```

```tsx
import { useAuthStore, selectIsLoggedIn } from '@/stores/authStore';

function Nav() {
  const isLoggedIn = useAuthStore(selectIsLoggedIn);
  // ...
}
```

Selectors that need parameters take them after `state` and are bound in the component:

```ts
// stores/projectStore.ts
export function selectStudies(state: ProjectStoreState, projectId: string): StudyInfo[] {
  return state.projects[projectId]?.studies || EMPTY_STUDIES;
}
```

```tsx
const studies = useProjectStore(s => selectStudies(s, projectId));
```

## Stable fallback references

Selectors must return a referentially-stable value when data is missing, or the `useSyncExternalStore` semantics underlying Zustand will trigger infinite re-render loops. Declare empty fallbacks at module scope, never inline.

```ts
// stores/projectStore.ts
const EMPTY_STUDIES: StudyInfo[] = [];
const EMPTY_MEMBERS: unknown[] = [];
const EMPTY_META: Record<string, unknown> = {};

export function selectStudies(state: ProjectStoreState, projectId: string): StudyInfo[] {
  return state.projects[projectId]?.studies || EMPTY_STUDIES;
}
```

`return []` or `return {}` inside the selector produces a new reference every call.

## Reading from outside React

Any code that runs outside the React render cycle uses `getState()` / `setState()` directly.

```ts
import { useAuthStore } from '@/stores/authStore';

async function performSignoutCleanup() {
  const state = useAuthStore.getState();
  state.setCachedUser(null);
  await state.sessionRefetch?.();
}
```

This is the whole reason auth state lives in Zustand rather than only in Better Auth's `useSession()` -- the Yjs layer, `authFetch`, and the query client all need access from outside components.

## Immer middleware for nested updates

Use `zustand/middleware/immer` when the state has nested records and updates would otherwise require spread gymnastics. `useProjectStore` is the canonical example.

```ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export const useProjectStore = create<State & Actions>()(
  immer(set => ({
    projects: {},

    setProjectData: (projectId, data) =>
      set(state => {
        if (!state.projects[projectId]) {
          state.projects[projectId] = { meta: {}, members: [], studies: [] };
        }
        if (data.studies !== undefined) {
          state.projects[projectId].studies = data.studies;
        }
      }),
  })),
);
```

Inside `set(state => { ... })`, mutate `state` directly -- Immer produces the new immutable snapshot.

## localStorage caching

Stores that cache server data to `localStorage` use plain module-level helpers, not middleware. Hydrate from cache in the initial state, persist from inside actions.

```ts
const AUTH_CACHE_KEY = 'corates-auth-cache';
const AUTH_CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function loadCachedAuth(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(AUTH_CACHE_KEY);
    const timestamp = localStorage.getItem(`${AUTH_CACHE_KEY}-ts`);
    if (!cached || !timestamp) return null;
    if (Date.now() - parseInt(timestamp, 10) > AUTH_CACHE_MAX_AGE) {
      localStorage.removeItem(AUTH_CACHE_KEY);
      return null;
    }
    return JSON.parse(cached);
  } catch {
    return null;
  }
}

export const useAuthStore = create<State & Actions>()((set, get) => ({
  cachedUser: loadCachedAuth(),
  // ...
}));
```

The `typeof window === 'undefined'` guard matters because the app is SSR'd by TanStack Start. Stores are imported during server rendering; any direct `localStorage` access there throws.

## Cross-tab sync

`useAuthStore` uses `BroadcastChannel` to sync sign-in/out across tabs. When one tab signs out, every other tab refetches its session.

```ts
const authChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('corates-auth') : null;

function broadcastAuthChange() {
  authChannel?.postMessage({ type: 'auth-changed', timestamp: Date.now() });
}

if (typeof window !== 'undefined' && authChannel) {
  authChannel.addEventListener('message', event => {
    if (event.data?.type === 'auth-changed') {
      useAuthStore.getState().sessionRefetch?.();
    }
  });
}
```

Add a broadcast only when state changes must be observable from another browser tab. Most stores do not need this.

## Don'ts

- Don't prop-drill store data. Import the store where you need it.
- Don't destructure the whole store (`const { a, b } = useStore()`) -- subscribe to each slice separately.
- Don't return inline empty arrays/objects from selectors.
- Don't access `localStorage` or `navigator` at module scope without a `typeof window !== 'undefined'` guard -- it breaks SSR.
- Don't put server state in Zustand if it's only read by components. Use TanStack Query.
