import { createEffect, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import ChecklistsDashboard from '@/components/checklist/ChecklistsDashboard.jsx';
import { useBetterAuth } from '@api/better-auth-store.js';

export default function Dashboard() {
  const { isLoggedIn, authLoading } = useBetterAuth();
  const navigate = useNavigate();

  // Redirect logged-in users to projects page
  createEffect(() => {
    if (isLoggedIn() && !authLoading()) {
      navigate('/projects', { replace: true });
    }
  });

  return (
    <div class='p-6'>
      <div class='mx-auto max-w-7xl space-y-8'>
        {/* Show sign-in prompt for guests */}
        <Show when={!isLoggedIn() && !authLoading()}>
          <div class='text-center'>
            <h2 class='mb-2 text-xl font-semibold text-gray-900'>Welcome to CoRATES</h2>
            <p class='mb-4 text-gray-600'>Sign in to access your projects</p>
            <a
              href='/signin'
              class='inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700'
            >
              Sign In
            </a>
          </div>
        </Show>

        {/* Local checklists work offline and don't need org context */}
        <ChecklistsDashboard isLoggedIn={isLoggedIn()} />
      </div>
    </div>
  );
}
