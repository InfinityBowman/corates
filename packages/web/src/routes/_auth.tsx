/**
 * Auth Layout Route - minimal layout for authentication pages
 *
 * No sidebar/navbar. Guest guard redirects logged-in users to /dashboard.
 * Client-only -- auth forms are interactive and touch localStorage/cookies freely.
 *
 * Providers (QueryClientProvider, AuthProvider, Toaster) are in __root.tsx.
 *
 * Exemptions: /reset-password allows logged-in users (they may have a token link).
 * /complete-profile is not under _auth -- it will have its own route when migrated.
 */

import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { useAuthStore, selectIsLoggedIn } from '@/stores/authStore';
import { capturePlanParams } from '@/lib/plan-redirect-utils';
import { RouteError } from '@/components/RouteError';
import { NOINDEX_META } from '@/config/app';

export const Route = createFileRoute('/_auth')({
  ssr: false,
  head: () => ({ meta: [NOINDEX_META] }),
  beforeLoad: ({ location }) => {
    // Allow logged-in users through to these pages:
    // reset-password: they may have a token link
    // complete-profile: post-signup onboarding for authenticated users
    // check-email: logged-in but email not yet verified
    const exemptPaths = ['/reset-password', '/complete-profile', '/check-email'];
    if (exemptPaths.includes(location.pathname)) return;

    const state = useAuthStore.getState();
    const isLoggedIn = selectIsLoggedIn(state);

    if (isLoggedIn) {
      // Signed-in users never reach signup, so capture pricing-page plan params here.
      const hasPlan = capturePlanParams(new URLSearchParams(location.searchStr));
      throw redirect({ to: hasPlan ? '/settings/plans' : '/dashboard' });
    }
  },
  component: AuthLayout,
  errorComponent: RouteError,
});

function AuthLayout() {
  return (
    <div className='flex min-h-screen items-center justify-center bg-gray-50 px-4'>
      <Outlet />
    </div>
  );
}
