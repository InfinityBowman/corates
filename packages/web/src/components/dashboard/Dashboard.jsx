/**
 * Dashboard - Main dashboard container
 *
 * Local-first approach: Always render content immediately, progressively
 * enhance based on auth/subscription state. Never show loading states
 * if we have any data to display.
 */

import { createMemo, Show, createSignal, createContext } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useBetterAuth } from '@api/better-auth-store.js';
import { useSubscription } from '@primitives/useSubscription.js';
import { useMyProjectsList } from '@primitives/useMyProjectsList.js';
import localChecklistsStore from '@/stores/localChecklistsStore';
import projectStore from '@/stores/projectStore.js';

import DashboardHeader from './DashboardHeader.jsx';
import { StatsRow } from './StatsRow.jsx';
import ProgressCard from './ProgressCard.jsx';
import QuickActions from './QuickActions.jsx';
import ActivityFeed from './ActivityFeed.jsx';
import { ProjectsSection } from './ProjectsSection.jsx';
import { LocalAppraisalsSection } from './LocalAppraisalsSection.jsx';
import { useInitialAnimation } from './useInitialAnimation.js';

// Animation context - allows child components to access animation state
export const AnimationContext = createContext({
  shouldAnimate: () => false,
  fadeUp: () => ({}),
  statRise: () => ({}),
});

/**
 * Dashboard data hook - computes derived state from auth/subscription/projects
 * All signals are fine-grained and won't cause full re-renders
 */
function useDashboardData() {
  const { isLoggedIn, user, isOnline } = useBetterAuth();
  const { subscriptionFetchFailed, hasEntitlement, hasQuota } = useSubscription();
  const { projects } = useMyProjectsList();
  const { checklists } = localChecklistsStore;

  const canCreateProject = createMemo(() => {
    if (!isOnline()) return false;
    if (!isLoggedIn()) return false;
    if (!hasEntitlement('project.create')) return false;
    const projectCount = projects().length;
    return hasQuota('projects.max', { used: projectCount, requested: 1 });
  });

  // Compute stats from real data, merging cached Yjs stats
  const stats = createMemo(() => {
    const projectList = projects() || [];
    const localList = checklists() || [];

    let totalStudies = 0;
    let completedStudies = 0;
    projectList.forEach(project => {
      // Priority: cached stats from projectStore (Yjs data) > API props > 0
      const cachedStats = projectStore.getProjectStats(project.id);
      totalStudies += cachedStats?.studyCount ?? project.studyCount ?? 0;
      completedStudies += cachedStats?.completedCount ?? project.completedCount ?? 0;
    });

    const memberIds = new Set();
    projectList.forEach(project => {
      if (project.members) {
        project.members.forEach(m => memberIds.add(m.userId || m.id));
      }
    });

    return {
      projectCount: projectList.length,
      completedStudies,
      totalStudies,
      localAppraisalCount: localList.length,
      teamMemberCount: memberIds.size || undefined,
    };
  });

  // Generate recent activity from projects
  const activities = createMemo(() => {
    const projectList = projects() || [];
    return projectList
      .slice(0, 5)
      .map(project => ({
        type: 'project',
        title: project.name,
        subtitle: 'was updated',
        timestamp: project.updatedAt || project.createdAt,
      }))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 5);
  });

  return {
    user,
    isOnline,
    isLoggedIn,
    canCreateProject,
    stats,
    activities,
    subscriptionFetchFailed,
  };
}

export function Dashboard() {
  const navigate = useNavigate();
  const animation = useInitialAnimation();
  const {
    user,
    isOnline,
    isLoggedIn,
    canCreateProject,
    stats,
    activities,
    subscriptionFetchFailed,
  } = useDashboardData();
  const [showCreateForm, setShowCreateForm] = createSignal(false);

  const handleCreateProject = () => {
    document.getElementById('projects-section')?.scrollIntoView({ behavior: 'smooth' });
    setShowCreateForm(true);
  };

  const handleStartROBINSI = () => {
    navigate('/checklist?type=ROBINS_I');
  };

  const handleStartAMSTAR2 = () => {
    navigate('/checklist?type=AMSTAR2');
  };

  const handleLearnMore = () => {
    navigate('/resources');
  };

  return (
    <AnimationContext.Provider value={animation}>
      <div class='mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8'>
        {/* Subscription error banner - only for logged in users */}
        <Show when={isLoggedIn() && subscriptionFetchFailed()}>
          <div
            class='mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800'
            role='alert'
          >
            Could not load subscription details. Some features may be limited.
          </div>
        </Show>

        <DashboardHeader
          user={user()}
          canCreateProject={canCreateProject()}
          isOnline={isOnline()}
          onCreateProject={handleCreateProject}
        />

        {/* Stats row - only for logged in users */}
        <Show when={isLoggedIn()}>
          <StatsRow
            projectCount={stats().projectCount}
            completedStudies={stats().completedStudies}
            totalStudies={stats().totalStudies}
            localAppraisalCount={stats().localAppraisalCount}
            teamMemberCount={stats().teamMemberCount}
          />
        </Show>

        {/* Main content grid */}
        <div class='grid gap-6 lg:grid-cols-3'>
          {/* Left column */}
          <div id='projects-section' class='space-y-6 lg:col-span-2'>
            {/* Projects - only for logged in users */}
            <Show when={isLoggedIn()}>
              <ProjectsSection
                showCreateForm={showCreateForm}
                setShowCreateForm={setShowCreateForm}
              />
            </Show>

            {/* Local appraisals - always shown */}
            <LocalAppraisalsSection showHeader={true} showSignInPrompt={!isLoggedIn()} />
          </div>

          {/* Right sidebar */}
          <div class='space-y-6'>
            {/* Progress card - only for logged in users */}
            <Show when={isLoggedIn()}>
              <ProgressCard
                completed={stats().completedStudies}
                total={stats().totalStudies}
                subtitle='Studies across all projects'
              />
            </Show>

            <QuickActions
              onStartROBINSI={handleStartROBINSI}
              onStartAMSTAR2={handleStartAMSTAR2}
              onLearnMore={handleLearnMore}
            />

            {/* Activity feed - only for logged in users */}
            <Show when={isLoggedIn()}>
              <ActivityFeed activities={activities()} limit={5} />
            </Show>
          </div>
        </div>
      </div>
    </AnimationContext.Provider>
  );
}

export default Dashboard;
