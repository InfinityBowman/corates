/**
 * Dashboard - Main dashboard container
 *
 * Local-first: always renders content immediately, progressively
 * enhances based on auth/subscription state.
 */

import { useState } from 'react';
import { useAuthStore, selectUser, selectIsLoggedIn } from '@/stores/authStore';
import { useSubscription } from '@/hooks/useSubscription';
import { Alert } from '@/components/ui/alert';

import { DashboardHeader } from './DashboardHeader';
import { ProjectsSection } from './ProjectsSection';
import { LocalAppraisalsSection } from './LocalAppraisalsSection';
import { useInitialAnimation, AnimationContext } from './useInitialAnimation';

export function Dashboard() {
  const animation = useInitialAnimation();

  const user = useAuthStore(selectUser);
  const isLoggedIn = useAuthStore(selectIsLoggedIn);
  const { subscriptionFetchFailed } = useSubscription();

  const [createModalOpen, setCreateModalOpen] = useState(false);

  return (
    <AnimationContext.Provider value={animation}>
      <div className='px-4 py-8 sm:px-6 lg:px-8'>
        {isLoggedIn && subscriptionFetchFailed && (
          <Alert variant='warning' className='mb-6'>
            Could not load subscription details. Some features may be limited.
          </Alert>
        )}

        <DashboardHeader user={user} />

        <div id='projects-section' className='flex flex-col gap-8'>
          {isLoggedIn && (
            <ProjectsSection
              createModalOpen={createModalOpen}
              setCreateModalOpen={setCreateModalOpen}
            />
          )}

          <LocalAppraisalsSection showHeader showSignInPrompt={!isLoggedIn} />
        </div>
      </div>
    </AnimationContext.Provider>
  );
}
