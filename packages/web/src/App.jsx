import { Show } from 'solid-js';
import ProjectDashboard from './components/ProjectDashboard.jsx';
import { useBetterAuth } from './api/better-auth-store.js';

export default function App() {
  const { user, authLoading, isLoggedIn } = useBetterAuth();

  const API_BASE = import.meta.env.VITE_WORKER_API_URL || 'http://localhost:8787';

  return (
    <div class='min-h-screen'>
      <main class='p-6'>
        <div class='max-w-6xl mx-auto'>
          <Show
            when={!authLoading() && isLoggedIn() && user()}
            fallback={
              <div class='text-center py-8'>
                <div class='text-gray-500'>Loading user data...</div>
              </div>
            }
          >
            <ProjectDashboard apiBase={API_BASE} userId={user().id} />
          </Show>
        </div>
      </main>
    </div>
  );
}
