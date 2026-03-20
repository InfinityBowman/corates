/**
 * Admin User Detail route
 * Shows user profile, linked accounts, organizations, projects, sessions.
 * Provides ban/unban, impersonate, revoke sessions, and delete actions.
 */

import { useState, useCallback } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
  ArrowLeftIcon,
  MailIcon,
  ShieldIcon,
  LoaderIcon,
  HomeIcon,
  FolderIcon,
  LogOutIcon,
  Trash2Icon,
  UserXIcon,
  UserCheckIcon,
  LogInIcon,
  ClockIcon,
  MonitorIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  CopyIcon,
  ExternalLinkIcon,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAdminUserDetails } from '@/hooks/useAdminQueries';
import {
  useAdminStore,
  banUser,
  unbanUser,
  revokeUserSessions,
  revokeUserSession,
  deleteUser,
} from '@/stores/adminStore';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { handleError } from '@/lib/error-utils';
import { AdminBox } from '@/components/admin/ui';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { queryKeys } from '@/lib/queryKeys';
export const Route = createFileRoute('/_app/_protected/admin/users/$userId')({
  component: UserDetailPage,
});

interface UserAccount {
  providerId: string;
  createdAt?: string | number | Date;
}

interface UserOrg {
  orgId: string;
  orgName: string;
  orgSlug: string;
  role: string;
  billing: { planName: string; accessMode: string };
  membershipCreatedAt?: string | number | Date;
}

interface UserProject {
  id: string;
  name: string;
  role: string;
  joinedAt?: string | number | Date;
}

interface UserSession {
  id: string;
  userAgent?: string;
  ipAddress?: string;
  createdAt?: string | number | Date;
  expiresAt?: string | number | Date;
}

