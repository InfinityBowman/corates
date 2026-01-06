/**
 * TanStack Query Client Configuration
 * Configured with offline-first defaults and IndexedDB persistence
 */

import { QueryClient } from '@tanstack/solid-query';
import { debounce } from '@solid-primitives/scheduled';
import { createIDBPersister } from './queryPersister.js';

let queryClientInstance = null;

// Maximum age for persisted cache data (24 hours)
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000;

// LocalStorage key for critical cache state (fallback for beforeunload)
const CACHE_SNAPSHOT_KEY = 'corates-query-cache-snapshot';

/**
 * Initialize persistence for the query client
 * Sets up automatic persistence of the query cache to IndexedDB
 * @param {QueryClient} queryClient - The QueryClient instance to persist
 * @returns {Function} Cleanup function (intentionally not called since client is singleton)
 */
async function setupPersistence(queryClient) {
  const persister = createIDBPersister();

  // Restore cache on initialization
  try {
    const persistedClient = await persister.restoreClient();
    if (persistedClient) {
      const now = Date.now();
      const cacheTimestamp = persistedClient.timestamp || 0;

      // Validate cache age - skip if older than 24 hours
      if (now - cacheTimestamp > MAX_CACHE_AGE_MS) {
        console.info('[queryClient] Persisted cache expired, skipping restoration');
        await persister.removeClient();
      } else if (persistedClient.clientState?.queries) {
        // Restore queries, validating each query's data age
        const restoredQueryKeys = [];
        for (const query of persistedClient.clientState.queries) {
          const queryAge = now - (query.state?.dataUpdatedAt || 0);

          // Skip queries older than max age or with error status
          if (queryAge > MAX_CACHE_AGE_MS || query.state?.status === 'error') {
            continue;
          }

          // Only restore if query doesn't already have fresher data
          const existingQuery = queryClient.getQueryData(query.queryKey);
          if (!existingQuery) {
            // Preserve the original dataUpdatedAt timestamp to prevent falsely marking data as fresh
            // This ensures queries will be considered stale and refetch if needed
            const originalUpdatedAt = query.state?.dataUpdatedAt || now;
            queryClient.setQueryData(query.queryKey, query.state.data, {
              updatedAt: originalUpdatedAt,
            });
            restoredQueryKeys.push(query.queryKey);
          }
        }
        console.info(
          '[queryClient] Restored persisted cache from',
          new Date(cacheTimestamp).toISOString(),
        );
      }
    }
  } catch (error) {
    console.warn('Failed to restore persisted query cache:', error);
  }

  // Set up periodic persistence (debounced)
  const persistCache = debounce(async () => {
    try {
      const queryCache = queryClient.getQueryCache();
      const mutationCache = queryClient.getMutationCache();

      // Build persisted client state
      const persistedClient = {
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

      await persister.persistClient(persistedClient);
    } catch (error) {
      console.error('Failed to persist query cache:', error);
    }
  }, 1000); // Debounce by 1 second

  // Persist on cache updates
  const unsubscribeQueries = queryClient.getQueryCache().subscribe(() => {
    persistCache();
  });

  const unsubscribeMutations = queryClient.getMutationCache().subscribe(() => {
    persistCache();
  });

  // Persist on window unload
  // Use synchronous localStorage as fallback since async IndexedDB may not complete
  const handleBeforeUnload = () => {
    persistCache.clear();

    // Synchronous localStorage write as fallback for critical data
    // IndexedDB async write may not complete before page unload
    try {
      const queryCache = queryClient.getQueryCache();
      const criticalQueries = Array.from(queryCache.getAll())
        .filter(q => q.state.status === 'success' && q.state.data)
        .slice(0, 10) // Limit to avoid localStorage quota issues
        .map(q => ({
          queryKey: q.queryKey,
          data: q.state.data,
          dataUpdatedAt: q.state.dataUpdatedAt,
        }));

      localStorage.setItem(
        CACHE_SNAPSHOT_KEY,
        JSON.stringify({ queries: criticalQueries, timestamp: Date.now() }),
      );
    } catch {
      // Silently fail - localStorage may be full or unavailable
    }

    // Still try async persist (may complete if unload is slow)
    persistCache();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Try to restore from localStorage snapshot on init (covers cases where IndexedDB didn't persist)
    try {
      const snapshot = localStorage.getItem(CACHE_SNAPSHOT_KEY);
      if (snapshot) {
        const { queries, timestamp } = JSON.parse(snapshot);
        const now = Date.now();
        if (now - timestamp < MAX_CACHE_AGE_MS) {
          for (const q of queries) {
            if (!queryClient.getQueryData(q.queryKey)) {
              // Preserve the original dataUpdatedAt timestamp
              const originalUpdatedAt = q.dataUpdatedAt || now;
              queryClient.setQueryData(q.queryKey, q.data, {
                updatedAt: originalUpdatedAt,
              });
            }
          }
        }
        // Clear snapshot after restoration
        localStorage.removeItem(CACHE_SNAPSHOT_KEY);
      }
    } catch {
      // Silently fail
    }
  }

  // Return cleanup function
  // Note: This cleanup is intentionally not called since queryClient is a singleton
  // that lives for the entire app lifecycle. The subscriptions and event listeners
  // are only cleaned up when the browser tab/window is closed.
  return () => {
    unsubscribeQueries();
    unsubscribeMutations();
    persistCache.clear();
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  };
}

/**
 * Create and configure QueryClient instance (singleton)
 * @returns {QueryClient} Configured QueryClient
 */
export function getQueryClient() {
  if (queryClientInstance) {
    return queryClientInstance;
  }

  // Disable caching in development
  const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';

  queryClientInstance = new QueryClient({
    defaultOptions: {
      queries: {
        // Offline-first: try cache first, then network
        networkMode: 'offlineFirst',
        // In development: no caching (always fetch fresh data)
        // In production: data is considered fresh for 5 minutes
        staleTime: isDevelopment ? 0 : 1000 * 60 * 5,
        // In development: immediately garbage collect unused data
        // In production: unused data is kept in cache for 10 minutes
        gcTime: isDevelopment ? 0 : 1000 * 60 * 10,
        // Retry failed requests up to 3 times
        retry: 3,
        // Retry delay with exponential backoff
        retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
        // Refetch on reconnect (important for offline support)
        refetchOnReconnect: true,
        // Refetch on mount if data is stale (always true in dev with staleTime: 0)
        refetchOnMount: true,
      },
      mutations: {
        // Retry mutations once
        retry: 1,
        // Network mode for mutations: always try network
        networkMode: 'online',
      },
    },
  });

  // Set up persistence (async, but don't block)
  if (typeof window !== 'undefined') {
    setupPersistence(queryClientInstance).catch(err => {
      console.warn('Failed to set up query persistence:', err);
    });
  }

  return queryClientInstance;
}

/**
 * Export the singleton queryClient instance
 */
export const queryClient = getQueryClient();

/**
 * Clear all persisted query cache (IndexedDB and localStorage)
 * Should be called on sign out to prevent stale data from being restored
 */
export async function clearPersistedQueryCache() {
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
