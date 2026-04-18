/**
 * TanStack Query Client Configuration. Offline-first defaults plus an auth
 * redirect on AUTH_REQUIRED / AUTH_EXPIRED domain errors.
 */

import { QueryClient } from '@tanstack/react-query';
import { showToast } from '@/components/ui/toast';
import { getDomainError, getUserFriendlyMessage } from '@/lib/error-utils';

function getFriendlyMessage(error: unknown): string {
  const domainError = getDomainError(error);
  if (domainError) {
    return getUserFriendlyMessage(domainError);
  }
  return 'Something went wrong. Please try again.';
}

let queryClientInstance: QueryClient | null = null;

function getQueryClient(): QueryClient {
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
        retry: (failureCount, error) => {
          // Don't retry 4xx — handlers throw the parsed domain-error JSON
          // directly, so `statusCode` is a plain field on the error object.
          const status = (error as { statusCode?: unknown })?.statusCode;
          if (typeof status === 'number' && status < 500) {
            return false;
          }
          return failureCount < 3;
        },
        retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
        refetchOnReconnect: true,
        refetchOnMount: true,
      },
      mutations: {
        retry: 1,
        networkMode: 'online',
        onError: error => {
          showToast.error(getFriendlyMessage(error));
        },
      },
    },
  });

  // Auth redirect handler — applies to any thrown domain error
  queryClientInstance.getQueryCache().subscribe(event => {
    if (event.type === 'updated' && event.query.state.error) {
      const domainError = getDomainError(event.query.state.error);
      if (domainError?.code === 'AUTH_REQUIRED' || domainError?.code === 'AUTH_EXPIRED') {
        window.location.href = '/signin';
      }
    }
  });

  return queryClientInstance;
}

export const queryClient = getQueryClient();
