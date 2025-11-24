import { createEffect, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useBetterAuth } from '../auth-ui/BetterAuthStore.js';

export default function ProtectedRoute(props) {
  const { isLoggedIn, authLoading, user, signout } = useBetterAuth();
  const navigate = useNavigate();

  // Redirect to signin if not authenticated
  createEffect(() => {
    if (!authLoading() && !isLoggedIn()) {
      navigate('/signin', { replace: true });
    }
  });

  return (
    <Show
      when={!authLoading() && isLoggedIn()}
      fallback={
        <div class='min-h-screen bg-gray-900 flex items-center justify-center'>
          <div class='text-center text-white'>
            <div class='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto'></div>
            <p class='mt-4 text-gray-400'>Authenticating...</p>
          </div>
        </div>
      }
    >
      <div class='min-h-screen bg-gray-900'>
        {/* Header with user info and logout */}
        <header class='bg-gray-800 border-b border-gray-700 px-6 py-4'>
          <div class='flex items-center justify-between'>
            <h1 class='text-2xl font-bold text-blue-400'>CoRATES Dashboard</h1>
            <div class='flex items-center space-x-4'>
              <Show when={user()}>
                <div class='text-sm text-gray-300'>
                  Welcome,{' '}
                  <span class='text-white font-medium'>{user()?.name || user()?.email}</span>
                </div>
              </Show>
              <button
                onClick={async () => {
                  try {
                    await signout();
                    navigate('/signin');
                  } catch (error) {
                    console.error('Logout error:', error);
                  }
                }}
                class='px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm'
              >
                Sign Out
              </button>
            </div>
          </div>
        </header>

        {/* Protected content */}
        <div>{props.children}</div>
      </div>
    </Show>
  );
}
