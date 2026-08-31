/**
 * Protected Layout Route - auth guard for all protected app routes
 *
 * All children (settings, projects, admin, orgs) require login.
 * Redirects to /signin if user is not authenticated.
 *
 * The beforeLoad guard only redirects once auth has settled as logged out.
 * While the session is still resolving (including a first load with no cached
 * user) the component shows a spinner and redirects after it settles.
 */

import { useEffect } from 'react';
import { createFileRoute, Outlet, redirect, useNavigate } from '@tanstack/react-router';
import { useAuthStore, selectIsLoggedIn, selectIsAuthLoading } from '@/stores/authStore';
import { PageLoader } from '@/components/ui/spinner';
import { RouteError } from '@/components/RouteError';

export const Route = createFileRoute('/_app/_protected')({
  beforeLoad: () => {
    const state = useAuthStore.getState();
    // A valid cookie with an empty localStorage cache (fresh device, cleared
    // storage) looks identical to logged-out until the session fetch returns;
    // redirecting here would bounce a deep link to /signin.
    if (selectIsAuthLoading(state)) return;
    if (!selectIsLoggedIn(state)) {
      throw redirect({ to: '/signin' });
    }
  },
  component: ProtectedLayout,
  errorComponent: RouteError,
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
    return <PageLoader label='Checking authentication...' />;
  }

  if (!isLoggedIn) {
    return <PageLoader label='Redirecting...' />;
  }

  return <Outlet />;
}
