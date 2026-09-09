import { useState, useCallback } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { Trash2Icon } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAdminProjectDetails, useAdminWorkspaceStats } from '@/hooks/useAdminQueries';
import { removeProjectMember, deleteProject } from '@/stores/adminStore';
import { showToast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { handleError } from '@/lib/error-utils';
import { queryKeys } from '@/lib/queryKeys';
import { AdminError, AdminPage, AdminPanel } from '@/components/admin/ui';
import type { ProjectData, WorkspaceStats, ProjectMember } from '@/components/admin/projects/types';
import { ProjectInfoSection } from '@/components/admin/projects/ProjectInfoSection';
import { WorkspaceStorageSection } from '@/components/admin/projects/WorkspaceStorageSection';
import { ProjectMembersSection } from '@/components/admin/projects/ProjectMembersSection';
import { ProjectFilesSection } from '@/components/admin/projects/ProjectFilesSection';
import { ProjectInvitationsSection } from '@/components/admin/projects/ProjectInvitationsSection';
import {
  DeleteProjectDialog,
  RemoveMemberDialog,
} from '@/components/admin/projects/ProjectDialogs';

const BACK_TO_PROJECTS = { to: '/admin/projects', label: 'Back to Projects' };

export const Route = createFileRoute('/_app/_protected/admin/projects/$projectId')({
  component: ProjectDetailPage,
});

function ProjectDetailPage() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const projectQuery = useAdminProjectDetails(projectId);
  const projectData = projectQuery.data as ProjectData | undefined;

  // DO storage stats are fetched separately because they route through the
  // ProjectDoc DO and are slower than the D1 details query. Loading them as
  // a sibling query lets the rest of the page render immediately.
  const statsQuery = useAdminWorkspaceStats(projectId);
  const workspaceStats = statsQuery.data as WorkspaceStats | undefined;

  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'delete-project' | 'remove-member';
    member?: ProjectMember;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const invalidateProjectQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.projectDetails(projectId) });
  }, [queryClient, projectId]);

  const handleRemoveMember = async (memberId: string) => {
    setLoading(true);
    try {
      await removeProjectMember(projectId, memberId);
      showToast.success('Success', 'Member removed from project');
      setConfirmDialog(null);
      invalidateProjectQueries();
    } catch (error) {
      await handleError(error, { showToast: true });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async () => {
    setLoading(true);
    try {
      await deleteProject(projectId);
      showToast.success('Success', 'Project deleted');
      setConfirmDialog(null);
      navigate({ to: '/admin/projects' as string });
    } catch (error) {
      await handleError(error, { showToast: true });
      setLoading(false);
    }
  };

  if (projectQuery.isError) {
    return (
      <AdminPage title='Project' back={BACK_TO_PROJECTS}>
        <AdminError
          title='Failed to load project details'
          description='This project may have been deleted.'
          onRetry={() => projectQuery.refetch()}
        />
      </AdminPage>
    );
  }

  const project = projectData?.project;

  if (!project) {
    return (
      <AdminPage title='Project' loadingTitle description=' ' back={BACK_TO_PROJECTS}>
        <AdminPanel padded>
          <Skeleton className='h-40 w-full' />
        </AdminPanel>
      </AdminPage>
    );
  }

  return (
    <AdminPage
      back={BACK_TO_PROJECTS}
      title={project.name}
      description={
        <>
          <Link
            to={'/admin/orgs/$orgId' as string}
            params={{ orgId: project.orgId } as Record<string, string>}
            className='hover:text-foreground transition-colors'
          >
            {project.orgName}
          </Link>
          {` - ${projectData.stats.memberCount} members - ${projectData.stats.fileCount} files`}
        </>
      }
      actions={
        <Button
          variant='outline'
          className='text-destructive hover:text-destructive'
          onClick={() => setConfirmDialog({ type: 'delete-project' })}
          disabled={loading}
        >
          <Trash2Icon data-icon='inline-start' />
          Delete project
        </Button>
      }
    >
      <ProjectInfoSection project={project} stats={projectData.stats} />
      <WorkspaceStorageSection
        stats={workspaceStats}
        isLoading={statsQuery.isLoading}
        isError={statsQuery.isError}
        isFetching={statsQuery.isFetching}
        onRefresh={() => statsQuery.refetch()}
      />
      <ProjectMembersSection
        members={projectData.members}
        loading={loading}
        onRemove={member => setConfirmDialog({ type: 'remove-member', member })}
      />
      <ProjectFilesSection files={projectData.files} />
      <ProjectInvitationsSection invitations={projectData.invitations} />

      <DeleteProjectDialog
        open={confirmDialog?.type === 'delete-project'}
        onOpenChange={open => !open && setConfirmDialog(null)}
        onConfirm={handleDeleteProject}
        loading={loading}
      />
      <RemoveMemberDialog
        open={confirmDialog?.type === 'remove-member'}
        onOpenChange={open => !open && setConfirmDialog(null)}
        memberName={
          confirmDialog?.member?.userDisplayName ||
          confirmDialog?.member?.userName ||
          confirmDialog?.member?.userEmail
        }
        onConfirm={() => {
          if (confirmDialog?.member?.id) {
            handleRemoveMember(confirmDialog.member.id);
          }
        }}
        loading={loading}
      />
    </AdminPage>
  );
}
