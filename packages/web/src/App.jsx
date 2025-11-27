import { Show } from 'solid-js';
import ProjectDashboard from '@components/ProjectDashboard.jsx';
import LocalChecklistsDashboard from '@components/LocalChecklistsDashboard.jsx';
import { useBetterAuth } from '@api/better-auth-store.js';

export default function App() {
  const { user, authLoading, isLoggedIn } = useBetterAuth();

  const API_BASE = import.meta.env.VITE_WORKER_API_URL || 'http://localhost:8787';

  return (
    <div class='min-h-screen'>
      <main class='p-6'>
        <div class='max-w-6xl mx-auto space-y-8'>
          <Show when={!authLoading()}>
            <Show when={isLoggedIn()}>
              <ProjectDashboard apiBase={API_BASE} userId={user() ? user().id : null} />
            </Show>
            <LocalChecklistsDashboard isLoggedIn={isLoggedIn()} />
          </Show>
        </div>
      </main>
    </div>
  );
}
