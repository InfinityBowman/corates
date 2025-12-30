/**
 * OrgProjectsPage - Shows projects list for an organization
 *
 * Displays org header, projects grid, and create project functionality.
 */

import { createSignal, Show, For } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useOrgContext } from '@primitives/useOrgContext.js';
import { useOrgProjectList } from '@primitives/useOrgProjectList.js';
import { useBetterAuth } from '@api/better-auth-store.js';
import { useSubscription } from '@primitives/useSubscription.js';
import { useQueryClient } from '@tanstack/solid-query';
import { useConfirmDialog, showToast } from '@corates/ui';
import { API_BASE } from '@config/api.js';
import { queryKeys } from '@lib/queryKeys.js';
import { isUnlimitedQuota } from '@corates/shared/plans';
import ProjectCard from '@/components/project/ProjectCard.jsx';
import CreateProjectForm from '@/components/project/CreateProjectForm.jsx';
import ContactPrompt from '@/components/project/ContactPrompt.jsx';
import projectStore from '@/stores/projectStore.js';

export default function OrgProjectsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const confirmDialog = useConfirmDialog();
  const { isOnline } = useBetterAuth();

  // Org context from URL
  const {
    orgId,
    orgSlug,
    orgName,
    currentOrg,
    isLoading: orgLoading,
    orgNotFound,
  } = useOrgContext();

  // Projects for this org
  const projectListQuery = useOrgProjectList(orgId);
  const projects = () => projectListQuery.projects();
  const projectCount = () => projects()?.length || 0;

  // Subscription/quota checks
  const { hasEntitlement, hasQuota, quotas, loading: subscriptionLoading } = useSubscription();

  const [showCreateForm, setShowCreateForm] = createSignal(false);

  // Check both entitlement and quota
  const canCreateProject = () => {
    if (subscriptionLoading()) return null;
    return (
      hasEntitlement('project.create') &&
      hasQuota('projects.max', { used: projectCount(), requested: 1 })
    );
  };

  const restrictionType = () => {
    if (subscriptionLoading()) return null;
    return !hasEntitlement('project.create') ? 'entitlement' : 'quota';
  };

  const quotaLimit = () => {
    const limit = quotas()['projects.max'];
    return isUnlimitedQuota(limit) ? -1 : limit;
  };

  // Handle project creation
  const handleProjectCreated = (
    newProject,
    pendingPdfs = [],
    pendingRefs = [],
    driveFiles = [],
  ) => {
    // Invalidate project list for this org
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.byOrg(orgId()) });

    // Store pending data for the project view
    if (pendingPdfs.length > 0 || pendingRefs.length > 0 || driveFiles.length > 0) {
      projectStore.setPendingProjectData(newProject.id, { pendingPdfs, pendingRefs, driveFiles });
    }

    setShowCreateForm(false);
    navigate(`/orgs/${orgSlug()}/projects/${newProject.id}`);
  };

  // Open a project
  const openProject = projectId => {
    navigate(`/orgs/${orgSlug()}/projects/${projectId}`);
  };

  // Delete a project
  const handleDeleteProject = async targetProjectId => {
    const confirmed = await confirmDialog.open({
      title: 'Delete Project',
      description:
        'Are you sure you want to delete this entire project? This action cannot be undone.',
      confirmText: 'Delete Project',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      const response = await fetch(`${API_BASE}/api/orgs/${orgId()}/projects/${targetProjectId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete project');
      }

      queryClient.invalidateQueries({ queryKey: queryKeys.projects.byOrg(orgId()) });
      showToast.success('Project Deleted', 'The project has been deleted successfully');
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils.js');
      await handleError(err, { toastTitle: 'Delete Failed' });
    }
  };

  // Loading state
  const isLoading = () => orgLoading() || projectListQuery.isLoading();

  return (
    <div class='p-6'>
      <div class='mx-auto max-w-7xl space-y-6'>
        {/* Org not found */}
        <Show when={orgNotFound() && !orgLoading()}>
          <div class='rounded-lg border border-amber-200 bg-amber-50 p-6 text-center'>
            <h2 class='text-lg font-semibold text-amber-800'>Organization Not Found</h2>
            <p class='mt-2 text-amber-700'>
              The organization you're looking for doesn't exist or you don't have access.
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              class='mt-4 rounded-lg bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700'
            >
              Go to Dashboard
            </button>
          </div>
        </Show>

        {/* Main content */}
        <Show when={!orgNotFound()}>
          {/* Header */}
          <div class='flex flex-wrap items-center justify-between gap-4'>
            <div>
              <h1 class='text-2xl font-bold text-gray-900'>{orgName() || 'Projects'}</h1>
              <p class='mt-1 text-gray-500'>
                {currentOrg()?.slug ? `@${currentOrg().slug}` : 'Manage your research projects'}
              </p>
            </div>

            {/* Create button or quota prompt */}
            <Show
              when={canCreateProject() !== null}
              fallback={<div class='h-10 w-32 animate-pulse rounded-lg bg-gray-200' />}
            >
              <Show
                when={canCreateProject()}
                fallback={
                  <div class='max-w-sm'>
                    <ContactPrompt
                      restrictionType={restrictionType()}
                      projectCount={projectCount()}
                      quotaLimit={quotaLimit()}
                    />
                  </div>
                }
              >
                <button
                  class='inline-flex transform items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white shadow-md transition-all duration-200 hover:scale-[1.02] hover:bg-blue-700 hover:shadow-lg focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100'
                  onClick={() => setShowCreateForm(!showCreateForm())}
                  disabled={!isOnline()}
                  title={!isOnline() ? 'Cannot create projects while offline' : ''}
                >
                  <span class='text-lg'>+</span>
                  New Project
                </button>
              </Show>
            </Show>
          </div>

          {/* Error display */}
          <Show when={projectListQuery.isError()}>
            <div class='rounded-lg border border-red-200 bg-red-50 p-4 text-red-700'>
              {projectListQuery.error()?.message || 'An error occurred'}
              <button onClick={() => projectListQuery.refetch()} class='ml-2 underline'>
                Retry
              </button>
            </div>
          </Show>

          {/* Create Project Form */}
          <Show when={showCreateForm()}>
            <CreateProjectForm
              apiBase={API_BASE}
              orgId={orgId()}
              onProjectCreated={handleProjectCreated}
              onCancel={() => setShowCreateForm(false)}
            />
          </Show>

          {/* Projects Grid */}
          <div class='grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
            <Show
              when={projects()?.length > 0}
              fallback={
                <Show when={!isLoading()}>
                  <div class='col-span-full rounded-lg border-2 border-dashed border-gray-300 bg-white px-6 py-12'>
                    <div class='text-center text-gray-500'>No projects yet</div>
                    <Show when={canCreateProject()}>
                      <div class='flex justify-center'>
                        <button
                          onClick={() => setShowCreateForm(true)}
                          class='mt-4 font-medium text-blue-600 hover:text-blue-700'
                        >
                          Create your first project
                        </button>
                      </div>
                    </Show>
                  </div>
                </Show>
              }
            >
              <For each={projects()}>
                {project => (
                  <ProjectCard
                    project={project}
                    onOpen={openProject}
                    onDelete={handleDeleteProject}
                  />
                )}
              </For>
            </Show>

            {/* Loading state */}
            <Show when={isLoading()}>
              <div class='col-span-full py-12 text-center'>
                <div class='text-gray-400'>Loading projects...</div>
              </div>
            </Show>
          </div>
        </Show>

        <confirmDialog.ConfirmDialogComponent />
      </div>
    </div>
  );
}
