/**
 * ProjectsSection - Projects grid with create and delete flows
 */

import { useState, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { PlusIcon, FolderIcon, TriangleAlertIcon } from 'lucide-react';
import { useMyProjectsList } from '@/hooks/useMyProjectsList';
import { useSubscription } from '@/hooks/useSubscription';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { showToast } from '@/components/ui/toast';
import { queryKeys } from '@/lib/queryKeys.js';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogIcon,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAnimation } from './useInitialAnimation';
import { ProjectCard } from './ProjectCard';
import { ContactPrompt } from './ContactPrompt';

/* eslint-disable no-unused-vars */
interface ProjectsSectionProps {
  showHeader?: boolean;
  createModalOpen: boolean;
  setCreateModalOpen: (open: boolean) => void;
  onCreateClick?: () => void;
}
/* eslint-enable no-unused-vars */

export function ProjectsSection({
  showHeader = true,
  createModalOpen: _createModalOpen,
  setCreateModalOpen: _setCreateModalOpen,
  onCreateClick,
}: ProjectsSectionProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const animation = useAnimation();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { projects } = useMyProjectsList();
  const { hasEntitlement, hasQuota, quotas, loading: subscriptionLoading } = useSubscription();

  const projectCount = projects?.length || 0;

  // Local-first: assume user can create unless we know they can't
  const canCreateProject =
    subscriptionLoading ? true : (
      hasEntitlement('project.create') &&
      hasQuota('projects.max', { used: projectCount, requested: 1 })
    );

  const restrictionType: 'entitlement' | 'quota' | null =
    subscriptionLoading ? null
    : !hasEntitlement('project.create') ? 'entitlement'
    : !hasQuota('projects.max', { used: projectCount, requested: 1 }) ? 'quota'
    : null;

  const handleCreateClick = useCallback(() => {
    if (onCreateClick) {
      onCreateClick();
    } else {
      // Stub: show toast until CreateProjectModal is migrated
      showToast.info('Coming Soon', 'Project creation will be available after full migration');
    }
  }, [onCreateClick]);

  const openProject = useCallback(
    (projectId: string) => {
      navigate({ to: `/projects/${projectId}` as string });
    },
    [navigate],
  );

  const handleDeleteProject = useCallback((targetProjectId: string) => {
    setPendingDeleteId(targetProjectId);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDeleteProject = useCallback(async () => {
    if (!pendingDeleteId) {
      setDeleteDialogOpen(false);
      return;
    }

    const project = projects?.find(p => p.id === pendingDeleteId);
    if (!project?.orgId) {
      showToast.error('Error', 'Unable to find project organization');
      setDeleteDialogOpen(false);
      return;
    }

    setDeleteLoading(true);
    try {
      const { apiFetch } = await import('@/lib/apiFetch.js');
      await apiFetch(`/api/orgs/${project.orgId}/projects/${pendingDeleteId}`, {
        method: 'DELETE',
        toastMessage: 'Delete Failed',
      });

      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      showToast.success('Project Deleted', 'The project has been deleted successfully');
      setDeleteDialogOpen(false);
    } catch {
      // apiFetch already showed the toast via toastMessage
    } finally {
      setDeleteLoading(false);
      setPendingDeleteId(null);
    }
  }, [pendingDeleteId, projects, queryClient]);

  const hasProjects = projectCount > 0;

  return (
    <section style={animation.fadeUp(200)}>
      {/* Contact prompt for users who can't create projects */}
      {!subscriptionLoading && !canCreateProject && (
        <div className='mb-4'>
          <ContactPrompt
            restrictionType={restrictionType}
            projectCount={projectCount}
            quotaLimit={(quotas as any)?.['projects.max']}
          />
        </div>
      )}

      {/* Header */}
      {showHeader && (
        <div className='mb-4 flex items-center justify-between'>
          <h2 className='text-muted-foreground text-sm font-semibold tracking-wide uppercase'>
            Your Projects
          </h2>
          {canCreateProject && hasProjects && (
            <button
              type='button'
              onClick={handleCreateClick}
              disabled={!isOnline}
              className='text-primary hover:bg-primary/5 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all hover:scale-105 hover:shadow-sm active:scale-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100'
            >
              <PlusIcon className='h-4 w-4' />
              New Project
            </button>
          )}
        </div>
      )}

      {/* Projects grid */}
      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
        {!hasProjects && (
          <div className='border-border bg-muted/50 col-span-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-16'>
            <div className='bg-secondary mb-4 flex h-16 w-16 items-center justify-center rounded-2xl'>
              <FolderIcon className='text-muted-foreground/70 h-8 w-8' />
            </div>
            <h3 className='text-secondary-foreground mb-2 text-lg font-semibold'>
              No projects yet
            </h3>
            <p className='text-muted-foreground mb-6 max-w-sm text-center text-sm'>
              Create your first project to start collaborating on evidence synthesis with your team.
            </p>
            {canCreateProject && (
              <button
                type='button'
                onClick={handleCreateClick}
                disabled={!isOnline}
                className='bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium shadow-lg transition-all hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50'
              >
                <PlusIcon className='h-4 w-4' />
                Create First Project
              </button>
            )}
          </div>
        )}

        {projects?.map((project, index) => (
          <ProjectCard
            key={project.id}
            project={project}
            onOpen={openProject}
            onDelete={handleDeleteProject}
            style={animation.statRise(index * 50)}
          />
        ))}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogIcon variant='danger'>
              <TriangleAlertIcon />
            </AlertDialogIcon>
            <div>
              <AlertDialogTitle>Delete Project</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this entire project? This action cannot be undone.
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant='destructive'
              disabled={deleteLoading}
              onClick={confirmDeleteProject}
            >
              {deleteLoading ? 'Deleting...' : 'Delete Project'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
