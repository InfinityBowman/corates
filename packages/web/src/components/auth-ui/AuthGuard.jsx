import { createEffect, Show, createSignal } from 'solid-js';
import { useNavigate, useLocation } from '@solidjs/router';
import { useBetterAuth } from '@api/better-auth-store.js';

export default function AuthGuard(props) {
  const { isLoggedIn, authLoading, user } = useBetterAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Track if this is the initial load vs a background refetch
  const [initialLoadComplete, setInitialLoadComplete] = createSignal(false);

  createEffect(() => {
    if (!authLoading()) {
      setInitialLoadComplete(true);
    }
  });

  // Redirect logged in users appropriately
  createEffect(() => {
    if (!authLoading() && isLoggedIn()) {
      const currentPath = location.pathname;
      const currentUser = user();

      // Don't redirect if on complete-profile or reset-password (allow setting password while logged in)
      if (currentPath === '/complete-profile' || currentPath === '/reset-password') {
        return;
      }

      // If user hasn't completed profile setup, send to complete-profile
      // Otherwise send to dashboard
      if (!currentUser?.profileCompletedAt) {
        navigate('/complete-profile', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  });

  // Show loading only on initial load, not on refetches
  const showLoading = () => !initialLoadComplete() && authLoading();

  // Show content for:
  // 1. Non-logged-in users (signup, signin, etc.)
  // 2. Logged-in users on complete-profile or reset-password page
  const showContent = () => {
    if (!initialLoadComplete()) return false;
    const currentPath = location.pathname;
    if (currentPath === '/complete-profile' || currentPath === '/reset-password') return true;
    if (props.redirect) {
      navigate(`/${props.redirect}`, { replace: true });
    }
    return !isLoggedIn();
  };

  return (
    <>
      <Show when={showLoading()}>
        <div class='w-full max-w-md sm:max-w-xl flex items-center justify-center'>
          <div class='text-center'>
            <div class='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto' />
            <p class='mt-4 text-gray-600'>Loading...</p>
          </div>
        </div>
      </Show>
      <Show when={showContent()}>{props.children}</Show>
    </>
  );
}
