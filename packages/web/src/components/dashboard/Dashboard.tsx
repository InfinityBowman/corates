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
import { useInitialAnimation, AnimationContext } from './useInitialAnimation';

const WELCOME_DISMISSED_KEY = 'corates-welcome-dismissed';

export function Dashboard() {
  const animation = useInitialAnimation();

  const user = useAuthStore(selectUser);
  const isLoggedIn = useAuthStore(selectIsLoggedIn);
  const { subscriptionFetchFailed } = useSubscription();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [welcomeDismissed, setWelcomeDismissed] = useState(() => {
    try {
      return localStorage.getItem(WELCOME_DISMISSED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const dismissWelcome = () => {
    try {
      localStorage.setItem(WELCOME_DISMISSED_KEY, 'true');
    } catch {
      // localStorage unavailable
    }
    setWelcomeDismissed(true);
  };

  const showWelcomeCard = isLoggedIn && !welcomeDismissed;

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

        {showWelcomeCard && (
          <WelcomeCard user={user!} onDismiss={dismissWelcome} style={animation.fadeUp(0)} />
        )}

        {isLoggedIn && (
          <ProjectsSection
            createModalOpen={createModalOpen}
            setCreateModalOpen={setCreateModalOpen}
          />
        )}
        <LocalAppraisalsSection showSignInPrompt={!isLoggedIn} />
      </div>
    </AnimationContext.Provider>
  );
}
