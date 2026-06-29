import { useState, useCallback } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
  ArrowLeftIcon,
  FolderIcon,
  UsersIcon,
  FileTextIcon,
  Trash2Icon,
  LoaderIcon,
  AlertCircleIcon,
  HomeIcon,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAdminProjectDetails, useAdminProjectDocStats } from '@/hooks/useAdminQueries';
import { useAdminStore, removeProjectMember, deleteProject } from '@/stores/adminStore';
import { showToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { handleError } from '@/lib/error-utils';
import { queryKeys } from '@/lib/queryKeys';
import type {
  ProjectData,
  ProjectDocStats,
  ProjectMember,
} from '@/components/admin/projects/types';
import { ProjectInfoSection } from '@/components/admin/projects/ProjectInfoSection';
import { ProjectDocStorageSection } from '@/components/admin/projects/ProjectDocStorageSection';
import { ProjectMembersSection } from '@/components/admin/projects/ProjectMembersSection';
import { ProjectFilesSection } from '@/components/admin/projects/ProjectFilesSection';
import { ProjectInvitationsSection } from '@/components/admin/projects/ProjectInvitationsSection';
import {
  DeleteProjectDialog,
  RemoveMemberDialog,
} from '@/components/admin/projects/ProjectDialogs';

export const Route = createFileRoute('/_app/_protected/admin/projects/$projectId')({
  component: ProjectDetailPage,
});

function ProjectDetailPage() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, isAdminChecked } = useAdminStore();

  const projectQuery = useAdminProjectDetails(projectId);
  const projectData = projectQuery.data as ProjectData | undefined;

  // DO storage stats are fetched separately because they route through the
  // ProjectDoc DO and are slower than the D1 details query. Loading them as
  // a sibling query lets the rest of the page render immediately.
  const docStatsQuery = useAdminProjectDocStats(projectId);
  const docStats = docStatsQuery.data as ProjectDocStats | undefined;

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

  if (!isAdminChecked) {
    return (
      <div className='flex min-h-100 items-center justify-center'>
        <LoaderIcon className='size-8 animate-spin text-blue-600' />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className='text-muted-foreground flex min-h-100 flex-col items-center justify-center'>
        <AlertCircleIcon className='mb-4 size-12' />
        <p className='text-lg font-medium'>Access Denied</p>
        <p className='text-sm'>You do not have admin privileges.</p>
      </div>
    );
  }

  return (
    <>
      {/* Back link */}
      <Link
        to={'/admin/projects' as string}
        className='text-muted-foreground hover:text-secondary-foreground mb-6 inline-flex items-center text-sm'
      >
        <ArrowLeftIcon className='mr-2 size-4' />
        Back to Projects
      </Link>

      {/* Loading state */}
      {projectQuery.isLoading && (
        <div className='flex min-h-64 items-center justify-center'>
          <LoaderIcon className='size-8 animate-spin text-blue-600' />
        </div>
      )}

      {/* Error state */}
      {projectQuery.isError && (
        <div className='border-destructive/20 bg-destructive/10 rounded-lg border p-6 text-center'>
          <AlertCircleIcon className='text-destructive mx-auto mb-2 size-8' />
          <p className='text-destructive'>Failed to load project details</p>
          <Button
            variant='link'
            className='text-destructive mt-2'
            onClick={() => projectQuery.refetch()}
          >
            Try again
          </Button>
        </div>
      )}

      {/* Project details */}
      {projectData?.project && (
        <>
          {/* Header */}
          <div className='mb-8 flex items-start justify-between'>
            <div className='flex items-center gap-4'>
              <div className='flex size-16 items-center justify-center rounded-lg bg-blue-100'>
                <FolderIcon className='size-8 text-blue-600' />
              </div>
              <div>
                <h1 className='text-foreground text-2xl font-bold'>{projectData.project.name}</h1>
                {projectData.project.description && (
                  <p className='text-muted-foreground mt-1'>{projectData.project.description}</p>
                )}
                <div className='text-muted-foreground mt-2 flex items-center gap-4 text-sm'>
                  <Link
                    to={'/admin/orgs/$orgId' as string}
                    params={{ orgId: projectData.project.orgId } as Record<string, string>}
                    className='flex items-center hover:text-blue-600'
                  >
                    <HomeIcon className='mr-1 size-4' />
                    {projectData.project.orgName}
                  </Link>
                  <span className='flex items-center'>
                    <UsersIcon className='mr-1 size-4' />
                    {projectData.stats.memberCount} members
                  </span>
                  <span className='flex items-center'>
                    <FileTextIcon className='mr-1 size-4' />
                    {projectData.stats.fileCount} files
                  </span>
                </div>
              </div>
            </div>

            <Button
              variant='destructive'
              onClick={() => setConfirmDialog({ type: 'delete-project' })}
              disabled={loading}
            >
              <Trash2Icon data-icon='inline-start' />
              Delete Project
            </Button>
          </div>

          <ProjectInfoSection project={projectData.project} stats={projectData.stats} />
          <ProjectDocStorageSection
            stats={docStats}
            isLoading={docStatsQuery.isLoading}
            isError={docStatsQuery.isError}
            isFetching={docStatsQuery.isFetching}
            onRefresh={() => docStatsQuery.refetch()}
          />
          <ProjectMembersSection
            members={projectData.members}
            loading={loading}
            onRemove={member => setConfirmDialog({ type: 'remove-member', member })}
          />
          <ProjectFilesSection files={projectData.files} />
          <ProjectInvitationsSection invitations={projectData.invitations} />
        </>
      )}

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
    </>
  );
}
