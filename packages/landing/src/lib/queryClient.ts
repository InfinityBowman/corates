/**
 * TanStack Query Client Configuration
 * Configured with offline-first defaults and IndexedDB persistence
 */

import { QueryClient } from '@tanstack/react-query';
import { createIDBPersister } from './queryPersister';

let queryClientInstance: QueryClient | null = null;

// Maximum age for persisted cache data (24 hours)
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000;

// LocalStorage key for critical cache state (fallback for beforeunload)
const CACHE_SNAPSHOT_KEY = 'corates-query-cache-snapshot';

interface DebouncedFn {
  (..._args: unknown[]): void;
  clear: () => void;
}

function debounce(fn: (..._args: unknown[]) => void, ms: number): DebouncedFn {
  let timer: ReturnType<typeof setTimeout>;
  const debounced = (...args: unknown[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  debounced.clear = () => clearTimeout(timer);
  return debounced;
}

interface PersistedQueryState {
  data: unknown;
  dataUpdatedAt: number;
  error: unknown;
  errorUpdatedAt: number;
  status: string;
  fetchStatus: string;
}

interface PersistedQuery {
  queryKey: readonly unknown[];
  queryHash: string;
  state: PersistedQueryState;
}

interface PersistedClient {
  clientState: {
    queries: PersistedQuery[];
    mutations: unknown[];
  };
  timestamp: number;
}

async function setupPersistence(client: QueryClient): Promise<() => void> {
  const persister = createIDBPersister();

  // Restore cache on initialization
  try {
    const persistedClient = (await persister.restoreClient()) as PersistedClient | null;
    if (persistedClient) {
      const now = Date.now();
      const cacheTimestamp = persistedClient.timestamp || 0;

      if (now - cacheTimestamp > MAX_CACHE_AGE_MS) {
        console.info('[queryClient] Persisted cache expired, skipping restoration');
        await persister.removeClient();
      } else if (persistedClient.clientState?.queries) {
        const restoredQueryKeys: (readonly unknown[])[] = [];
        for (const query of persistedClient.clientState.queries) {
          const queryAge = now - (query.state?.dataUpdatedAt || 0);

          if (queryAge > MAX_CACHE_AGE_MS || query.state?.status === 'error') {
            continue;
          }

          const existingQuery = client.getQueryData(query.queryKey);
          if (!existingQuery) {
            const originalUpdatedAt = query.state?.dataUpdatedAt || now;
            client.setQueryData(query.queryKey, query.state.data, {
              updatedAt: originalUpdatedAt,
            });
            restoredQueryKeys.push(query.queryKey);
          }
        }
        console.info(
          '[queryClient] Restored persisted cache from',
          new Date(cacheTimestamp).toISOString(),
        );

        if (navigator.onLine && restoredQueryKeys.length > 0) {
          setTimeout(() => {
            client.invalidateQueries();
          }, 100);
        }
      }
    }
  } catch (error) {
    console.warn('Failed to restore persisted query cache:', error);
  }

  // Set up periodic persistence (debounced)
  const persistCache = debounce(async () => {
    try {
      const queryCache = client.getQueryCache();
      const mutationCache = client.getMutationCache();

      const persistedClientData: PersistedClient = {
        clientState: {
          queries: Array.from(queryCache.getAll()).map(query => ({
            queryKey: query.queryKey,
            queryHash: query.queryHash,
            state: {
              data: query.state.data,
              dataUpdatedAt: query.state.dataUpdatedAt,
              error: query.state.error,
              errorUpdatedAt: query.state.errorUpdatedAt,
              status: query.state.status,
              fetchStatus: query.state.fetchStatus,
            },
          })),
          mutations: Array.from(mutationCache.getAll()).map(mutation => ({
            mutationKey: mutation.options.mutationKey,
            state: {
              status: mutation.state.status,
              data: mutation.state.data,
              error: mutation.state.error,
            },
          })),
        },
        timestamp: Date.now(),
      };

      await persister.persistClient(persistedClientData);
    } catch (error) {
      console.error('Failed to persist query cache:', error);
    }
  }, 1000);

  const unsubscribeQueries = client.getQueryCache().subscribe(() => {
    persistCache();
  });

  const unsubscribeMutations = client.getMutationCache().subscribe(() => {
    persistCache();
  });

  const handleBeforeUnload = () => {
    persistCache.clear();

    try {
      const queryCache = client.getQueryCache();
      const criticalQueries = Array.from(queryCache.getAll())
        .filter(q => q.state.status === 'success' && q.state.data)
        .slice(0, 10)
        .map(q => ({
          queryKey: q.queryKey,
          data: q.state.data,
          dataUpdatedAt: q.state.dataUpdatedAt,
        }));

      localStorage.setItem(
        CACHE_SNAPSHOT_KEY,
        JSON.stringify({ queries: criticalQueries, timestamp: Date.now() }),
      );
    } catch (err) {
      console.warn('Failed to save query cache snapshot to localStorage:', (err as Error).message);
    }

    persistCache();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', handleBeforeUnload);

    try {
      const snapshot = localStorage.getItem(CACHE_SNAPSHOT_KEY);
      if (snapshot) {
        const { queries, timestamp } = JSON.parse(snapshot);
        const now = Date.now();
        if (now - timestamp < MAX_CACHE_AGE_MS) {
          for (const q of queries) {
            if (!client.getQueryData(q.queryKey)) {
              const originalUpdatedAt = q.dataUpdatedAt || now;
              client.setQueryData(q.queryKey, q.data, {
                updatedAt: originalUpdatedAt,
              });
            }
          }
        }
        localStorage.removeItem(CACHE_SNAPSHOT_KEY);
      }
    } catch (err) {
      console.warn('Failed to restore query cache from localStorage:', (err as Error).message);
    }
  }

  return () => {
    unsubscribeQueries();
    unsubscribeMutations();
    persistCache.clear();
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  };
}

export function getQueryClient(): QueryClient {
  if (queryClientInstance) {
    return queryClientInstance;
  }

  const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';

  queryClientInstance = new QueryClient({
    defaultOptions: {
      queries: {
        networkMode: 'offlineFirst',
        staleTime: isDevelopment ? 0 : 1000 * 60 * 5,
        gcTime: isDevelopment ? 0 : 1000 * 60 * 10,
        retry: 3,
        retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
        refetchOnReconnect: true,
        refetchOnMount: true,
      },
      mutations: {
        retry: 1,
        networkMode: 'online',
      },
    },
  });

  if (typeof window !== 'undefined') {
    setupPersistence(queryClientInstance).catch(err => {
      console.warn('Failed to set up query persistence:', err);
    });
  }

  return queryClientInstance;
}

export const queryClient = getQueryClient();

export async function clearPersistedQueryCache(): Promise<void> {
  try {
    const persister = createIDBPersister();
    await persister.removeClient();
  } catch (error) {
    console.warn('Failed to clear IndexedDB persisted cache:', error);
  }

  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CACHE_SNAPSHOT_KEY);
    }
  } catch (error) {
    console.warn('Failed to clear localStorage cache snapshot:', error);
  }
}
