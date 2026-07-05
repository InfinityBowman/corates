/**
 * ProjectsSection - Projects grid with create and delete flows
 */

import { useState, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { PlusIcon, FolderIcon, TriangleAlertIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMyProjectsList } from '@/hooks/useMyProjectsList';
import { useSubscription } from '@/hooks/useSubscription';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { showToast } from '@/components/ui/toast';
import { CreateProjectModal } from '@/components/project/CreateProjectModal';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { queryKeys } from '@/lib/queryKeys';
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
import { ContactPrompt, getRestrictionCopy } from './ContactPrompt';

interface ProjectsSectionProps {
  showHeader?: boolean;
  createModalOpen: boolean;
  setCreateModalOpen: (open: boolean) => void;
  onCreateClick?: () => void;
}

export function ProjectsSection({
  showHeader = true,
  createModalOpen,
  setCreateModalOpen,
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
  const { hasEntitlement, hasQuota, quotas, isLoading: subscriptionLoading } = useSubscription();

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
      setCreateModalOpen(true);
    }
  }, [onCreateClick, setCreateModalOpen]);

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
      const { deleteProject } = await import('@/server/functions/org-projects.functions');
      await deleteProject({ data: { orgId: project.orgId, projectId: pendingDeleteId } });

      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      showToast.success('Project Deleted', 'The project has been deleted successfully');
      setDeleteDialogOpen(false);
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(err, { toastTitle: 'Delete Failed' });
    } finally {
      setDeleteLoading(false);
      setPendingDeleteId(null);
    }
  }, [pendingDeleteId, projects, queryClient]);

  const hasProjects = projectCount > 0;

  return (
    <section style={animation.fadeUp(200)}>
      {/* Trial pitch stays prominent; the quota limit is surfaced just-in-time on the button */}
      {restrictionType === 'entitlement' && (
        <div className='mb-4'>
          <ContactPrompt
            restrictionType={restrictionType}
            projectCount={projectCount}
            quotaLimit={quotas?.['projects.max']}
          />
        </div>
      )}

      {/* Header */}
      {showHeader && (
        <div className='mb-4 flex items-center justify-between'>
          <h2 className='text-muted-foreground text-sm font-semibold tracking-wide uppercase'>
            Your Projects
          </h2>
          {canCreateProject ?
            <Button onClick={handleCreateClick} disabled={!isOnline}>
              <PlusIcon data-icon='inline-start' />
              New Project
            </Button>
          : <Popover>
              <PopoverTrigger asChild>
                <Button disabled={!isOnline}>
                  <PlusIcon data-icon='inline-start' />
                  New Project
                </Button>
              </PopoverTrigger>
              <PopoverContent align='end'>
                <RestrictionNudge
                  restrictionType={restrictionType}
                  projectCount={projectCount}
                  quotaLimit={quotas?.['projects.max']}
                />
              </PopoverContent>
            </Popover>
          }
        </div>
      )}

      {/* Projects grid */}
      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
        {!hasProjects && (
          <div className='border-border bg-muted/50 col-span-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-16'>
            <div className='bg-secondary mb-4 flex size-16 items-center justify-center rounded-2xl'>
              <FolderIcon className='text-muted-foreground size-8 opacity-70' />
            </div>
            <h3 className='text-secondary-foreground mb-2 text-lg font-semibold'>
              No projects yet
            </h3>
            <p className='text-muted-foreground mb-6 max-w-sm text-center text-sm'>
              Create your first project to start collaborating on evidence synthesis with your team.
            </p>
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

      <CreateProjectModal open={createModalOpen} onOpenChange={setCreateModalOpen} />
    </section>
  );
}

function RestrictionNudge({
  restrictionType,
  projectCount,
  quotaLimit,
}: {
  restrictionType: 'entitlement' | 'quota' | null;
  projectCount: number;
  quotaLimit?: number | null;
}) {
  const { title, message } = getRestrictionCopy({ restrictionType, projectCount, quotaLimit });

  return (
    <div className='flex flex-col gap-3'>
      <div>
        <p className='text-popover-foreground font-medium'>{title}</p>
        <p className='text-muted-foreground mt-1 text-sm'>{message}</p>
      </div>
      <Button asChild className='w-full'>
        <a href='/pricing'>View Plans</a>
      </Button>
    </div>
  );
}
