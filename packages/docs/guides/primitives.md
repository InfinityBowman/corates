# Hooks Guide

Custom React hooks in CoRATES live in `packages/web/src/hooks/`. They wrap server-state queries, auth-aware conditional queries, and cross-cutting behaviors (online status, debounced values, presence). A smaller set of non-hook helpers -- IndexedDB wrappers, avatar caches, PDF caches -- live under `packages/web/src/primitives/` and keep that name for historical reasons.

> Naming note: the `primitives/` folder predates the React migration (the codebase used to be SolidJS, where "primitive" was the idiomatic term for `useX`). New hooks go in `hooks/`. Do not create new files under `primitives/` unless they are non-hook utilities.

## When to write a hook

Write a hook when:

- Multiple components need the same fetch + derived state (`useOrgs`, `useProjectData`, `useSubscription`).
- You're wrapping TanStack Query with auth- or route-dependent `enabled` logic that would be ugly inline.
- You're subscribing to a non-React external source and exposing it as React state (`useYText`, `useOnlineStatus`, `useReconciliationPresence`).
- You're coordinating effects with cleanup that multiple callsites would otherwise duplicate.

Skip a hook and keep logic in the component when:

- It's only used once.
- It's a pure function -- put it in `@/lib/` instead.
- It's global state that outlives the component -- put it in a Zustand store under `@/stores/` instead.

## Canonical shape

Most hooks in the repo follow this pattern: wrap TanStack Query, gate `enabled` on auth readiness, normalize the return shape.

```ts
// hooks/useOrgs.ts
import { useQuery } from '@tanstack/react-query';
import { authClient, authFetch } from '@/api/auth-client';
import { useAuthStore, selectIsLoggedIn, selectIsAuthLoading } from '@/stores/authStore';
import { queryKeys } from '@/lib/queryKeys';

async function fetchOrgs() {
  const data = await authFetch(authClient.organization.list());
  return data || [];
}

export function useOrgs() {
  const isLoggedIn = useAuthStore(selectIsLoggedIn);
  const isAuthLoading = useAuthStore(selectIsAuthLoading);

  const orgsQuery = useQuery({
    queryKey: queryKeys.orgs.list,
    queryFn: fetchOrgs,
    enabled: isLoggedIn && !isAuthLoading,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });

  return {
    orgs: orgsQuery.data ?? [],
    isLoading: isAuthLoading || orgsQuery.isLoading,
    isError: orgsQuery.isError,
    error: orgsQuery.error,
    refetch: orgsQuery.refetch,
  };
}
```

Rules this example demonstrates:

- **`enabled` is gated on auth state.** Queries that need a session should not fire until `isLoggedIn && !isAuthLoading`.
- **`queryKey` comes from `@/lib/queryKeys`.** Do not inline string keys; centralize them so invalidation is unambiguous.
- **The returned object reshapes the query.** Callers don't see `data` -- they see `orgs`. This keeps domain vocabulary in the hook, not in every consumer.
- **`isLoading` merges auth loading and query loading.** The consumer should not have to reason about auth separately.

## Mutation hooks

Mutation hooks follow the same pattern with `useMutation` and `queryClient.invalidateQueries`. Keep the invalidation logic inside the hook so consumers don't need to know which query keys are affected.

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

export function useCreateOrg() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string }) => {
      return authFetch(authClient.organization.create(input));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orgs.list });
    },
  });
}
```

## Subscribing to external sources

For non-React sources (Yjs docs, `BroadcastChannel`, custom event buses), use `useSyncExternalStore`. Do not reach for `useState` + `useEffect` to emulate it -- the behavior is different under concurrent rendering.

```ts
import { useSyncExternalStore } from 'react';

export function useOnlineStatus() {
  return useSyncExternalStore(
    cb => {
      window.addEventListener('online', cb);
      window.addEventListener('offline', cb);
      return () => {
        window.removeEventListener('online', cb);
        window.removeEventListener('offline', cb);
      };
    },
    () => navigator.onLine,
    () => true, // SSR fallback
  );
}
```

## File and naming conventions

- File name matches the hook: `useOrgs.ts` exports `useOrgs`.
- One primary hook per file. Secondary helpers (fetchers, selectors) stay colocated in the same file unless they're reused elsewhere.
- Name hooks after the domain noun, not the implementation (`useOrgs`, not `useOrgsQuery`).
- Hooks that return queries should expose `isLoading`, `isError`, `error`, `refetch` in addition to the domain data -- matches what the rest of the codebase expects.

## What doesn't belong in a hook

- Global state that needs to be read from outside React -- use a Zustand store.
- Pure data transforms -- put them in `@/lib/`.
- IndexedDB, cache, or persistence plumbing -- put it in `@/primitives/` alongside `db.ts` and `avatarCache.ts`.
- Fetch logic that isn't wrapped in TanStack Query -- if you're doing raw `fetch` inside `useEffect`, you're almost certainly reinventing Query badly.
