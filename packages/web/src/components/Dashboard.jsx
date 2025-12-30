import { Show } from 'solid-js';
import ChecklistsDashboard from '@/components/checklist/ChecklistsDashboard.jsx';
import { OrgRedirect } from '@/components/org/index.js';
import { useBetterAuth } from '@api/better-auth-store.js';

export default function Dashboard() {
  const { isLoggedIn } = useBetterAuth();

  return (
    <div class='p-6'>
      <div class='mx-auto max-w-7xl space-y-8'>
        {/* Logged-in users are redirected to their org context */}
        <Show when={isLoggedIn()}>
          <OrgRedirect />
        </Show>

        {/* Local checklists work offline and don't need org context */}
        <ChecklistsDashboard isLoggedIn={isLoggedIn()} />
      </div>
    </div>
  );
}
