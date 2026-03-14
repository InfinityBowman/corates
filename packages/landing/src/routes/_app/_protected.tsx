/**
 * Protected Layout Route - auth guard for all protected app routes
 *
 * All children (settings, projects, admin, orgs) require login.
 * Redirects to /signin if user is not authenticated.
 *
 * The beforeLoad guard checks synchronous store state (including cached auth).
 * The component-level guard handles the case where auth is still loading
 * by showing a loading spinner until the session resolves.
 */

import { useEffect } from 'react';
import { createFileRoute, Outlet, redirect, useNavigate } from '@tanstack/react-router';
import { useAuthStore, selectIsLoggedIn, selectIsAuthLoading } from '@/stores/authStore';
import { PageLoader } from '@/components/ui/spinner';

export const Route = createFileRoute('/_app/_protected')({
  beforeLoad: () => {
    const state = useAuthStore.getState();
    const isLoggedIn = selectIsLoggedIn(state);

    // selectIsLoggedIn returns true if there's a cached user (even while loading),
    // so this only redirects when we're definitively not logged in
    if (!isLoggedIn) {
      throw redirect({ to: '/signin' });
    }
  },
  component: ProtectedLayout,
});

function ProtectedLayout() {
  const isLoading = useAuthStore(selectIsAuthLoading);
  const isLoggedIn = useAuthStore(selectIsLoggedIn);
  const navigate = useNavigate();

  // After loading resolves, redirect if session expired (cached user was stale)
  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      navigate({ to: '/signin', replace: true });
    }
  }, [isLoading, isLoggedIn, navigate]);

  if (isLoading) {
    return <PageLoader label="Checking authentication..." />;
  }

  if (!isLoggedIn) {
    return <PageLoader label="Redirecting..." />;
  }

  return <Outlet />;
}
