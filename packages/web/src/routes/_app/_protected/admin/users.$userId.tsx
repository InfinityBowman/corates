import { useState, useCallback, Suspense } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import type { ErrorComponentProps } from '@tanstack/react-router';
import {
  ArrowLeftIcon,
  ShieldIcon,
  UserXIcon,
  CheckCircleIcon,
  AlertCircleIcon,
} from 'lucide-react';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { adminUserDetailsQueryOptions } from '@/hooks/useAdminQueries';
import { queryClient } from '@/lib/queryClient';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { handleError } from '@/lib/error-utils';
import { queryKeys } from '@/lib/queryKeys';
import type { UserData } from '@/components/admin/users/types';
import { UserActions } from '@/components/admin/users/UserActions';
import { UserProfileSection } from '@/components/admin/users/UserProfileSection';
import { UserLinkedAccounts } from '@/components/admin/users/UserLinkedAccounts';
import { UserOrganizations } from '@/components/admin/users/UserOrganizations';
import { UserProjects } from '@/components/admin/users/UserProjects';
import { UserSessions } from '@/components/admin/users/UserSessions';
import {
  BanUserDialog,
  DeleteUserDialog,
  RevokeAllSessionsDialog,
} from '@/components/admin/users/UserDialogs';

export const Route = createFileRoute('/_app/_protected/admin/users/$userId')({
  loader: async ({ params: { userId } }) => {
    await queryClient.prefetchQuery(adminUserDetailsQueryOptions(userId));
  },
  component: UserDetailPage,
  errorComponent: UserDetailError,
});

function UserDetailError({ reset }: ErrorComponentProps) {
  return (
    <div className='border-destructive/20 bg-destructive/10 rounded-lg border p-6 text-center'>
      <AlertCircleIcon className='text-destructive mx-auto mb-2 size-8' />
      <p className='text-destructive'>Failed to load user details</p>
      <Button variant='link' className='text-destructive mt-2' onClick={reset}>
        Try again
      </Button>
    </div>
  );
}

function UserDetailPage() {
  const { isAdmin, isAdminChecked } = useAdminStore();

  if (!isAdminChecked) {
    return (
      <div className='flex min-h-100 items-center justify-center'>
        <Spinner size='lg' />
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
    <Suspense
      fallback={
        <div className='flex min-h-64 items-center justify-center'>
          <Spinner size='lg' />
        </div>
      }
    >
      <UserDetailContent />
    </Suspense>
  );
}

function UserDetailContent() {
  const { userId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data } = useSuspenseQuery(adminUserDetailsQueryOptions(userId));
  const userData = data as unknown as UserData;

  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'delete' | 'revoke-all';
  } | null>(null);
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const invalidateUserQueries = useCallback(() => {
    qc.invalidateQueries({ queryKey: queryKeys.admin.userDetails(userId) });
  }, [qc, userId]);

  const handleBan = async (reason: string) => {
    setLoading(true);
    try {
      await banUser(userId, reason || 'Banned by administrator');
      showToast.success('Success', 'User banned successfully');
      setBanDialogOpen(false);
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

        <UserActions
          user={userData.user}
          loading={loading}
          onImpersonate={handleImpersonate}
          onUnban={handleUnban}
          onBan={() => setBanDialogOpen(true)}
          onDelete={() => setConfirmDialog({ type: 'delete' })}
        />
      </div>

      <UserProfileSection user={userData.user} />
      <UserLinkedAccounts accounts={userData.accounts} />
      <UserOrganizations orgs={userData.orgs} />
      <UserProjects projects={userData.projects} />
      <UserSessions
        sessions={userData.sessions}
        loading={loading}
        onRevoke={handleRevokeSession}
        onRevokeAll={() => setConfirmDialog({ type: 'revoke-all' })}
      />

      <BanUserDialog
        open={banDialogOpen}
        onOpenChange={setBanDialogOpen}
        onConfirm={handleBan}
        loading={loading}
      />
      <DeleteUserDialog
        open={confirmDialog?.type === 'delete'}
        onOpenChange={open => !open && setConfirmDialog(null)}
        onConfirm={handleDeleteUser}
        loading={loading}
      />
      <RevokeAllSessionsDialog
        open={confirmDialog?.type === 'revoke-all'}
        onOpenChange={open => !open && setConfirmDialog(null)}
        onConfirm={handleRevokeAllSessions}
        loading={loading}
      />
    </>
  );
}
