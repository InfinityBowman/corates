/**
 * Dashboard - the Home page
 *
 * Local-first: always renders content immediately, progressively
 * enhances based on auth/subscription state.
 */

import { useState } from 'react';
import { useAuthStore, selectUser, selectIsLoggedIn } from '@/stores/authStore';
import { useSubscription } from '@/hooks/useSubscription';
import { Alert } from '@/components/ui/alert';

import { DashboardHeader } from './DashboardHeader';
import { WelcomeCard } from './WelcomeCard';
import { ProjectsSection } from './ProjectsSection';
import { LocalAppraisalsSection } from './LocalAppraisalsSection';
import { FeedbackPrompt } from './FeedbackPrompt';
import { useInitialAnimation, AnimationContext } from './useInitialAnimation';

export function Dashboard() {
  const animation = useInitialAnimation();

  const user = useAuthStore(selectUser);
  const isLoggedIn = useAuthStore(selectIsLoggedIn);
  const { subscriptionFetchFailed } = useSubscription();

  const [createModalOpen, setCreateModalOpen] = useState(false);

  return (
    <AnimationContext.Provider value={animation}>
      <DashboardHeader onNewProject={() => setCreateModalOpen(true)} />

      <div className='mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-6'>
        {isLoggedIn && subscriptionFetchFailed && (
          <Alert variant='warning'>
            We could not load your plan details. Some features may be unavailable until you reload
            the page.
          </Alert>
        )}

        {isLoggedIn && <WelcomeCard user={user!} style={animation.fadeUp(0)} />}

        {isLoggedIn && (
          <ProjectsSection
            createModalOpen={createModalOpen}
            setCreateModalOpen={setCreateModalOpen}
          />
        )}
        <LocalAppraisalsSection showSignInPrompt={!isLoggedIn} />

        {isLoggedIn && <FeedbackPrompt style={animation.fadeUp(400)} />}
      </div>
    </AnimationContext.Provider>
  );
}
