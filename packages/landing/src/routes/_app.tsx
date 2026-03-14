/**
 * App Layout Route - wraps all application routes
 *
 * Provides:
 * - App shell layout (navbar + sidebar)
 * - SSR disabled (app routes require browser APIs: IndexedDB, WebSocket, localStorage)
 *
 * Providers (QueryClientProvider, AuthProvider, Toaster) are in __root.tsx.
 *
 * No auth guard here -- dashboard and local checklists are public.
 * Protected routes use _app/_protected.tsx for auth guards.
 */

import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/_app')({
  ssr: false,
  component: AppLayoutWrapper,
});

function AppLayoutWrapper() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* TODO(agent): Replace with full AppLayout component (navbar + sidebar) */}
      <main>
        <Outlet />
      </main>
    </div>
  );
}
