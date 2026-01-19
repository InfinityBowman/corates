/**
 * User Detail component for admin dashboard
 * Shows user details, organizations, sessions, and projects.
 * Allows admins to manage sessions and view user information.
 */

import { createSignal, Show, For } from 'solid-js';
import { useParams, A } from '@solidjs/router';
import {
  FiArrowLeft,
  FiMail,
  FiShield,
  FiLoader,
  FiHome,
  FiFolder,
  FiLogOut,
  FiTrash2,
  FiUserX,
  FiUserCheck,
  FiLogIn,
  FiClock,
  FiMonitor,
  FiAlertCircle,
  FiCheckCircle,
  FiCopy,
  FiExternalLink,
  FiX,
} from 'solid-icons/fi';
import { useAdminUserDetails } from '@primitives/useAdminQueries.js';
import {
  banUser,
  unbanUser,
  impersonateUser,
  revokeUserSessions,
  revokeUserSession,
  deleteUser,
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

export default function UserDetail() {
  const params = useParams();
  const userId = () => params.userId;

  // Fetch user details - pass accessor so hook can track changes
  const userDetailsQuery = useAdminUserDetails(userId);
  const userData = () => userDetailsQuery.data;

  // Dialog states
  const [confirmDialog, setConfirmDialog] = createSignal(null);
  const [banDialog, setBanDialog] = createSignal(false);
  const [banReason, setBanReason] = createSignal('');
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

  const handleBan = async () => {
    setLoading(true);
    try {
      await banUser(userId(), banReason() || 'Banned by administrator');
      showToast.success('Success', 'User banned successfully');
      setBanDialog(false);
      setBanReason('');
      userDetailsQuery.refetch();
    } catch (error) {
      await handleError(error, { toastTitle: 'Error banning user' });
    } finally {
      setLoading(false);
    }
  };

  const handleUnban = async () => {
    setLoading(true);
    try {
      await unbanUser(userId());
      showToast.success('Success', 'User unbanned successfully');
      userDetailsQuery.refetch();
    } catch (error) {
      await handleError(error, { toastTitle: 'Error unbanning user' });
    } finally {
      setLoading(false);
    }
  };

  const handleImpersonate = async () => {
    setLoading(true);
    try {
      await impersonateUser(userId());
      // Page will redirect
    } catch (error) {
      await handleError(error, { toastTitle: 'Error impersonating user' });
      setLoading(false);
    }
  };

  const handleRevokeSession = async sessionId => {
    setLoading(true);
    try {
      await revokeUserSession(userId(), sessionId);
      showToast.success('Success', 'Session revoked');
      userDetailsQuery.refetch();
    } catch (error) {
      await handleError(error, { toastTitle: 'Error revoking session' });
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeAllSessions = async () => {
    setLoading(true);
    try {
      await revokeUserSessions(userId());
      showToast.success('Success', 'All sessions revoked');
      setConfirmDialog(null);
      userDetailsQuery.refetch();
    } catch (error) {
      await handleError(error, { toastTitle: 'Error revoking sessions' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    setLoading(true);
    try {
      await deleteUser(userId());
      showToast.success('Success', 'User deleted successfully');
      // Navigate back to admin dashboard
      window.location.href = '/admin';
    } catch (error) {
      await handleError(error, { toastTitle: 'Error deleting user' });
      setLoading(false);
    }
  };

  const getStripeCustomerUrl = customerId => {
    if (!customerId) return null;
    return `https://dashboard.stripe.com/customers/${customerId}`;
  };

  const parseUserAgent = ua => {
    if (!ua) return { browser: 'Unknown', os: 'Unknown' };
    let browser = 'Unknown';
    let os = 'Unknown';

    // Detect browser
    if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Edg')) browser = 'Edge';
    else if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Safari')) browser = 'Safari';

    // Detect OS
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

    return { browser, os };
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
          href='/admin'
          class='text-muted-foreground hover:text-secondary-foreground mb-6 inline-flex items-center text-sm'
        >
          <FiArrowLeft class='mr-2 h-4 w-4' />
          Back to Admin Dashboard
        </A>

        {/* Loading state */}
        <Show when={userDetailsQuery.isLoading}>
          <div class='flex min-h-64 items-center justify-center'>
            <FiLoader class='h-8 w-8 animate-spin text-blue-600' />
          </div>
        </Show>

        {/* Error state */}
        <Show when={userDetailsQuery.isError}>
          <div class='rounded-lg border border-red-200 bg-red-50 p-6 text-center'>
            <FiAlertCircle class='mx-auto mb-2 h-8 w-8 text-red-500' />
            <p class='text-red-700'>Failed to load user details</p>
            <button
              onClick={() => userDetailsQuery.refetch()}
              class='mt-2 text-sm text-red-600 hover:text-red-700'
            >
              Try again
            </button>
          </div>
        </Show>

        {/* User details */}
        <Show when={userData()?.user}>
          {/* Header */}
          <div class='mb-8 flex items-start justify-between'>
            <div class='flex items-center space-x-4'>
              <UserAvatar
                src={userData().user.avatarUrl || userData().user.image}
                name={userData().user.name}
                class='h-16 w-16 text-xl'
              />
              <div>
                <h1 class='text-foreground text-2xl font-bold'>{userData().user.name}</h1>
                <p class='text-muted-foreground'>{userData().user.email}</p>
                <div class='mt-1 flex items-center space-x-2'>
                  <Show when={userData().user.role === 'admin'}>
                    <span class='inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800'>
                      <FiShield class='mr-1 h-3 w-3' />
                      Admin
                    </span>
                  </Show>
                  <Show when={userData().user.banned}>
                    <span class='inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800'>
                      <FiUserX class='mr-1 h-3 w-3' />
                      Banned
                    </span>
                  </Show>
                  <Show when={userData().user.emailVerified}>
                    <span class='inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800'>
                      <FiCheckCircle class='mr-1 h-3 w-3' />
                      Verified
                    </span>
                  </Show>
                  <Show when={userData().user.twoFactorEnabled}>
                    <span class='inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800'>
                      <FiShield class='mr-1 h-3 w-3' />
                      2FA
                    </span>
                  </Show>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div class='flex space-x-2'>
              <button
                onClick={handleImpersonate}
                disabled={loading()}
                class='border-border bg-card text-secondary-foreground hover:bg-muted inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50'
              >
                <FiLogIn class='mr-2 h-4 w-4' />
                Impersonate
              </button>
              <Show
                when={userData().user.banned}
                fallback={
                  <button
                    onClick={() => setBanDialog(true)}
                    disabled={loading()}
                    class='bg-card inline-flex items-center rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50'
                  >
                    <FiUserX class='mr-2 h-4 w-4' />
                    Ban
                  </button>
                }
              >
                <button
                  onClick={handleUnban}
                  disabled={loading()}
                  class='bg-card inline-flex items-center rounded-lg border border-green-300 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-50'
                >
                  <FiUserCheck class='mr-2 h-4 w-4' />
                  Unban
                </button>
              </Show>
              <button
                onClick={() => setConfirmDialog({ type: 'delete' })}
                disabled={loading()}
                class='inline-flex items-center rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50'
              >
                <FiTrash2 class='mr-2 h-4 w-4' />
                Delete
              </button>
            </div>
          </div>

          {/* Profile Info Section */}
          <AdminBox class='mb-6'>
            <h2 class='text-foreground mb-4 text-lg font-semibold'>Profile Information</h2>
            <dl class='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
              <div>
                <dt class='text-muted-foreground text-sm font-medium'>User ID</dt>
                <dd class='text-foreground mt-1 flex items-center text-sm'>
                  <span class='font-mono'>{userData().user.id}</span>
                  <button
                    onClick={() => handleCopy(userData().user.id, 'User ID')}
                    class='text-muted-foreground/70 hover:text-muted-foreground ml-2'
                  >
                    <Show
                      when={copiedId() === `User ID-${userData().user.id}`}
                      fallback={<FiCopy class='h-4 w-4' />}
                    >
                      <FiCheckCircle class='h-4 w-4 text-green-500' />
                    </Show>
                  </button>
                </dd>
              </div>
              <div>
                <dt class='text-muted-foreground text-sm font-medium'>Username</dt>
                <dd class='text-foreground mt-1 text-sm'>{userData().user.username || '-'}</dd>
              </div>
              <div>
                <dt class='text-muted-foreground text-sm font-medium'>Persona</dt>
                <dd class='text-foreground mt-1 text-sm'>{userData().user.persona || '-'}</dd>
              </div>
              <div>
                <dt class='text-muted-foreground text-sm font-medium'>Created</dt>
                <dd class='text-foreground mt-1 text-sm'>
                  {formatDate(userData().user.createdAt)}
                </dd>
              </div>
              <div>
                <dt class='text-muted-foreground text-sm font-medium'>Updated</dt>
                <dd class='text-foreground mt-1 text-sm'>
                  {formatDate(userData().user.updatedAt)}
                </dd>
              </div>
              <div>
                <dt class='text-muted-foreground text-sm font-medium'>Stripe Customer</dt>
                <dd class='text-foreground mt-1 text-sm'>
                  <Show when={userData().user.stripeCustomerId} fallback='-'>
                    <a
                      href={getStripeCustomerUrl(userData().user.stripeCustomerId)}
                      target='_blank'
                      rel='noopener noreferrer'
                      class='inline-flex items-center text-blue-600 hover:text-blue-700'
                    >
                      <span class='font-mono'>{userData().user.stripeCustomerId}</span>
                      <FiExternalLink class='ml-1 h-3 w-3' />
                    </a>
                  </Show>
                </dd>
              </div>
              <Show when={userData().user.banned}>
                <div>
                  <dt class='text-muted-foreground text-sm font-medium'>Ban Reason</dt>
                  <dd class='mt-1 text-sm text-red-600'>{userData().user.banReason || '-'}</dd>
                </div>
                <div>
                  <dt class='text-muted-foreground text-sm font-medium'>Ban Expires</dt>
                  <dd class='text-foreground mt-1 text-sm'>
                    {userData().user.banExpires ? formatDate(userData().user.banExpires) : 'Never'}
                  </dd>
                </div>
              </Show>
            </dl>
          </AdminBox>

          {/* Linked Accounts */}
          <AdminBox class='mb-6'>
            <h2 class='text-foreground mb-4 text-lg font-semibold'>Linked Accounts</h2>
            <Show
              when={userData().accounts?.length > 0}
              fallback={<p class='text-muted-foreground text-sm'>No linked accounts</p>}
            >
              <div class='space-y-2'>
                <For each={userData().accounts}>
                  {account => (
                    <div class='border-border-subtle bg-muted flex items-center justify-between rounded-lg border p-3'>
                      <div class='flex items-center space-x-3'>
                        <span class='bg-card inline-flex h-8 w-8 items-center justify-center rounded-full'>
                          <Show when={account.providerId === 'google'}>
                            <img src='/logos/google.svg' alt='Google' class='h-5 w-5' />
                          </Show>
                          <Show when={account.providerId === 'orcid'}>
                            <img src='/logos/orcid.svg' alt='ORCID' class='h-5 w-5' />
                          </Show>
                          <Show when={account.providerId === 'credential'}>
                            <FiMail class='text-muted-foreground h-5 w-5' />
                          </Show>
                        </span>
                        <div>
                          <p class='text-foreground text-sm font-medium capitalize'>
                            {account.providerId === 'credential' ?
                              'Email/Password'
                            : account.providerId}
                          </p>
                          <p class='text-muted-foreground text-xs'>
                            Connected {formatShortDate(account.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </AdminBox>

          {/* Organizations */}
          <AdminBox class='mb-6'>
            <h2 class='text-foreground mb-4 flex items-center text-lg font-semibold'>
              <FiHome class='mr-2 h-5 w-5' />
              Organizations ({userData().orgs?.length || 0})
            </h2>
            <Show
              when={userData().orgs?.length > 0}
              fallback={
                <p class='text-muted-foreground text-sm'>Not a member of any organizations</p>
              }
            >
              <div class='overflow-x-auto'>
                <table class={table.base}>
                  <thead>
                    <tr class={table.header}>
                      <th class={table.headerCell}>Organization</th>
                      <th class={table.headerCell}>Role</th>
                      <th class={table.headerCell}>Plan</th>
                      <th class={table.headerCell}>Access</th>
                      <th class={table.headerCell}>Joined</th>
                    </tr>
                  </thead>
                  <tbody class={table.body}>
                    <For each={userData().orgs}>
                      {org => (
                        <tr class={table.row}>
                          <td class={table.cellCompact}>
                            <A
                              href={`/admin/orgs/${org.orgId}`}
                              class='font-medium text-blue-600 hover:text-blue-700'
                            >
                              {org.orgName}
                            </A>
                            <p class='text-muted-foreground text-xs'>@{org.orgSlug}</p>
                          </td>
                          <td class={table.cellCompact}>
                            <span
                              class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                org.role === 'owner' ? 'bg-purple-100 text-purple-800'
                                : org.role === 'admin' ? 'bg-blue-100 text-blue-800'
                                : 'bg-secondary text-foreground'
                              }`}
                            >
                              {org.role}
                            </span>
                          </td>
                          <td class={table.cellCompact}>{org.billing.planName}</td>
                          <td class={table.cellCompact}>
                            <span
                              class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                org.billing.accessMode === 'full' ? 'bg-green-100 text-green-800'
                                : org.billing.accessMode === 'limited' ?
                                  'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {org.billing.accessMode}
                            </span>
                          </td>
                          <td class={`${table.cellCompact} text-muted-foreground`}>
                            {formatShortDate(org.membershipCreatedAt)}
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>
          </AdminBox>

          {/* Projects */}
          <AdminBox class='mb-6'>
            <h2 class='text-foreground mb-4 flex items-center text-lg font-semibold'>
              <FiFolder class='mr-2 h-5 w-5' />
              Projects ({userData().projects?.length || 0})
            </h2>
            <Show
              when={userData().projects?.length > 0}
              fallback={<p class='text-muted-foreground text-sm'>Not a member of any projects</p>}
            >
              <div class='overflow-x-auto'>
                <table class={table.base}>
                  <thead>
                    <tr class={table.header}>
                      <th class={table.headerCell}>Project</th>
                      <th class={table.headerCell}>Role</th>
                      <th class={table.headerCell}>Joined</th>
                    </tr>
                  </thead>
                  <tbody class={table.body}>
                    <For each={userData().projects}>
                      {project => (
                        <tr class={table.row}>
                          <td class={`${table.cellCompact} font-medium`}>{project.name}</td>
                          <td class={table.cellCompact}>
                            <span
                              class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                project.role === 'owner' ?
                                  'bg-purple-100 text-purple-800'
                                : 'bg-secondary text-foreground'
                              }`}
                            >
                              {project.role}
                            </span>
                          </td>
                          <td class={`${table.cellCompact} text-muted-foreground`}>
                            {formatShortDate(project.joinedAt)}
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>
          </AdminBox>

          {/* Sessions */}
          <AdminBox class='mb-6'>
            <div class='mb-4 flex items-center justify-between'>
              <h2 class='text-foreground flex items-center text-lg font-semibold'>
                <FiMonitor class='mr-2 h-5 w-5' />
                Active Sessions ({userData().sessions?.length || 0})
              </h2>
              <Show when={userData().sessions?.length > 0}>
                <button
                  onClick={() => setConfirmDialog({ type: 'revoke-all' })}
                  disabled={loading()}
                  class='inline-flex items-center text-sm text-red-600 hover:text-red-700 disabled:opacity-50'
                >
                  <FiLogOut class='mr-1 h-4 w-4' />
                  Revoke All
                </button>
              </Show>
            </div>
            <Show
              when={userData().sessions?.length > 0}
              fallback={<p class='text-muted-foreground text-sm'>No active sessions</p>}
            >
              <div class='space-y-3'>
                <For each={userData().sessions}>
                  {session => {
                    const { browser, os } = parseUserAgent(session.userAgent);
                    return (
                      <div class='border-border-subtle bg-muted flex items-center justify-between rounded-lg border p-4'>
                        <div class='flex items-center space-x-4'>
                          <div class='bg-card flex h-10 w-10 items-center justify-center rounded-full'>
                            <FiMonitor class='text-muted-foreground h-5 w-5' />
                          </div>
                          <div>
                            <p class='text-foreground text-sm font-medium'>
                              {browser} on {os}
                            </p>
                            <div class='text-muted-foreground flex items-center space-x-3 text-xs'>
                              <span class='flex items-center'>
                                <FiClock class='mr-1 h-3 w-3' />
                                {formatDate(session.createdAt)}
                              </span>
                              <Show when={session.ipAddress}>
                                <span>IP: {session.ipAddress}</span>
                              </Show>
                            </div>
                            <p class='text-muted-foreground/70 mt-1 text-xs'>
                              Expires: {formatDate(session.expiresAt)}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRevokeSession(session.id)}
                          disabled={loading()}
                          class='bg-card inline-flex items-center rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50'
                        >
                          <FiLogOut class='mr-1 h-3 w-3' />
                          Revoke
                        </button>
                      </div>
                    );
                  }}
                </For>
              </div>
            </Show>
          </AdminBox>
        </Show>

        {/* Ban Dialog */}
        <Dialog open={banDialog()} onOpenChange={setBanDialog}>
          <DialogBackdrop />
          <DialogPositioner>
            <DialogContent class='max-w-md'>
              <DialogHeader>
                <DialogTitle>Ban User</DialogTitle>
                <DialogCloseTrigger>
                  <FiX class='h-5 w-5' />
                </DialogCloseTrigger>
              </DialogHeader>
              <DialogBody>
                <div class='space-y-4'>
                  <p class='text-muted-foreground text-sm'>
                    This will ban the user and revoke all their sessions.
                  </p>
                  <div>
                    <label class='text-secondary-foreground mb-1 block text-sm font-medium'>
                      Ban Reason
                    </label>
                    <textarea
                      value={banReason()}
                      onInput={e => setBanReason(e.target.value)}
                      placeholder='Enter reason for ban...'
                      class='border-border w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none'
                      rows={3}
                    />
                  </div>
                  <div class='flex justify-end space-x-3'>
                    <button
                      onClick={() => setBanDialog(false)}
                      class='bg-secondary text-secondary-foreground hover:bg-secondary rounded-lg px-4 py-2 text-sm font-medium'
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleBan}
                      disabled={loading()}
                      class='rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50'
                    >
                      {loading() ? 'Banning...' : 'Ban User'}
                    </button>
                  </div>
                </div>
              </DialogBody>
            </DialogContent>
          </DialogPositioner>
        </Dialog>

        {/* Confirm Dialog */}
        <Dialog open={!!confirmDialog()} onOpenChange={open => !open && setConfirmDialog(null)}>
          <DialogBackdrop />
          <DialogPositioner>
            <DialogContent class='max-w-md'>
              <DialogHeader>
                <DialogTitle>
                  {confirmDialog()?.type === 'delete' ? 'Delete User' : 'Revoke All Sessions'}
                </DialogTitle>
                <DialogCloseTrigger>
                  <FiX class='h-5 w-5' />
                </DialogCloseTrigger>
              </DialogHeader>
              <DialogBody>
                <div class='space-y-4'>
                  <Show when={confirmDialog()?.type === 'delete'}>
                    <p class='text-muted-foreground text-sm'>
                      This will permanently delete the user and all their data. This action cannot
                      be undone.
                    </p>
                  </Show>
                  <Show when={confirmDialog()?.type === 'revoke-all'}>
                    <p class='text-muted-foreground text-sm'>
                      This will revoke all active sessions for this user. They will need to sign in
                      again.
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
                        if (confirmDialog()?.type === 'delete') handleDeleteUser();
                        else if (confirmDialog()?.type === 'revoke-all') handleRevokeAllSessions();
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
