import { createEffect, Show, createSignal } from 'solid-js';
import { useNavigate, useLocation } from '@solidjs/router';
import { useBetterAuth } from '@api/better-auth-store.js';

/**
 * AuthLayout - Layout for auth pages (signin, signup, etc.)
 * Includes guest guard logic to redirect logged-in users away
 */
export default function AuthLayout(props) {
  const { isLoggedIn, authLoading, user } = useBetterAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [initialLoadComplete, setInitialLoadComplete] = createSignal(false);

  createEffect(() => {
    if (!authLoading()) {
      setInitialLoadComplete(true);
    }
  });

  // Redirect logged-in users appropriately
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

  const showLoading = () => !initialLoadComplete() && authLoading();

  // Show content for non-logged-in users OR on complete-profile/reset-password pages
  const showContent = () => {
    if (!initialLoadComplete()) return false;
    const currentPath = location.pathname;
    if (currentPath === '/complete-profile' || currentPath === '/reset-password') return true;
    return !isLoggedIn();
  };

  return (
    <div class='min-h-screen bg-blue-50 flex items-center justify-center px-4 py-8 sm:py-12'>
      <Show when={showLoading()}>
        <div class='w-full max-w-md sm:max-w-xl flex items-center justify-center'>
          <div class='text-center'>
            <div class='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto' />
            <p class='mt-4 text-gray-600'>Loading...</p>
          </div>
        </div>
      </Show>
      <Show when={showContent()}>
        <div class='w-full max-w-md sm:max-w-xl'>{props.children}</div>
      </Show>
    </div>
  );
}
