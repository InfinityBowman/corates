/**
 * TanStack Query Client Configuration
 * Configured with offline-first defaults.
 */

import { QueryClient } from '@tanstack/react-query';

let queryClientInstance: QueryClient | null = null;

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

  return queryClientInstance;
}

export const queryClient = getQueryClient();
