/**
 * ProjectsPanel - Reusable projects list UI component
 *
 * Can be embedded in dashboard or used standalone.
 * Shows projects grid, create project functionality, and subscription/quota handling.
 */

import { createSignal, Show, For } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useMyProjectsList } from '@primitives/useMyProjectsList.js';
import { useBetterAuth } from '@api/better-auth-store.js';
import { useSubscription } from '@primitives/useSubscription.js';
import { useQueryClient } from '@tanstack/solid-query';
import { showToast } from '@/components/ui/toast';
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogPositioner,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogIcon,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { API_BASE } from '@config/api.js';
import { queryKeys } from '@lib/queryKeys.js';
import ProjectCard from '@/components/project/ProjectCard.jsx';
import CreateProjectForm from '@/components/project/CreateProjectForm.jsx';
import ContactPrompt from '@/components/project/ContactPrompt.jsx';
import projectStore from '@/stores/projectStore.js';

export default function ProjectsPanel() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isOnline } = useBetterAuth();

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = createSignal(false);
  const [pendingDeleteId, setPendingDeleteId] = createSignal(null);
  const [deleteLoading, setDeleteLoading] = createSignal(false);

  // Projects for current user
  const projectListQuery = useMyProjectsList();
  const projects = () => projectListQuery.projects();
  const projectCount = () => projects()?.length || 0;

  // Subscription/quota checks
  const {
    hasEntitlement,
    hasQuota,
    quotas,
    loading: subscriptionLoading,
    subscriptionFetchFailed,
    refetch: refetchSubscription,
  } = useSubscription();

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

  // Handle project creation
  const handleProjectCreated = (
    newProject,
    pendingPdfs = [],
    pendingRefs = [],
    driveFiles = [],
  ) => {
    // Invalidate project list
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });

    // Store pending data for the project view
    if (pendingPdfs.length > 0 || pendingRefs.length > 0 || driveFiles.length > 0) {
      projectStore.setPendingProjectData(newProject.id, { pendingPdfs, pendingRefs, driveFiles });
    }

    setShowCreateForm(false);
    navigate(`/projects/${newProject.id}`);
  };

  // Open a project
  const openProject = projectId => {
    navigate(`/projects/${projectId}`);
  };

  // Opens delete confirmation dialog
  const handleDeleteProject = targetProjectId => {
    setPendingDeleteId(targetProjectId);
    setDeleteDialogOpen(true);
  };

  // Executes delete after confirmation
  const confirmDeleteProject = async () => {
    const targetProjectId = pendingDeleteId();
    const project = projects()?.find(p => p.id === targetProjectId);
    if (!project?.orgId) {
      showToast.error('Error', 'Unable to find project organization');
      setDeleteDialogOpen(false);
      return;
    }

    setDeleteLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/api/orgs/${project.orgId}/projects/${targetProjectId}`,
        {
          method: 'DELETE',
          credentials: 'include',
        },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete project');
      }

      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      showToast.success('Project Deleted', 'The project has been deleted successfully');
      setDeleteDialogOpen(false);
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils.js');
      await handleError(err, { toastTitle: 'Delete Failed' });
    } finally {
      setDeleteLoading(false);
    }
  };

  // Loading state - only true when there's no data yet (initial load)
  const isLoading = () => projectListQuery.isInitialLoading();
  const hasData = () => projects()?.length > 0;

  return (
    <div class='space-y-6'>
      {/* Header */}
      <div class='flex flex-wrap items-center justify-between gap-4'>
        <div>
          <h1 class='text-2xl font-bold text-gray-900'>Projects</h1>
          <p class='mt-1 text-gray-500'>Manage your research projects</p>
        </div>

        {/* Create button or quota prompt */}
        <Show
          when={canCreateProject()}
          fallback={
            <ContactPrompt
              restrictionType={restrictionType()}
              projectCount={projectCount()}
              quotaLimit={quotas()?.['projects.max']}
            />
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
      </div>

      {/* Subscription fetch error banner */}
      <Show when={subscriptionFetchFailed()}>
        <div class='flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800'>
          <div>
            <span class='font-medium'>Unable to verify subscription.</span>{' '}
            <span class='text-amber-700'>Some features may be restricted.</span>
          </div>
          <button
            onClick={() => refetchSubscription()}
            class='rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700'
          >
            Retry
          </button>
        </div>
      </Show>

      {/* Project list error display */}
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
          onProjectCreated={handleProjectCreated}
          onCancel={() => setShowCreateForm(false)}
        />
      </Show>

      {/* Projects Grid */}
      <div class='grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
        <Show
          when={hasData()}
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
              <ProjectCard project={project} onOpen={openProject} onDelete={handleDeleteProject} />
            )}
          </For>
        </Show>

        {/* Loading state - only show when there's no existing data */}
        <Show when={isLoading() && !hasData()}>
          <div class='col-span-full py-12 text-center'>
            <div class='text-gray-400'>Loading projects...</div>
          </div>
        </Show>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen()} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogBackdrop />
        <AlertDialogPositioner>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogIcon variant="danger" />
              <div>
                <AlertDialogTitle>Delete Project</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this entire project? This action cannot be undone.
                </AlertDialogDescription>
              </div>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteLoading()}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="danger"
                disabled={deleteLoading()}
                onClick={confirmDeleteProject}
              >
                {deleteLoading() ? 'Deleting...' : 'Delete Project'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogPositioner>
      </AlertDialog>
    </div>
  );
}
