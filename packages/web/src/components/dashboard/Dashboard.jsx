/**
 * Dashboard - Main dashboard container with state machine
 *
 * Handles multiple user states: logged-out, loading, no-plan, active, etc.
 */

import { createMemo, Show, Switch, Match, createSignal } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useBetterAuth } from '@api/better-auth-store.js';
import { useSubscription } from '@primitives/useSubscription.js';
import { useMyProjectsList } from '@primitives/useMyProjectsList.js';
import localChecklistsStore from '@/stores/localChecklistsStore';

import DashboardHeader from './DashboardHeader.jsx';
import { StatsRow } from './StatsRow.jsx';
import ProgressCard from './ProgressCard.jsx';
import QuickActions from './QuickActions.jsx';
import ActivityFeed from './ActivityFeed.jsx';
import DashboardSkeleton from './DashboardSkeleton.jsx';
import { ProjectsSection } from './ProjectsSection.jsx';
import { LocalAppraisalsSection } from './LocalAppraisalsSection.jsx';
import { LANDING_URL } from '@/config/api.js';

/**
 * Dashboard state machine
 * Determines which UI state to show based on auth/subscription status
 */
function useDashboardState() {
  const { isLoggedIn, authLoading, user, isOnline } = useBetterAuth();
  const {
    loading: subscriptionLoading,
    subscriptionFetchFailed,
    hasEntitlement,
    hasQuota,
  } = useSubscription();
  const { projects, isInitialLoading: projectsLoading } = useMyProjectsList();
  const { checklists } = localChecklistsStore;

  const state = createMemo(() => {
    if (authLoading()) return 'loading';
    if (!isLoggedIn()) return 'logged-out';
    if (subscriptionLoading() && !projects().length) return 'loading-subscription';
    if (subscriptionFetchFailed()) return 'subscription-error';
    return 'active';
  });

  const canCreateProject = createMemo(() => {
    if (!isOnline()) return false;
    if (!isLoggedIn()) return false;
    if (!hasEntitlement('project.create')) return false;
    const projectCount = projects().length;
    return hasQuota('projects.max', { used: projectCount, requested: 1 });
  });

  // Compute stats from real data
  const stats = createMemo(() => {
    const projectList = projects() || [];
    const localList = checklists() || [];

    // Calculate completed studies across all projects
    let totalStudies = 0;
    let completedStudies = 0;
    projectList.forEach(project => {
      const studies = project.studyCount || 0;
      const completed = project.completedCount || 0;
      totalStudies += studies;
      completedStudies += completed;
    });

    // Count unique team members across projects
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
    const activities = [];

    projectList.slice(0, 5).forEach(project => {
      activities.push({
        type: 'project',
        title: project.name,
        subtitle: 'was updated',
        timestamp: project.updatedAt || project.createdAt,
      });
    });

    return activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 5);
  });

  return {
    state,
    user,
    isOnline,
    isLoggedIn,
    canCreateProject,
    stats,
    activities,
    projectsLoading,
    subscriptionFetchFailed,
  };
}

export function Dashboard() {
  const navigate = useNavigate();
  const { state, user, isOnline, canCreateProject, stats, activities, subscriptionFetchFailed } =
    useDashboardState();
  const [showCreateForm, setShowCreateForm] = createSignal(false);

  const handleCreateProject = () => {
    // Trigger the project creation modal through the ProjectsPanel
    // For now, just scroll to projects section
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
    window.location.href = `${LANDING_URL}/resources`;
  };

  return (
    <Switch>
      {/* Loading state */}
      <Match when={state() === 'loading'}>
        <DashboardSkeleton />
      </Match>

      {/* Logged out state */}
      <Match when={state() === 'logged-out'}>
        <div class='mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8'>
          <DashboardHeader isOnline={isOnline()} onCreateProject={handleCreateProject} />

          {/* Main content grid */}
          <div class='grid gap-6 lg:grid-cols-3'>
            {/* Left column - Local appraisals */}
            <div class='lg:col-span-2'>
              <LocalAppraisalsSection showHeader={true} showSignInPrompt={true} />
            </div>

            {/* Right sidebar */}
            <div class='space-y-6'>
              <QuickActions
                onStartROBINSI={handleStartROBINSI}
                onStartAMSTAR2={handleStartAMSTAR2}
                onLearnMore={handleLearnMore}
                canCreate={true}
              />
            </div>
          </div>
        </div>
      </Match>

      {/* Active state (logged in) */}
      <Match when={state() === 'active' || state() === 'loading-subscription'}>
        <div class='mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8'>
          {/* Subscription error banner */}
          <Show when={subscriptionFetchFailed()}>
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

          <StatsRow
            projectCount={stats().projectCount}
            completedStudies={stats().completedStudies}
            totalStudies={stats().totalStudies}
            localAppraisalCount={stats().localAppraisalCount}
            teamMemberCount={stats().teamMemberCount}
          />

          {/* Main content grid */}
          <div class='grid gap-6 lg:grid-cols-3'>
            {/* Left column - Projects and Local appraisals */}
            <div id='projects-section' class='space-y-6 lg:col-span-2'>
              <ProjectsSection
                showCreateForm={showCreateForm}
                setShowCreateForm={setShowCreateForm}
              />
              <LocalAppraisalsSection showHeader={true} />
            </div>

            {/* Right sidebar */}
            <div class='space-y-6'>
              <ProgressCard
                completed={stats().completedStudies}
                total={stats().totalStudies}
                subtitle='Studies across all projects'
              />

              <QuickActions
                onStartROBINSI={handleStartROBINSI}
                onStartAMSTAR2={handleStartAMSTAR2}
                onLearnMore={handleLearnMore}
                canCreate={canCreateProject()}
              />

              <ActivityFeed activities={activities()} limit={5} />
            </div>
          </div>
        </div>
      </Match>

      {/* Subscription error fallback */}
      <Match when={state() === 'subscription-error'}>
        <div class='mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8'>
          <DashboardHeader
            user={user()}
            isOnline={isOnline()}
            onCreateProject={handleCreateProject}
          />

          <div class='mb-6 rounded-lg border border-red-200 bg-red-50 p-4'>
            <p class='text-sm text-red-800'>
              Unable to load your subscription. Please try refreshing the page.
            </p>
          </div>

          {/* Still show content */}
          <div class='grid gap-6 lg:grid-cols-3'>
            <div class='space-y-6 lg:col-span-2'>
              <ProjectsSection
                showCreateForm={showCreateForm}
                setShowCreateForm={setShowCreateForm}
              />
              <LocalAppraisalsSection showHeader={true} />
            </div>
            <div class='space-y-6'>
              <QuickActions
                onStartROBINSI={handleStartROBINSI}
                onStartAMSTAR2={handleStartAMSTAR2}
                onLearnMore={handleLearnMore}
                canCreate={false}
              />
            </div>
          </div>
        </div>
      </Match>
    </Switch>
  );
}

export default Dashboard;