interface UserData {
  user: {
    id: string;
    name: string;
    email: string;
    username?: string;
    persona?: string;
    avatarUrl?: string;
    image?: string;
    role?: string;
    banned?: boolean;
    banReason?: string;
    banExpires?: string | number | Date;
    emailVerified?: boolean;
    twoFactorEnabled?: boolean;
    stripeCustomerId?: string;
    createdAt?: string | number | Date;
    updatedAt?: string | number | Date;
  };
  accounts?: UserAccount[];
  orgs?: UserOrg[];
  projects?: UserProject[];
  sessions?: UserSession[];
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

const parseUserAgent = (ua: string | undefined): { browser: string; os: string } => {
  if (!ua) return { browser: 'Unknown', os: 'Unknown' };
  let browser = 'Unknown';
  let os = 'Unknown';

  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';

  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  return { browser, os };
};

const getStripeCustomerUrl = (customerId: string | undefined): string | null => {
  if (!customerId) return null;
  return `https://dashboard.stripe.com/customers/${customerId}`;
};

function UserDetailPage() {
  const { userId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, isAdminChecked } = useAdminStore();

  const userDetailsQuery = useAdminUserDetails(userId);
  const userData = userDetailsQuery.data as UserData | undefined;

  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'delete' | 'revoke-all';
  } | null>(null);
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const invalidateUserQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.userDetails(userId) });
  }, [queryClient, userId]);

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

  const handleBan = async () => {
    setLoading(true);
    try {
      await banUser(userId, banReason || 'Banned by administrator');
      showToast.success('Success', 'User banned successfully');
      setBanDialogOpen(false);
      setBanReason('');
      invalidateUserQueries();
    } catch (error) {
      await handleError(error, { showToast: true });
    } finally {
      setLoading(false);
    }
  };

  const handleUnban = async () => {
    setLoading(true);
    try {
      await unbanUser(userId);
      showToast.success('Success', 'User unbanned successfully');
      invalidateUserQueries();
    } catch (error) {
      await handleError(error, { showToast: true });
    } finally {
      setLoading(false);
    }
  };

  const handleImpersonate = async () => {
    setLoading(true);
    try {
      const store = useAdminStore.getState();
      await store.impersonateUser(userId);
    } catch (error) {
      await handleError(error, { showToast: true });
      setLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    setLoading(true);
    try {
      await revokeUserSession(userId, sessionId);
      showToast.success('Success', 'Session revoked');
      invalidateUserQueries();
    } catch (error) {
      await handleError(error, { showToast: true });
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeAllSessions = async () => {
    setLoading(true);
    try {
      await revokeUserSessions(userId);
      showToast.success('Success', 'All sessions revoked');
      setConfirmDialog(null);
      invalidateUserQueries();
    } catch (error) {
      await handleError(error, { showToast: true });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    setLoading(true);
    try {
      await deleteUser(userId);
      showToast.success('Success', 'User deleted successfully');
      setConfirmDialog(null);
      navigate({ to: '/admin' as string });
    } catch (error) {
      await handleError(error, { showToast: true });
      setLoading(false);
    }
  };

  if (!isAdminChecked) {
    return (
      <div className='min-h-[400px flex items-center justify-center'>
        <LoaderIcon className='size-8 animate-spin text-blue-600' />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className='text-muted-foreground min-h-[400px flex flex-col items-center justify-center'>
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
        to={'/admin' as string}
        className='text-muted-foreground hover:text-secondary-foreground mb-6 inline-flex items-center text-sm'
      >
        <ArrowLeftIcon className='mr-2 size-4' />
        Back to Admin Dashboard
      </Link>

      {/* Loading state */}
      {userDetailsQuery.isLoading && (
        <div className='flex min-h-64 items-center justify-center'>
          <LoaderIcon className='size-8 animate-spin text-blue-600' />
        </div>
      )}

      {/* Error state */}
      {userDetailsQuery.isError && (
        <div className='rounded-lg border border-destructive/20 bg-destructive/10 p-6 text-center'>
          <AlertCircleIcon className='mx-auto mb-2 size-8 text-destructive' />
          <p className='text-destructive'>Failed to load user details</p>
          <button
            type='button'
            onClick={() => userDetailsQuery.refetch()}
            className='mt-2 text-sm text-destructive hover:text-destructive/80'
          >
            Try again
          </button>
        </div>
      )}

      {/* User details */}
      {userData?.user && (
        <>
          {/* Header */}
          <div className='mb-8 flex items-start justify-between'>
            <div className='flex items-center gap-4'>
              <UserAvatar
                src={userData.user.avatarUrl || userData.user.image}
                name={userData.user.name}
                size='lg'
              />
              <div>
                <h1 className='text-foreground text-2xl font-bold'>{userData.user.name}</h1>
                <p className='text-muted-foreground'>{userData.user.email}</p>
                <div className='mt-1 flex items-center gap-2'>
                  {userData.user.role === 'admin' && (
                    <Badge variant='default'>
                      <ShieldIcon data-icon='inline-start' />
                      Admin
                    </Badge>
                  )}
                  {userData.user.banned && (
                    <Badge variant='destructive'>
                      <UserXIcon data-icon='inline-start' />
                      Banned
                    </Badge>
                  )}
                  {userData.user.emailVerified && (
                    <Badge variant='success'>
                      <CheckCircleIcon data-icon='inline-start' />
                      Verified
                    </Badge>
                  )}
                  {userData.user.twoFactorEnabled && (
                    <Badge variant='info'>
                      <ShieldIcon data-icon='inline-start' />
                      2FA
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className='flex gap-2'>
              <button
                type='button'
                onClick={handleImpersonate}
                disabled={loading}
                className='border-border bg-card text-secondary-foreground hover:bg-muted inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50'
              >
                <LogInIcon className='mr-2 size-4' />
                Impersonate
              </button>
              {userData.user.banned ?
                <button
                  type='button'
                  onClick={handleUnban}
                  disabled={loading}
                  className='bg-card inline-flex items-center rounded-lg border border-green-300 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-50'
                >
                  <UserCheckIcon className='mr-2 size-4' />
                  Unban
                </button>
              : <button
                  type='button'
                  onClick={() => setBanDialogOpen(true)}
                  disabled={loading}
                  className='bg-card inline-flex items-center rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50'
                >
                  <UserXIcon className='mr-2 size-4' />
                  Ban
                </button>
              }
              <button
                type='button'
                onClick={() => setConfirmDialog({ type: 'delete' })}
                disabled={loading}
                className='inline-flex items-center rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50'
              >
                <Trash2Icon className='mr-2 size-4' />
                Delete
              </button>
            </div>
          </div>

          {/* Profile Info Section */}
          <AdminBox className='mb-6'>
            <h2 className='text-foreground mb-4 text-lg font-semibold'>Profile Information</h2>
            <dl className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
              <div>
                <dt className='text-muted-foreground text-sm font-medium'>User ID</dt>
                <dd className='text-foreground mt-1 flex items-center text-sm'>
                  <span className='font-mono'>{userData.user.id}</span>
                  <button
                    type='button'
                    onClick={() => handleCopy(userData.user.id, 'User ID')}
                    className='text-muted-foreground/70 hover:text-muted-foreground ml-2'
                  >
                    {copiedId === `User ID-${userData.user.id}` ?
                      <CheckCircleIcon className='size-4 text-green-500' />
                    : <CopyIcon className='size-4' />}
                  </button>
                </dd>
              </div>
              <div>
                <dt className='text-muted-foreground text-sm font-medium'>Username</dt>
                <dd className='text-foreground mt-1 text-sm'>{userData.user.username || '-'}</dd>
              </div>
              <div>
                <dt className='text-muted-foreground text-sm font-medium'>Persona</dt>
                <dd className='text-foreground mt-1 text-sm'>{userData.user.persona || '-'}</dd>
              </div>
              <div>
                <dt className='text-muted-foreground text-sm font-medium'>Created</dt>
                <dd className='text-foreground mt-1 text-sm'>
                  {formatDate(userData.user.createdAt)}
                </dd>
              </div>
              <div>
                <dt className='text-muted-foreground text-sm font-medium'>Updated</dt>
                <dd className='text-foreground mt-1 text-sm'>
                  {formatDate(userData.user.updatedAt)}
                </dd>
              </div>
              <div>
                <dt className='text-muted-foreground text-sm font-medium'>Stripe Customer</dt>
                <dd className='text-foreground mt-1 text-sm'>
                  {userData.user.stripeCustomerId ?
                    <a
                      href={getStripeCustomerUrl(userData.user.stripeCustomerId) ?? '#'}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='inline-flex items-center text-blue-600 hover:text-blue-700'
                    >
                      <span className='font-mono'>{userData.user.stripeCustomerId}</span>
                      <ExternalLinkIcon className='ml-1 size-3' />
                    </a>
                  : '-'}
                </dd>
              </div>
              {userData.user.banned && (
                <>
                  <div>
                    <dt className='text-muted-foreground text-sm font-medium'>Ban Reason</dt>
                    <dd className='mt-1 text-sm text-destructive'>{userData.user.banReason || '-'}</dd>
                  </div>
                  <div>
                    <dt className='text-muted-foreground text-sm font-medium'>Ban Expires</dt>
                    <dd className='text-foreground mt-1 text-sm'>
                      {userData.user.banExpires ? formatDate(userData.user.banExpires) : 'Never'}
                    </dd>
                  </div>
                </>
              )}
            </dl>
          </AdminBox>

          {/* Linked Accounts */}
          <AdminBox className='mb-6'>
            <h2 className='text-foreground mb-4 text-lg font-semibold'>Linked Accounts</h2>
            {(userData.accounts?.length ?? 0) > 0 ?
              <div className='flex flex-col gap-2'>
                {userData.accounts!.map((account, idx) => (
                  <div
                    key={idx}
                    className='border-border bg-muted flex items-center justify-between rounded-lg border p-3'
                  >
                    <div className='flex items-center gap-3'>
                      <span className='bg-card inline-flex size-8 items-center justify-center rounded-full'>
                        {account.providerId === 'google' && (
                          <img src='/logos/google.svg' alt='Google' className='size-5' />
                        )}
                        {account.providerId === 'orcid' && (
                          <img src='/logos/orcid.svg' alt='ORCID' className='size-5' />
                        )}
                        {account.providerId === 'credential' && (
                          <MailIcon className='text-muted-foreground size-5' />
                        )}
                      </span>
                      <div>
                        <p className='text-foreground text-sm font-medium capitalize'>
                          {account.providerId === 'credential' ?
                            'Email/Password'
                          : account.providerId}
                        </p>
                        <p className='text-muted-foreground text-xs'>
                          Connected {formatShortDate(account.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            : <p className='text-muted-foreground text-sm'>No linked accounts</p>}
          </AdminBox>

          {/* Organizations */}
          <AdminBox className='mb-6'>
            <h2 className='text-foreground mb-4 flex items-center text-lg font-semibold'>
              <HomeIcon className='mr-2 size-5' />
              Organizations ({userData.orgs?.length ?? 0})
            </h2>
            {(userData.orgs?.length ?? 0) > 0 ?
              <Table>
                <TableHeader>
                  <TableRow className='border-b border-border bg-muted'>
                    <TableHead className='px-6 py-3 text-xs font-medium tracking-wider text-muted-foreground uppercase'>
                      Organization
                    </TableHead>
                    <TableHead className='px-6 py-3 text-xs font-medium tracking-wider text-muted-foreground uppercase'>
                      Role
                    </TableHead>
                    <TableHead className='px-6 py-3 text-xs font-medium tracking-wider text-muted-foreground uppercase'>
                      Plan
                    </TableHead>
                    <TableHead className='px-6 py-3 text-xs font-medium tracking-wider text-muted-foreground uppercase'>
                      Access
                    </TableHead>
                    <TableHead className='px-6 py-3 text-xs font-medium tracking-wider text-muted-foreground uppercase'>
                      Joined
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userData.orgs!.map(org => (
                    <TableRow key={org.orgId}>
                      <TableCell className='px-4 py-3 text-sm text-foreground'>
                        <Link
                          to={'/admin/orgs/$orgId' as string}
                          params={{ orgId: org.orgId } as Record<string, string>}
                          className='font-medium text-blue-600 hover:text-blue-700'
                        >
                          {org.orgName}
                        </Link>
                        <p className='text-muted-foreground text-xs'>@{org.orgSlug}</p>
                      </TableCell>
                      <TableCell className='px-4 py-3 text-sm text-foreground'>
                        <Badge
                          variant={
                            org.role === 'owner' ? 'default'
                            : org.role === 'admin' ?
                              'info'
                            : 'secondary'
                          }
                        >
                          {org.role}
                        </Badge>
                      </TableCell>
                      <TableCell className='px-4 py-3 text-sm text-foreground'>
                        {org.billing.planName}
                      </TableCell>
                      <TableCell className='px-4 py-3 text-sm text-foreground'>
                        <Badge
                          variant={
                            org.billing.accessMode === 'full' ? 'success'
                            : org.billing.accessMode === 'limited' ?
                              'warning'
                            : 'destructive'
                          }
                        >
                          {org.billing.accessMode}
                        </Badge>
                      </TableCell>
                      <TableCell className='text-muted-foreground px-4 py-3 text-sm'>
                        {formatShortDate(org.membershipCreatedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            : <p className='text-muted-foreground text-sm'>Not a member of any organizations</p>}
          </AdminBox>

          {/* Projects */}
          <AdminBox className='mb-6'>
            <h2 className='text-foreground mb-4 flex items-center text-lg font-semibold'>
              <FolderIcon className='mr-2 size-5' />
              Projects ({userData.projects?.length ?? 0})
            </h2>
            {(userData.projects?.length ?? 0) > 0 ?
              <Table>
                <TableHeader>
                  <TableRow className='border-b border-border bg-muted'>
                    <TableHead className='px-6 py-3 text-xs font-medium tracking-wider text-muted-foreground uppercase'>
                      Project
                    </TableHead>
                    <TableHead className='px-6 py-3 text-xs font-medium tracking-wider text-muted-foreground uppercase'>
                      Role
                    </TableHead>
                    <TableHead className='px-6 py-3 text-xs font-medium tracking-wider text-muted-foreground uppercase'>
                      Joined
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userData.projects!.map(project => (
                    <TableRow key={project.id}>
                      <TableCell className='px-4 py-3 text-sm font-medium text-foreground'>
                        {project.name}
                      </TableCell>
                      <TableCell className='px-4 py-3 text-sm text-foreground'>
                        <Badge variant={project.role === 'owner' ? 'default' : 'secondary'}>
                          {project.role}
                        </Badge>
                      </TableCell>
                      <TableCell className='text-muted-foreground px-4 py-3 text-sm'>
                        {formatShortDate(project.joinedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            : <p className='text-muted-foreground text-sm'>Not a member of any projects</p>}
          </AdminBox>

          {/* Sessions */}
          <AdminBox className='mb-6'>
            <div className='mb-4 flex items-center justify-between'>
              <h2 className='text-foreground flex items-center text-lg font-semibold'>
                <MonitorIcon className='mr-2 size-5' />
                Active Sessions ({userData.sessions?.length ?? 0})
              </h2>
              {(userData.sessions?.length ?? 0) > 0 && (
                <button
                  type='button'
                  onClick={() => setConfirmDialog({ type: 'revoke-all' })}
                  disabled={loading}
                  className='inline-flex items-center text-sm text-destructive hover:text-destructive/80 disabled:opacity-50'
                >
                  <LogOutIcon className='mr-1 size-4' />
                  Revoke All
                </button>
              )}
            </div>
            {(userData.sessions?.length ?? 0) > 0 ?
              <div className='flex flex-col gap-3'>
                {userData.sessions!.map(session => {
                  const { browser, os } = parseUserAgent(session.userAgent);
                  return (
                    <div
                      key={session.id}
                      className='border-border bg-muted flex items-center justify-between rounded-lg border p-4'
                    >
                      <div className='flex items-center gap-4'>
                        <div className='bg-card flex size-10 items-center justify-center rounded-full'>
                          <MonitorIcon className='text-muted-foreground size-5' />
                        </div>
                        <div>
                          <p className='text-foreground text-sm font-medium'>
                            {browser} on {os}
                          </p>
                          <div className='text-muted-foreground flex items-center gap-3 text-xs'>
                            <span className='flex items-center'>
                              <ClockIcon className='mr-1 size-3' />
                              {formatDate(session.createdAt)}
                            </span>
                            {session.ipAddress && <span>IP: {session.ipAddress}</span>}
                          </div>
                          <p className='text-muted-foreground/70 mt-1 text-xs'>
                            Expires: {formatDate(session.expiresAt)}
                          </p>
                        </div>
                      </div>
                      <button
                        type='button'
                        onClick={() => handleRevokeSession(session.id)}
                        disabled={loading}
                        className='bg-card inline-flex items-center rounded-lg border border-destructive/20 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50'
                      >
                        <LogOutIcon className='mr-1 size-3' />
                        Revoke
                      </button>
                    </div>
                  );
                })}
              </div>
            : <p className='text-muted-foreground text-sm'>No active sessions</p>}
          </AdminBox>
        </>
      )}

      {/* Ban Dialog */}
      <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle>Ban User</DialogTitle>
          </DialogHeader>
          <div className='flex flex-col gap-4'>
            <p className='text-muted-foreground text-sm'>
              This will ban the user and revoke all their sessions.
            </p>
            <div>
              <label className='text-secondary-foreground mb-1 block text-sm font-medium'>
                Ban Reason
              </label>
              <textarea
                value={banReason}
                onChange={e => setBanReason(e.target.value)}
                placeholder='Enter reason for ban...'
                className='border-border w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none'
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setBanDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant='destructive' onClick={handleBan} disabled={loading}>
              {loading ? 'Banning...' : 'Ban User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <AlertDialog
        open={confirmDialog?.type === 'delete'}
        onOpenChange={open => !open && setConfirmDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the user and all their data. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant='destructive' onClick={handleDeleteUser} disabled={loading}>
              {loading ? 'Processing...' : 'Delete User'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Revoke All Sessions Dialog */}
      <AlertDialog
        open={confirmDialog?.type === 'revoke-all'}
        onOpenChange={open => !open && setConfirmDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke All Sessions</AlertDialogTitle>
            <AlertDialogDescription>
              This will revoke all active sessions for this user. They will need to sign in again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant='destructive'
              onClick={handleRevokeAllSessions}
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Revoke All'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
