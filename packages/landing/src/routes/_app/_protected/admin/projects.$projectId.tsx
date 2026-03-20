/**
 * Admin Project Detail route
 * Shows project info, members, files, and invitations.
 * Provides delete project and remove member actions.
 */

import { useState, useCallback } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
  ArrowLeftIcon,
  FolderIcon,
  UsersIcon,
  FileTextIcon,
  MailIcon,
  Trash2Icon,
  LoaderIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  HomeIcon,
  CopyIcon,
  HardDriveIcon,
  UserMinusIcon,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAdminProjectDetails } from '@/hooks/useAdminQueries';
import { useAdminStore, removeProjectMember, deleteProject } from '@/stores/adminStore';
import { showToast } from '@/components/ui/toast';
import { UserAvatar } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { handleError } from '@/lib/error-utils';
import { AdminBox } from '@/components/admin/ui';
import { table } from '@/components/admin/styles/admin-tokens';
import { queryKeys } from '@/lib/queryKeys';

export const Route = createFileRoute('/_app/_protected/admin/projects/$projectId')({
  component: ProjectDetailPage,
});

interface ProjectMember {
  id: string;
  userId: string;
  role: string;
  userAvatar?: string;
  userDisplayName?: string;
  userName?: string;
  userEmail?: string;
  joinedAt?: string | number | Date;
}

interface ProjectFile {
  id: string;
  originalName?: string;
  filename?: string;
  fileType?: string;
  fileSize?: number;
  uploadedBy?: string;
  uploaderDisplayName?: string;
  uploaderName?: string;
  createdAt?: string | number | Date;
}

interface ProjectInvitation {
  id: string;
  email: string;
  role: string;
  grantOrgMembership?: boolean;
  acceptedAt?: string | number | Date | null;
  expiresAt?: number;
  invitedBy: string;
  inviterDisplayName?: string;
  inviterName?: string;
  createdAt?: string | number | Date;
}

interface ProjectData {
  project: {
    id: string;
    name: string;
    description?: string;
    orgId: string;
    orgName: string;
    orgSlug: string;
    createdBy: string;
    creatorDisplayName?: string;
    creatorName?: string;
    creatorEmail?: string;
    createdAt?: string | number | Date;
    updatedAt?: string | number | Date;
  };
  stats: {
    memberCount: number;
    fileCount: number;
    totalStorageBytes: number;
  };
  members?: ProjectMember[];
  files?: ProjectFile[];
  invitations?: ProjectInvitation[];
}

