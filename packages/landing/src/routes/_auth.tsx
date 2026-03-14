/**
 * Auth Layout Route - minimal layout for authentication pages
 *
 * No sidebar/navbar. Guest guard redirects logged-in users to /dashboard.
 * SSR disabled since auth pages interact with localStorage and cookies.
 */

import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { useAuthStore, selectIsLoggedIn } from '@/stores/authStore';

export const Route = createFileRoute('/_auth')({
  ssr: false,
  beforeLoad: () => {
    const state = useAuthStore.getState();
    const isLoggedIn = selectIsLoggedIn(state);

    if (isLoggedIn) {
      throw redirect({ to: '/dashboard' });
    }
  },
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md px-4">
        <Outlet />
      </div>
    </div>
  );
}
