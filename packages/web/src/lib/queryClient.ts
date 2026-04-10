/**
 * TanStack Query Client Configuration
 * Configured with offline-first defaults.
 * Global error handlers for Hono RPC DetailedError (see docs/audits/hono-rpc-migration.md).
 */

import { QueryClient } from '@tanstack/react-query';
import { DetailedError } from 'hono/client';
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
          // Don't retry auth or other client errors
          if (error instanceof DetailedError && error.statusCode && error.statusCode < 500) {
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

  // Auth redirect handler for RPC errors
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