const formatDate = (timestamp: string | number | Date | null | undefined): string => {
  if (!timestamp) return '-';
  const date =
    timestamp instanceof Date ? timestamp
    : typeof timestamp === 'string' ? new Date(timestamp)
    : new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatShortDate = (timestamp: string | number | Date | null | undefined): string => {
  if (!timestamp) return '-';
  const date =
    timestamp instanceof Date ? timestamp
    : typeof timestamp === 'string' ? new Date(timestamp)
    : new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatBytes = (bytes: number | null | undefined): string => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const isInvitationPending = (invitation: ProjectInvitation): boolean => {
  if (invitation.acceptedAt) return false;
  if (!invitation.expiresAt) return true;
  const expiresAt = new Date(invitation.expiresAt * 1000);
  return expiresAt > new Date();
};

const isInvitationExpired = (invitation: ProjectInvitation): boolean => {
  if (invitation.acceptedAt) return false;
  if (!invitation.expiresAt) return false;
  const expiresAt = new Date(invitation.expiresAt * 1000);
  return expiresAt <= new Date();
};

function ProjectDetailPage() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, isAdminChecked } = useAdminStore();

  const projectQuery = useAdminProjectDetails(projectId);
  const projectData = projectQuery.data as ProjectData | undefined;

  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'delete-project' | 'remove-member';
    member?: ProjectMember;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const invalidateProjectQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.projectDetails(projectId) });
  }, [queryClient, projectId]);

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(`${label}-${text}`);
      showToast.success('Copied', `${label} copied to clipboard`);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.warn('Clipboard copy failed:', (err as Error).message);
      showToast.error('Error', 'Failed to copy to clipboard');
    }
  };

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
        <div className='rounded-lg border border-red-200 bg-red-50 p-6 text-center'>
          <AlertCircleIcon className='mx-auto mb-2 size-8 text-red-500' />
          <p className='text-red-700'>Failed to load project details</p>
          <button
            type='button'
            onClick={() => projectQuery.refetch()}
            className='mt-2 text-sm text-red-600 hover:text-red-700'
          >
            Try again
          </button>
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

            {/* Actions */}
            <button
              type='button'
              onClick={() => setConfirmDialog({ type: 'delete-project' })}
              disabled={loading}
              className='inline-flex items-center rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50'
            >
              <Trash2Icon className='mr-2 size-4' />
              Delete Project
            </button>
          </div>

          {/* Project Info Section */}
          <AdminBox className='mb-6'>
            <h2 className='text-foreground mb-4 text-lg font-semibold'>Project Information</h2>
            <dl className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
              <div>
                <dt className='text-muted-foreground text-sm font-medium'>Project ID</dt>
                <dd className='text-foreground mt-1 flex items-center text-sm'>
                  <span className='font-mono'>{projectData.project.id}</span>
                  <button
                    type='button'
                    onClick={() => handleCopy(projectData.project.id, 'Project ID')}
                    className='text-muted-foreground/70 hover:text-muted-foreground ml-2'
                  >
                    {copiedId === `Project ID-${projectData.project.id}` ?
                      <CheckCircleIcon className='size-4 text-green-500' />
                    : <CopyIcon className='size-4' />}
                  </button>
                </dd>
              </div>
              <div>
                <dt className='text-muted-foreground text-sm font-medium'>Organization</dt>
                <dd className='mt-1 text-sm'>
                  <Link
                    to={'/admin/orgs/$orgId' as string}
                    params={{ orgId: projectData.project.orgId } as Record<string, string>}
                    className='text-blue-600 hover:text-blue-700'
                  >
                    {projectData.project.orgName}
                  </Link>
                  <span className='text-muted-foreground ml-1'>@{projectData.project.orgSlug}</span>
                </dd>
              </div>
              <div>
                <dt className='text-muted-foreground text-sm font-medium'>Created By</dt>
                <dd className='mt-1 text-sm'>
                  <Link
                    to={'/admin/users/$userId' as string}
                    params={{ userId: projectData.project.createdBy } as Record<string, string>}
                    className='text-blue-600 hover:text-blue-700'
                  >
                    {projectData.project.creatorDisplayName ||
                      projectData.project.creatorName ||
                      projectData.project.creatorEmail}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className='text-muted-foreground text-sm font-medium'>Created</dt>
                <dd className='text-foreground mt-1 text-sm'>
                  {formatDate(projectData.project.createdAt)}
                </dd>
              </div>
              <div>
                <dt className='text-muted-foreground text-sm font-medium'>Updated</dt>
                <dd className='text-foreground mt-1 text-sm'>
                  {formatDate(projectData.project.updatedAt)}
                </dd>
              </div>
              <div>
                <dt className='text-muted-foreground text-sm font-medium'>Storage Used</dt>
                <dd className='text-foreground mt-1 flex items-center text-sm'>
                  <HardDriveIcon className='text-muted-foreground/70 mr-1 size-4' />
                  {formatBytes(projectData.stats.totalStorageBytes)}
                </dd>
              </div>
            </dl>
          </AdminBox>

          {/* Members Section */}
          <AdminBox className='mb-6'>
            <h2 className='text-foreground mb-4 flex items-center text-lg font-semibold'>
              <UsersIcon className='mr-2 size-5' />
              Members ({projectData.members?.length ?? 0})
            </h2>
            {(projectData.members?.length ?? 0) > 0 ?
              <div className='overflow-x-auto'>
                <table className={table.base}>
                  <thead>
                    <tr className={table.header}>
                      <th className={table.headerCell}>User</th>
                      <th className={table.headerCell}>Role</th>
                      <th className={table.headerCell}>Joined</th>
                      <th className={`${table.headerCell} text-right`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className={table.body}>
                    {projectData.members!.map(member => (
                      <tr key={member.id} className={table.row}>
                        <td className={table.cellCompact}>
                          <div className='flex items-center gap-3'>
                            <UserAvatar
                              src={member.userAvatar}
                              name={member.userDisplayName || member.userName}
                              size='sm'
                            />
                            <div>
                              <Link
                                to={'/admin/users/$userId' as string}
                                params={{ userId: member.userId } as Record<string, string>}
                                className='font-medium text-blue-600 hover:text-blue-700'
                              >
                                {member.userDisplayName || member.userName}
                              </Link>
                              <p className='text-muted-foreground text-xs'>{member.userEmail}</p>
                            </div>
                          </div>
                        </td>
                        <td className={table.cellCompact}>
                          <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>
                            {member.role}
                          </Badge>
                        </td>
                        <td className={`${table.cellCompact} text-muted-foreground`}>
                          {formatShortDate(member.joinedAt)}
                        </td>
                        <td className={`${table.cellCompact} text-right`}>
                          <button
                            type='button'
                            onClick={() => setConfirmDialog({ type: 'remove-member', member })}
                            disabled={loading}
                            className='inline-flex items-center text-sm text-red-600 hover:text-red-700 disabled:opacity-50'
                            title='Remove member'
                          >
                            <UserMinusIcon className='size-4' />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            : <p className='text-muted-foreground text-sm'>No members</p>}
          </AdminBox>

          {/* Files Section */}
          <AdminBox className='mb-6'>
            <h2 className='text-foreground mb-4 flex items-center text-lg font-semibold'>
              <FileTextIcon className='mr-2 size-5' />
              Files ({projectData.files?.length ?? 0})
            </h2>
            {(projectData.files?.length ?? 0) > 0 ?
              <div className='overflow-x-auto'>
                <table className={table.base}>
                  <thead>
                    <tr className={table.header}>
                      <th className={table.headerCell}>File</th>
                      <th className={table.headerCell}>Type</th>
                      <th className={table.headerCell}>Size</th>
                      <th className={table.headerCell}>Uploaded By</th>
                      <th className={table.headerCell}>Uploaded</th>
                    </tr>
                  </thead>
                  <tbody className={table.body}>
                    {projectData.files!.map(file => (
                      <tr key={file.id} className={table.row}>
                        <td className={table.cellCompact}>
                          <div className='flex items-center gap-2'>
                            <FileTextIcon className='text-muted-foreground/70 size-4' />
                            <span className='text-foreground font-medium'>
                              {file.originalName || file.filename}
                            </span>
                          </div>
                        </td>
                        <td className={`${table.cellCompact} text-muted-foreground`}>
                          {file.fileType || '-'}
                        </td>
                        <td className={`${table.cellCompact} text-muted-foreground`}>
                          {formatBytes(file.fileSize)}
                        </td>
                        <td className={table.cellCompact}>
                          {file.uploadedBy ?
                            <Link
                              to={'/admin/users/$userId' as string}
                              params={{ userId: file.uploadedBy } as Record<string, string>}
                              className='text-blue-600 hover:text-blue-700'
                            >
                              {file.uploaderDisplayName || file.uploaderName}
                            </Link>
                          : <span className='text-muted-foreground/70'>-</span>}
                        </td>
                        <td className={`${table.cellCompact} text-muted-foreground`}>
                          {formatShortDate(file.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            : <p className='text-muted-foreground text-sm'>No files uploaded</p>}
          </AdminBox>

          {/* Invitations Section */}
          <AdminBox className='mb-6'>
            <h2 className='text-foreground mb-4 flex items-center text-lg font-semibold'>
              <MailIcon className='mr-2 size-5' />
              Invitations ({projectData.invitations?.length ?? 0})
            </h2>
            {(projectData.invitations?.length ?? 0) > 0 ?
              <div className='overflow-x-auto'>
                <table className={table.base}>
                  <thead>
                    <tr className={table.header}>
                      <th className={table.headerCell}>Email</th>
                      <th className={table.headerCell}>Role</th>
                      <th className={table.headerCell}>Status</th>
                      <th className={table.headerCell}>Invited By</th>
                      <th className={table.headerCell}>Created</th>
                    </tr>
                  </thead>
                  <tbody className={table.body}>
                    {projectData.invitations!.map(invitation => (
                      <tr key={invitation.id} className={table.row}>
                        <td className={table.cellCompact}>{invitation.email}</td>
                        <td className={table.cellCompact}>
                          <Badge variant='secondary'>
                            {invitation.role}
                          </Badge>
                          {invitation.grantOrgMembership && (
                            <span className='text-muted-foreground ml-1 text-xs'>+ org</span>
                          )}
                        </td>
                        <td className={table.cellCompact}>
                          {invitation.acceptedAt && (
                            <Badge variant='success'>
                              <CheckCircleIcon className='mr-1 size-3' />
                              Accepted
                            </Badge>
                          )}
                          {isInvitationPending(invitation) && (
                            <Badge variant='warning'>
                              <ClockIcon className='mr-1 size-3' />
                              Pending
                            </Badge>
                          )}
                          {isInvitationExpired(invitation) && (
                            <Badge variant='destructive'>
                              Expired
                            </Badge>
                          )}
                        </td>
                        <td className={table.cellCompact}>
                          <Link
                            to={'/admin/users/$userId' as string}
                            params={{ userId: invitation.invitedBy } as Record<string, string>}
                            className='text-blue-600 hover:text-blue-700'
                          >
                            {invitation.inviterDisplayName || invitation.inviterName}
                          </Link>
                        </td>
                        <td className={`${table.cellCompact} text-muted-foreground`}>
                          {formatShortDate(invitation.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            : <p className='text-muted-foreground text-sm'>No invitations</p>}
          </AdminBox>
        </>
      )}

      {/* Delete Project Dialog */}
      <AlertDialog
        open={confirmDialog?.type === 'delete-project'}
        onOpenChange={_open => !_open && setConfirmDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the project and all associated data including files,
              members, and invitations. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant='destructive'
              onClick={handleDeleteProject}
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Delete Project'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Member Dialog */}
      <AlertDialog
        open={confirmDialog?.type === 'remove-member'}
        onOpenChange={_open => !_open && setConfirmDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{' '}
              <strong>
                {confirmDialog?.member?.userDisplayName ||
                  confirmDialog?.member?.userName ||
                  confirmDialog?.member?.userEmail}
              </strong>{' '}
              from this project?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant='destructive'
              onClick={() => {
                if (confirmDialog?.member?.id) {
                  handleRemoveMember(confirmDialog.member.id);
                }
              }}
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Remove Member'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
