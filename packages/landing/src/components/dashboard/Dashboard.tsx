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
import { useMyProjectsList, type Project } from '@/hooks/useMyProjectsList';
import { Alert } from '@/components/ui/alert';

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
  const { subscriptionFetchFailed, hasEntitlement, hasQuota } = useSubscription();
  const { projects } = useMyProjectsList();
  // checklists and projectStats available via child components directly

  const [createModalOpen, setCreateModalOpen] = useState(false);

  const canCreateProject = useMemo(() => {
    if (!isOnline || !isLoggedIn) return false;
    if (!hasEntitlement('project.create')) return false;
    return hasQuota('projects.max', { used: projects?.length || 0, requested: 1 });
  }, [isOnline, isLoggedIn, projects, hasEntitlement, hasQuota]);

  const activities = useMemo(() => {
    if (!projects?.length) return [];
    return [...projects]
      .sort(
        (a: Project, b: Project) =>
          new Date(b.updatedAt || b.createdAt || 0).getTime() -
          new Date(a.updatedAt || a.createdAt || 0).getTime(),
      )
      .slice(0, 5)
      .map((project: Project) => ({
        type: 'project' as const,
        title: project.name,
        subtitle: 'was updated',
        timestamp: project.updatedAt || project.createdAt || 0,
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
          <Alert variant='warning' className='mb-6'>
            Could not load subscription details. Some features may be limited.
          </Alert>
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
