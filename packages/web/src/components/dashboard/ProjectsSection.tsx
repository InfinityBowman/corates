/**
 * ProjectsSection - pending invitations, then the user's projects as rows,
 * with the create and delete flows.
 */

import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderIcon, TriangleAlertIcon } from 'lucide-react';
import { useMyProjectsList } from '@/hooks/useMyProjectsList';
import { showToast } from '@/lib/toast';
import { CreateProjectModal } from '@/components/project/CreateProjectModal';
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
import { listMyPendingInvitations } from '@/server/functions/invitations.functions';
import { useAnimation } from './useInitialAnimation';
import { DashboardSection, EmptyState } from './DashboardSection';
import { ProjectRow } from './ProjectRow';
import { InvitationRow } from './InvitationRow';
import { ContactPrompt } from './ContactPrompt';
import { NewProjectButton, useProjectCreateRestriction } from './NewProjectButton';

interface ProjectsSectionProps {
  createModalOpen: boolean;
  setCreateModalOpen: (open: boolean) => void;
}

export function ProjectsSection({ createModalOpen, setCreateModalOpen }: ProjectsSectionProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const animation = useAnimation();

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { projects } = useMyProjectsList();
  const { data: invitations } = useQuery({
    queryKey: queryKeys.invitations.pendingForMe,
    queryFn: () => listMyPendingInvitations(),
  });
  const { restrictionType, projectCount, quotaLimit } = useProjectCreateRestriction();

  async function confirmDeleteProject() {
    if (!pendingDeleteId) return;

    const project = projects.find(p => p.id === pendingDeleteId);
    if (!project?.orgId) {
      showToast.error(
        'Delete failed',
        'We could not find the organization this project belongs to. Reload the page and try again.',
      );
      setPendingDeleteId(null);
      return;
    }

    setDeleteLoading(true);
    try {
      const { deleteProject } = await import('@/server/functions/org-projects.functions');
      await deleteProject({ data: { orgId: project.orgId, projectId: pendingDeleteId } });

      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.subscription.current });
      showToast.success('Project deleted', 'The project and everything in it has been removed.');
      setPendingDeleteId(null);
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(err, { toastTitle: 'Delete failed' });
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <>
      {/* Trial pitch stays prominent; the quota limit is surfaced just-in-time on the button */}
      {restrictionType === 'entitlement' && (
        <ContactPrompt
          restrictionType={restrictionType}
          projectCount={projectCount}
          quotaLimit={quotaLimit}
        />
      )}

      {invitations && invitations.length > 0 && (
        <DashboardSection
          title='Invitations'
          count={invitations.length}
          style={animation.fadeUp(100)}
        >
          {invitations.map(invitation => (
            <InvitationRow key={invitation.id} invitation={invitation} />
          ))}
        </DashboardSection>
      )}

      <DashboardSection title='Projects' count={projects.length} style={animation.fadeUp(200)}>
        {projects.length > 0 ?
          projects.map(project => (
            <ProjectRow
              key={project.id}
              project={project}
              onOpen={id => navigate({ to: `/projects/${id}` as string })}
              onDelete={setPendingDeleteId}
            />
          ))
        : <EmptyState
            icon={FolderIcon}
            title='No projects yet'
            description='A project is where you and your team appraise the same studies independently, then reconcile where you disagree.'
            action={<NewProjectButton onClick={() => setCreateModalOpen(true)} />}
          />
        }
      </DashboardSection>

      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={open => {
          if (!open && !deleteLoading) setPendingDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogIcon variant='danger'>
              <TriangleAlertIcon />
            </AlertDialogIcon>
            <div>
              <AlertDialogTitle>Delete project</AlertDialogTitle>
              <AlertDialogDescription>
                Deleting this project removes its studies, checklists, and reconciliations for
                everyone on it. This cannot be undone.
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
              {deleteLoading ? 'Deleting...' : 'Delete project'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreateProjectModal open={createModalOpen} onOpenChange={setCreateModalOpen} />
    </>
  );
}
