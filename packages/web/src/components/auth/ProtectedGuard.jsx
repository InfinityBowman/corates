import { createEffect, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useBetterAuth } from '@api/better-auth-store.js';
import { PageLoader } from '@corates/ui';

/**
 * ProtectedGuard - For authenticated pages (profile, settings, admin, etc.)
 * Redirects guests to dashboard
 */
export default function ProtectedGuard(props) {
  const { isLoggedIn, authLoading } = useBetterAuth();
  const navigate = useNavigate();

  // Redirect non-logged-in users to dashboard
  createEffect(() => {
    if (!authLoading() && !isLoggedIn()) {
      navigate('/dashboard', { replace: true });
    }
  });

  return (
    <Show when={isLoggedIn()} fallback={<PageLoader message='Loading...' />}>
      {props.children}
    </Show>
  );
}
