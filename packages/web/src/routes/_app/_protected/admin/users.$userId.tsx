import { useState, useCallback, Suspense } from 'react';
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router';
import { ShieldIcon, UserXIcon, CheckCircleIcon } from 'lucide-react';
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
import { showToast } from '@/lib/toast';
import { UserAvatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { handleError } from '@/lib/error-utils';
import { queryKeys } from '@/lib/queryKeys';
import { AdminError, AdminPage, AdminPanel } from '@/components/admin/ui';
import { Skeleton } from '@/components/ui/skeleton';
import type { AdminUserDetails } from '@/server/functions/admin-users.server';
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

const BACK_TO_USERS = { to: '/admin/users', label: 'Back to Users' };

export const Route = createFileRoute('/_app/_protected/admin/users/$userId')({
  loader: async ({ params: { userId } }) => {
    await queryClient.prefetchQuery(adminUserDetailsQueryOptions(userId));
  },
  component: UserDetailPage,
  errorComponent: UserDetailError,
});

function UserDetailError() {
  const router = useRouter();
  return (
    <AdminPage title='User' back={BACK_TO_USERS}>
      <AdminError title='Failed to load user details' onRetry={() => router.invalidate()} />
    </AdminPage>
  );
}

/** Holds the page's shape while the suspense query resolves. */
function UserDetailSkeleton() {
  return (
    <AdminPage title='User' loadingTitle description=' ' back={BACK_TO_USERS}>
      <AdminPanel padded>
        <Skeleton className='h-40 w-full' />
      </AdminPanel>
    </AdminPage>
  );
}

function UserDetailPage() {
  return (
    <Suspense fallback={<UserDetailSkeleton />}>
      <UserDetailContent />
    </Suspense>
  );
}

function UserDetailContent() {
  const { userId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data } = useSuspenseQuery(adminUserDetailsQueryOptions(userId));
  const userData = data as unknown as AdminUserDetails;
  const user = userData.user;

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
      navigate({ to: '/admin/users' as string });
    } catch (error) {
      await handleError(error, { showToast: true });
      setLoading(false);
    }
  };

  return (
    <AdminPage
      back={BACK_TO_USERS}
      title={
        <span className='flex items-center gap-3'>
          <UserAvatar
            src={user.avatarUrl || user.image || undefined}
            name={user.name}
            className='size-8'
          />
          {user.name}
        </span>
      }
      description={user.email}
      meta={
        <>
          {user.role === 'admin' && (
            <Badge variant='default'>
              <ShieldIcon data-icon='inline-start' />
              Admin
            </Badge>
          )}
          {user.banned && (
            <Badge variant='destructive'>
              <UserXIcon data-icon='inline-start' />
              Banned
            </Badge>
          )}
          {user.emailVerified && (
            <Badge variant='success'>
              <CheckCircleIcon data-icon='inline-start' />
              Verified
            </Badge>
          )}
          {user.twoFactorEnabled && (
            <Badge variant='info'>
              <ShieldIcon data-icon='inline-start' />
              2FA
            </Badge>
          )}
        </>
      }
      actions={
        <UserActions
          user={user}
          loading={loading}
          onImpersonate={handleImpersonate}
          onUnban={handleUnban}
          onBan={() => setBanDialogOpen(true)}
          onDelete={() => setConfirmDialog({ type: 'delete' })}
        />
      }
    >
      <UserProfileSection user={user} />
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
    </AdminPage>
  );
}
