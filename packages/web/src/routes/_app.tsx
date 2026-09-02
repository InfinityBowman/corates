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
import { RouteError } from '@/components/RouteError';
import { NOINDEX_META } from '@/config/app';

export const Route = createFileRoute('/_app')({
  ssr: false,
  // The server stops executing head() at the first ssr:false match, so a head on
  // any child route never reaches the served HTML. Nothing under here is worth
  // indexing: it is per-user state, and /checklist renders from IndexedDB, so a
  // crawler only ever sees an empty shell.
  head: () => ({ meta: [NOINDEX_META] }),
  component: AppLayout,
  errorComponent: RouteError,
});
