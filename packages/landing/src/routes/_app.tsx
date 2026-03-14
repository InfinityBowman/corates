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

import { createFileRoute } from '@tanstack/react-router';
import { AppLayout } from '@/components/layout/AppLayout';

export const Route = createFileRoute('/_app')({
  ssr: false,
  component: AppLayout,
});
