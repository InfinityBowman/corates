/**
 * Project Detail component for admin dashboard
 * Shows project details, members, files, and invitations
 */

import { createSignal, Show, For } from 'solid-js';
import { useParams, A } from '@solidjs/router';
import {
  FiArrowLeft,
  FiFolder,
  FiUsers,
  FiFile,
  FiMail,
  FiTrash2,
  FiLoader,
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiHome,
  FiCopy,
  FiHardDrive,
  FiUserMinus,
  FiX,
} from 'solid-icons/fi';
import { useAdminProjectDetails } from '@primitives/useAdminQueries.js';
import {
  removeProjectMember,
  deleteProject,
  isAdminChecked,
  isAdmin,
} from '@/stores/adminStore.js';
import { showToast } from '@/components/ui/toast';
import { UserAvatar } from '@/components/ui/avatar';
import {
  Dialog,
  DialogBackdrop,
  DialogPositioner,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogCloseTrigger,
} from '@/components/ui/dialog';
import { handleError } from '@/lib/error-utils.js';
import { AdminBox } from './ui/index.js';
import { table } from './styles/admin-tokens.js';

export default function ProjectDetail() {
  const params = useParams();
  const projectId = () => params.projectId;

  // Fetch project details - pass accessor so hook can track changes
  const projectQuery = useAdminProjectDetails(projectId);
  const projectData = () => projectQuery.data;

  // Dialog states
  const [confirmDialog, setConfirmDialog] = createSignal(null);
  const [loading, setLoading] = createSignal(false);
  const [copiedId, setCopiedId] = createSignal(null);

  const formatDate = timestamp => {
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

  const formatShortDate = timestamp => {
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

  const formatBytes = bytes => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleCopy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(`${label}-${text}`);
      showToast.success('Copied', `${label} copied to clipboard`);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.warn('Clipboard copy failed:', err.message);
      showToast.error('Error', 'Failed to copy to clipboard');
    }
  };

  const handleRemoveMember = async memberId => {
    setLoading(true);
    try {
      await removeProjectMember(projectId(), memberId);
      showToast.success('Success', 'Member removed from project');
      setConfirmDialog(null);
      projectQuery.refetch();
    } catch (error) {
      await handleError(error, { toastTitle: 'Error removing member' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async () => {
    setLoading(true);
    try {
      await deleteProject(projectId());
      showToast.success('Success', 'Project deleted');
      window.location.href = '/admin/projects';
    } catch (error) {
      await handleError(error, { toastTitle: 'Error deleting project' });
      setLoading(false);
    }
  };

  const isInvitationPending = invitation => {
    if (invitation.acceptedAt) return false;
    const expiresAt = new Date(invitation.expiresAt * 1000);
    return expiresAt > new Date();
  };

  const isInvitationExpired = invitation => {
    if (invitation.acceptedAt) return false;
    const expiresAt = new Date(invitation.expiresAt * 1000);
    return expiresAt <= new Date();
  };

  return (
    <Show
      when={isAdminChecked()}
      fallback={
        <div class='flex min-h-100 items-center justify-center'>
          <FiLoader class='h-8 w-8 animate-spin text-blue-600' />
        </div>
      }
    >
      <Show
        when={isAdmin()}
        fallback={
          <div class='text-muted-foreground flex min-h-100 flex-col items-center justify-center'>
            <FiAlertCircle class='mb-4 h-12 w-12' />
            <p class='text-lg font-medium'>Access Denied</p>
            <p class='text-sm'>You do not have admin privileges.</p>
          </div>
        }
      >
        {/* Back link */}
        <A
          href='/admin/projects'
          class='text-muted-foreground hover:text-secondary-foreground mb-6 inline-flex items-center text-sm'
        >
          <FiArrowLeft class='mr-2 h-4 w-4' />
          Back to Projects
        </A>

        {/* Loading state */}
        <Show when={projectQuery.isLoading}>
          <div class='flex min-h-64 items-center justify-center'>
            <FiLoader class='h-8 w-8 animate-spin text-blue-600' />
          </div>
        </Show>

        {/* Error state */}
        <Show when={projectQuery.isError}>
          <div class='rounded-lg border border-red-200 bg-red-50 p-6 text-center'>
            <FiAlertCircle class='mx-auto mb-2 h-8 w-8 text-red-500' />
            <p class='text-red-700'>Failed to load project details</p>
            <button
              onClick={() => projectQuery.refetch()}
              class='mt-2 text-sm text-red-600 hover:text-red-700'
            >
              Try again
            </button>
          </div>
        </Show>

        {/* Project details */}
        <Show when={projectData()?.project}>
          {/* Header */}
          <div class='mb-8 flex items-start justify-between'>
            <div class='flex items-center space-x-4'>
              <div class='flex h-16 w-16 items-center justify-center rounded-lg bg-blue-100'>
                <FiFolder class='h-8 w-8 text-blue-600' />
              </div>
              <div>
                <h1 class='text-foreground text-2xl font-bold'>{projectData().project.name}</h1>
                <Show when={projectData().project.description}>
                  <p class='text-muted-foreground mt-1'>{projectData().project.description}</p>
                </Show>
                <div class='text-muted-foreground mt-2 flex items-center space-x-4 text-sm'>
                  <A
                    href={`/admin/orgs/${projectData().project.orgId}`}
                    class='flex items-center hover:text-blue-600'
                  >
                    <FiHome class='mr-1 h-4 w-4' />
                    {projectData().project.orgName}
                  </A>
                  <span class='flex items-center'>
                    <FiUsers class='mr-1 h-4 w-4' />
                    {projectData().stats.memberCount} members
                  </span>
                  <span class='flex items-center'>
                    <FiFile class='mr-1 h-4 w-4' />
                    {projectData().stats.fileCount} files
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <button
              onClick={() => setConfirmDialog({ type: 'delete-project' })}
              disabled={loading()}
              class='inline-flex items-center rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50'
            >
              <FiTrash2 class='mr-2 h-4 w-4' />
              Delete Project
            </button>
          </div>

          {/* Project Info Section */}
          <AdminBox class='mb-6'>
            <h2 class='text-foreground mb-4 text-lg font-semibold'>Project Information</h2>
            <dl class='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
              <div>
                <dt class='text-muted-foreground text-sm font-medium'>Project ID</dt>
                <dd class='text-foreground mt-1 flex items-center text-sm'>
                  <span class='font-mono'>{projectData().project.id}</span>
                  <button
                    onClick={() => handleCopy(projectData().project.id, 'Project ID')}
                    class='text-muted-foreground/70 hover:text-muted-foreground ml-2'
                  >
                    <Show
                      when={copiedId() === `Project ID-${projectData().project.id}`}
                      fallback={<FiCopy class='h-4 w-4' />}
                    >
                      <FiCheckCircle class='h-4 w-4 text-green-500' />
                    </Show>
                  </button>
                </dd>
              </div>
              <div>
                <dt class='text-muted-foreground text-sm font-medium'>Organization</dt>
                <dd class='mt-1 text-sm'>
                  <A
                    href={`/admin/orgs/${projectData().project.orgId}`}
                    class='text-blue-600 hover:text-blue-700'
                  >
                    {projectData().project.orgName}
                  </A>
                  <span class='text-muted-foreground ml-1'>@{projectData().project.orgSlug}</span>
                </dd>
              </div>
              <div>
                <dt class='text-muted-foreground text-sm font-medium'>Created By</dt>
                <dd class='mt-1 text-sm'>
                  <A
                    href={`/admin/users/${projectData().project.createdBy}`}
                    class='text-blue-600 hover:text-blue-700'
                  >
                    {projectData().project.creatorDisplayName ||
                      projectData().project.creatorName ||
                      projectData().project.creatorEmail}
                  </A>
                </dd>
              </div>
              <div>
                <dt class='text-muted-foreground text-sm font-medium'>Created</dt>
                <dd class='text-foreground mt-1 text-sm'>
                  {formatDate(projectData().project.createdAt)}
                </dd>
              </div>
              <div>
                <dt class='text-muted-foreground text-sm font-medium'>Updated</dt>
                <dd class='text-foreground mt-1 text-sm'>
                  {formatDate(projectData().project.updatedAt)}
                </dd>
              </div>
              <div>
                <dt class='text-muted-foreground text-sm font-medium'>Storage Used</dt>
                <dd class='text-foreground mt-1 flex items-center text-sm'>
                  <FiHardDrive class='text-muted-foreground/70 mr-1 h-4 w-4' />
                  {formatBytes(projectData().stats.totalStorageBytes)}
                </dd>
              </div>
            </dl>
          </AdminBox>

          {/* Members Section */}
          <AdminBox class='mb-6'>
            <h2 class='text-foreground mb-4 flex items-center text-lg font-semibold'>
              <FiUsers class='mr-2 h-5 w-5' />
              Members ({projectData().members?.length || 0})
            </h2>
            <Show
              when={projectData().members?.length > 0}
              fallback={<p class='text-muted-foreground text-sm'>No members</p>}
            >
              <div class='overflow-x-auto'>
                <table class={table.base}>
                  <thead>
                    <tr class={table.header}>
                      <th class={table.headerCell}>User</th>
                      <th class={table.headerCell}>Role</th>
                      <th class={table.headerCell}>Joined</th>
                      <th class={`${table.headerCell} text-right`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody class={table.body}>
                    <For each={projectData().members}>
                      {member => (
                        <tr class={table.row}>
                          <td class={table.cellCompact}>
                            <div class='flex items-center space-x-3'>
                              <UserAvatar
                                src={member.userAvatar}
                                name={member.userDisplayName || member.userName}
                                class='h-8 w-8'
                              />
                              <div>
                                <A
                                  href={`/admin/users/${member.userId}`}
                                  class='font-medium text-blue-600 hover:text-blue-700'
                                >
                                  {member.userDisplayName || member.userName}
                                </A>
                                <p class='text-muted-foreground text-xs'>{member.userEmail}</p>
                              </div>
                            </div>
                          </td>
                          <td class={table.cellCompact}>
                            <span
                              class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                member.role === 'owner' ?
                                  'bg-purple-100 text-purple-800'
                                : 'bg-secondary text-foreground'
                              }`}
                            >
                              {member.role}
                            </span>
                          </td>
                          <td class={`${table.cellCompact} text-muted-foreground`}>
                            {formatShortDate(member.joinedAt)}
                          </td>
                          <td class={`${table.cellCompact} text-right`}>
                            <button
                              onClick={() => setConfirmDialog({ type: 'remove-member', member })}
                              disabled={loading()}
                              class='inline-flex items-center text-sm text-red-600 hover:text-red-700 disabled:opacity-50'
                              title='Remove member'
                            >
                              <FiUserMinus class='h-4 w-4' />
                            </button>
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>
          </AdminBox>

          {/* Files Section */}
          <AdminBox class='mb-6'>
            <h2 class='text-foreground mb-4 flex items-center text-lg font-semibold'>
              <FiFile class='mr-2 h-5 w-5' />
              Files ({projectData().files?.length || 0})
            </h2>
            <Show
              when={projectData().files?.length > 0}
              fallback={<p class='text-muted-foreground text-sm'>No files uploaded</p>}
            >
              <div class='overflow-x-auto'>
                <table class={table.base}>
                  <thead>
                    <tr class={table.header}>
                      <th class={table.headerCell}>File</th>
                      <th class={table.headerCell}>Type</th>
                      <th class={table.headerCell}>Size</th>
                      <th class={table.headerCell}>Uploaded By</th>
                      <th class={table.headerCell}>Uploaded</th>
                    </tr>
                  </thead>
                  <tbody class={table.body}>
                    <For each={projectData().files}>
                      {file => (
                        <tr class={table.row}>
                          <td class={table.cellCompact}>
                            <div class='flex items-center space-x-2'>
                              <FiFile class='text-muted-foreground/70 h-4 w-4' />
                              <span class='text-foreground font-medium'>
                                {file.originalName || file.filename}
                              </span>
                            </div>
                          </td>
                          <td class={`${table.cellCompact} text-muted-foreground`}>
                            {file.fileType || '-'}
                          </td>
                          <td class={`${table.cellCompact} text-muted-foreground`}>
                            {formatBytes(file.fileSize)}
                          </td>
                          <td class={table.cellCompact}>
                            <Show
                              when={file.uploadedBy}
                              fallback={<span class='text-muted-foreground/70'>-</span>}
                            >
                              <A
                                href={`/admin/users/${file.uploadedBy}`}
                                class='text-blue-600 hover:text-blue-700'
                              >
                                {file.uploaderDisplayName || file.uploaderName}
                              </A>
                            </Show>
                          </td>
                          <td class={`${table.cellCompact} text-muted-foreground`}>
                            {formatShortDate(file.createdAt)}
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>
          </AdminBox>

          {/* Invitations Section */}
          <AdminBox class='mb-6'>
            <h2 class='text-foreground mb-4 flex items-center text-lg font-semibold'>
              <FiMail class='mr-2 h-5 w-5' />
              Invitations ({projectData().invitations?.length || 0})
            </h2>
            <Show
              when={projectData().invitations?.length > 0}
              fallback={<p class='text-muted-foreground text-sm'>No invitations</p>}
            >
              <div class='overflow-x-auto'>
                <table class={table.base}>
                  <thead>
                    <tr class={table.header}>
                      <th class={table.headerCell}>Email</th>
                      <th class={table.headerCell}>Role</th>
                      <th class={table.headerCell}>Status</th>
                      <th class={table.headerCell}>Invited By</th>
                      <th class={table.headerCell}>Created</th>
                    </tr>
                  </thead>
                  <tbody class={table.body}>
                    <For each={projectData().invitations}>
                      {invitation => (
                        <tr class={table.row}>
                          <td class={table.cellCompact}>{invitation.email}</td>
                          <td class={table.cellCompact}>
                            <span class='bg-secondary text-foreground inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium'>
                              {invitation.role}
                            </span>
                            <Show when={invitation.grantOrgMembership}>
                              <span class='text-muted-foreground ml-1 text-xs'>+ org</span>
                            </Show>
                          </td>
                          <td class={table.cellCompact}>
                            <Show when={invitation.acceptedAt}>
                              <span class='inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800'>
                                <FiCheckCircle class='mr-1 h-3 w-3' />
                                Accepted
                              </span>
                            </Show>
                            <Show when={isInvitationPending(invitation)}>
                              <span class='inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800'>
                                <FiClock class='mr-1 h-3 w-3' />
                                Pending
                              </span>
                            </Show>
                            <Show when={isInvitationExpired(invitation)}>
                              <span class='inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800'>
                                Expired
                              </span>
                            </Show>
                          </td>
                          <td class={table.cellCompact}>
                            <A
                              href={`/admin/users/${invitation.invitedBy}`}
                              class='text-blue-600 hover:text-blue-700'
                            >
                              {invitation.inviterDisplayName || invitation.inviterName}
                            </A>
                          </td>
                          <td class={`${table.cellCompact} text-muted-foreground`}>
                            {formatShortDate(invitation.createdAt)}
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>
          </AdminBox>
        </Show>

        {/* Confirm Dialog */}
        <Dialog open={!!confirmDialog()} onOpenChange={open => !open && setConfirmDialog(null)}>
          <DialogBackdrop />
          <DialogPositioner>
            <DialogContent class='max-w-md'>
              <DialogHeader>
                <DialogTitle>
                  {confirmDialog()?.type === 'delete-project' ?
                    'Delete Project'
                  : confirmDialog()?.type === 'remove-member' ?
                    'Remove Member'
                  : 'Confirm'}
                </DialogTitle>
                <DialogCloseTrigger>
                  <FiX class='h-5 w-5' />
                </DialogCloseTrigger>
              </DialogHeader>
              <DialogBody>
                <div class='space-y-4'>
                  <Show when={confirmDialog()?.type === 'delete-project'}>
                    <p class='text-muted-foreground text-sm'>
                      This will permanently delete the project and all associated data including
                      files, members, and invitations. This action cannot be undone.
                    </p>
                  </Show>
                  <Show when={confirmDialog()?.type === 'remove-member'}>
                    <p class='text-muted-foreground text-sm'>
                      Are you sure you want to remove{' '}
                      <strong>
                        {confirmDialog()?.member?.userDisplayName ||
                          confirmDialog()?.member?.userName ||
                          confirmDialog()?.member?.userEmail}
                      </strong>{' '}
                      from this project?
                    </p>
                  </Show>
                  <div class='flex justify-end space-x-3'>
                    <button
                      onClick={() => setConfirmDialog(null)}
                      class='bg-secondary text-secondary-foreground hover:bg-secondary rounded-lg px-4 py-2 text-sm font-medium'
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (confirmDialog()?.type === 'delete-project') handleDeleteProject();
                        else if (confirmDialog()?.type === 'remove-member')
                          handleRemoveMember(confirmDialog().member.id);
                      }}
                      disabled={loading()}
                      class='rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50'
                    >
                      {loading() ? 'Processing...' : 'Confirm'}
                    </button>
                  </div>
                </div>
              </DialogBody>
            </DialogContent>
          </DialogPositioner>
        </Dialog>
      </Show>
    </Show>
  );
}
