import { Show } from 'solid-js';
import ProjectDashboard from '@project-ui/ProjectDashboard.jsx';
import ChecklistsDashboard from '@checklist-ui/ChecklistsDashboard.jsx';
import { useBetterAuth } from '@/api/betterAuthStore.js';
import { API_BASE } from '@config/api.js';

export default function Dashboard() {
  const { user, isLoggedIn } = useBetterAuth();

  return (
    <div class='p-6'>
      <div class='mx-auto max-w-7xl space-y-8'>
        <Show when={isLoggedIn()}>
          <ProjectDashboard apiBase={API_BASE} userId={user()?.id} />
        </Show>
        <ChecklistsDashboard isLoggedIn={isLoggedIn()} />
      </div>
    </div>
  );
}
