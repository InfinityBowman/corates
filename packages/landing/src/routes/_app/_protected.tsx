/**
 * Protected Layout Route - auth guard for all protected app routes
 *
 * All children (settings, projects, admin, orgs) require login.
 * Redirects to /signin if user is not authenticated.
 */

import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { useAuthStore, selectIsLoggedIn, selectIsAuthLoading } from '@/stores/authStore';

export const Route = createFileRoute('/_app/_protected')({
  beforeLoad: () => {
    const state = useAuthStore.getState();
    const isLoggedIn = selectIsLoggedIn(state);
    const isLoading = selectIsAuthLoading(state);

    // Don't redirect while auth is still loading (prevents flash)
    if (isLoading) return;

    if (!isLoggedIn) {
      throw redirect({ to: '/signin' });
    }
  },
  component: ProtectedLayout,
});

function ProtectedLayout() {
  return <Outlet />;
}
