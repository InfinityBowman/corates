import { Show } from 'solid-js';
import ProjectsPanel from '@/components/project/ProjectsPanel.jsx';
import LocalAppraisalsPanel from '@/components/checklist/LocalAppraisalsPanel.jsx';
import { useBetterAuth } from '@api/better-auth-store.js';

export default function Dashboard() {
  const { isLoggedIn, authLoading } = useBetterAuth();

  return (
    <div class='p-6'>
      <div class='mx-auto max-w-7xl space-y-8'>
        {/* Projects section - only shown when logged in */}
        <Show when={isLoggedIn() && !authLoading()}>
          <ProjectsPanel />
        </Show>

        {/* Local Appraisals Section - always shown */}
        <LocalAppraisalsPanel showHeader={true} showSignInPrompt={!isLoggedIn()} />
      </div>
    </div>
  );
}
