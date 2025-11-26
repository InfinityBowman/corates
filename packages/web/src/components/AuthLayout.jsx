import { createEffect, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useBetterAuth } from '../api/better-auth-store.js';

export default function AuthLayout(props) {
  const { isLoggedIn, authLoading } = useBetterAuth();
  const navigate = useNavigate();

  // Redirect to dashboard if already logged in
  createEffect(() => {
    if (!authLoading() && isLoggedIn()) {
      navigate('/dashboard', { replace: true });
    }
  });

  return (
    <div class='min-h-screen'>
      <Show when={authLoading()}>
        <div class='min-h-screen bg-blue-50 flex items-center justify-center'>
          <div class='text-center'>
            <div class='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto'></div>
            <p class='mt-4 text-gray-600'>Loading...</p>
          </div>
        </div>
      </Show>
      <Show when={!authLoading() && !isLoggedIn()}>{props.children}</Show>
    </div>
  );
}
