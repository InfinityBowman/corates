/**
 * App Layout Route - wraps all application routes
 *
 * Provides:
 * - QueryClientProvider (TanStack Query)
 * - AuthProvider (session sync, offline fallback, cross-tab sync)
 * - App shell layout (navbar + sidebar)
 * - SSR disabled (app routes require browser APIs: IndexedDB, WebSocket, localStorage)
 *
 * No auth guard here -- dashboard and local checklists are public.
 * Protected routes use _app/_protected.tsx for auth guards.
 */

import { createFileRoute, Outlet } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient.js';
import { AuthProvider } from '@/components/auth/AuthProvider';

export const Route = createFileRoute('/_app')({
  ssr: false,
  component: AppLayoutWrapper,
});

function AppLayoutWrapper() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <div className="min-h-screen bg-gray-50">
          {/* TODO(agent): Replace with full AppLayout component (navbar + sidebar) */}
          <main>
            <Outlet />
          </main>
        </div>
      </AuthProvider>
    </QueryClientProvider>
  );
}
