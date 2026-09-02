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
import { appLayoutMeta } from '@/config/app';

export const Route = createFileRoute('/_app')({
  ssr: false,
  // The server stops executing head() at the first ssr:false match, so a head on
  // any child route (dashboard, _protected) never reaches the served HTML. This
  // pathless layout's own match.pathname is always '/', so read the leaf match.
  head: ({ matches }) => ({ meta: appLayoutMeta(matches[matches.length - 1].pathname) }),
  component: AppLayout,
  errorComponent: RouteError,
});
