import { createEffect, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useBetterAuth } from '@api/better-auth-store.js';
import { PageLoader } from '@/components/ui/spinner';

/**
 * ProtectedGuard - For authenticated pages (profile, settings, admin, etc.)
 * Redirects guests to signin
 */
export default function ProtectedGuard(props) {
  const { isLoggedIn, authLoading } = useBetterAuth();
  const navigate = useNavigate();

  // Redirect non-logged-in users to signin
  createEffect(() => {
    if (!authLoading() && !isLoggedIn()) {
      navigate('/signin', { replace: true });
    }
  });

  return (
    <Show when={isLoggedIn()} fallback={<PageLoader message='Loading...' />}>
      {props.children}
    </Show>
  );
}
