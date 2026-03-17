/**
 * Test app renderer
 * Creates a full TanStack Router app with all providers for e2e testing
 */

import React from 'react';
import {
  RouterProvider,
  createMemoryHistory,
  createRouter,
} from '@tanstack/react-router';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { routeTree } from '@/routeTree.gen';

export interface TestAppContext {
  router: ReturnType<typeof createRouter>;
  queryClient: QueryClient;
}

export function createTestApp(initialPath: string): {
  TestApp: React.FC;
  ctx: TestAppContext;
} {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
    },
  });

  const memoryHistory = createMemoryHistory({
    initialEntries: [initialPath],
  });

  const router = createRouter({
    routeTree,
    history: memoryHistory,
  });

  function TestApp() {
    return (
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );
  }

  return { TestApp, ctx: { router, queryClient } };
}
