import { createEffect, Show, createSignal } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useBetterAuth } from '@api/better-auth-store.js';

/**
 * ProtectedGuard - For authenticated pages (profile, settings, admin, etc.)
 * Redirects guests to dashboard
 */
export default function ProtectedGuard(props) {
  const { isLoggedIn, authLoading } = useBetterAuth();
  const navigate = useNavigate();

  const [initialLoadComplete, setInitialLoadComplete] = createSignal(false);

  createEffect(() => {
    if (!authLoading()) {
      setInitialLoadComplete(true);
    }
  });

  // Redirect non-logged-in users to dashboard
  createEffect(() => {
    if (!authLoading() && !isLoggedIn()) {
      navigate('/dashboard', { replace: true });
    }
  });

  const showLoading = () => !initialLoadComplete() && authLoading();
  const showContent = () => initialLoadComplete() && isLoggedIn();

  return (
    <>
      <Show when={showLoading()}>
        <div class='flex w-full max-w-md items-center justify-center sm:max-w-xl'>
          <div class='text-center'>
            <div class='mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600' />
            <p class='mt-4 text-gray-600'>Loading...</p>
          </div>
        </div>
      </Show>
      <Show when={showContent()}>{props.children}</Show>
    </>
  );
}
