/**
 * Dashboard - Main dashboard container
 *
 * Local-first: always renders content immediately, progressively
 * enhances based on auth/subscription state.
 */

import { useMemo, useState } from 'react';
import { useAuthStore, selectUser, selectIsLoggedIn } from '@/stores/authStore';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useSubscription } from '@/hooks/useSubscription';
import { useMyProjectsList } from '@/hooks/useMyProjectsList';

import { DashboardHeader } from './DashboardHeader';
import { QuickActions } from './QuickActions';
import { ActivityFeed } from './ActivityFeed';
import { ProjectsSection } from './ProjectsSection';
import { LocalAppraisalsSection } from './LocalAppraisalsSection';
import { useInitialAnimation, AnimationContext } from './useInitialAnimation';

export function Dashboard() {
  const animation = useInitialAnimation();

  const user = useAuthStore(selectUser);
  const isLoggedIn = useAuthStore(selectIsLoggedIn);
  const isOnline = useOnlineStatus();
  const { subscription, subscriptionFetchFailed, hasEntitlement, hasQuota } = useSubscription();
  const { projects } = useMyProjectsList();
  // checklists and projectStats available via child components directly

  const [createModalOpen, setCreateModalOpen] = useState(false);

  const canCreateProject = useMemo(() => {
    if (!isOnline || !isLoggedIn) return false;
    if (!hasEntitlement('project.create')) return false;
    return hasQuota('projects.max', { used: projects?.length || 0, requested: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, isLoggedIn, subscription, projects]);

  const activities = useMemo(() => {
    if (!projects?.length) return [];
    return [...projects]
      .sort(
        (a: any, b: any) =>
          new Date(b.updatedAt || b.createdAt).getTime() -
          new Date(a.updatedAt || a.createdAt).getTime(),
      )
      .slice(0, 5)
      .map((project: any) => ({
        type: 'project' as const,
        title: project.name,
        subtitle: 'was updated',
        timestamp: project.updatedAt || project.createdAt,
      }));
  }, [projects]);

  function handleCreateProject() {
    setCreateModalOpen(true);
  }

  function handleStartROBINSI() {
    window.location.href = '/checklist?type=ROBINS_I';
  }

  function handleStartAMSTAR2() {
    window.location.href = '/checklist?type=AMSTAR2';
  }

  function handleLearnMore() {
    window.location.href = '/resources';
  }

  return (
    <AnimationContext.Provider value={animation}>
      <div className='mx-auto px-4 py-8 sm:px-6 lg:px-8'>
        {/* Subscription error banner */}
        {isLoggedIn && subscriptionFetchFailed && (
          <div
            className='mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700'
            role='alert'
          >
            Could not load subscription details. Some features may be limited.
          </div>
        )}

        <DashboardHeader
          user={
            user as { name?: string; givenName?: string; persona?: string; email?: string } | null
          }
          canCreateProject={canCreateProject}
          isOnline={isOnline}
          onCreateProject={handleCreateProject}
        />

        {/* Main content grid */}
        <div className='grid gap-6 lg:grid-cols-3'>
          {/* Left column */}
          <div id='projects-section' className='space-y-6 lg:col-span-2'>
            {isLoggedIn && (
              <ProjectsSection
                createModalOpen={createModalOpen}
                setCreateModalOpen={setCreateModalOpen}
              />
            )}

            <LocalAppraisalsSection showHeader showSignInPrompt={!isLoggedIn} />
          </div>

          {/* Right sidebar */}
          <div className='space-y-6'>
            <QuickActions
              onStartROBINSI={handleStartROBINSI}
              onStartAMSTAR2={handleStartAMSTAR2}
              onLearnMore={handleLearnMore}
            />

            {isLoggedIn && <ActivityFeed activities={activities} limit={5} />}
          </div>
        </div>
      </div>
    </AnimationContext.Provider>
  );
}
