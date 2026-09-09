import { useMemo } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { BadgeCheckIcon, MailIcon } from 'lucide-react';
import { UserAvatar } from '@/components/ui/avatar';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { AdminDataTable, type AdminColumnDef } from '@/components/admin/ui';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/formatDate';

interface UserRow {
  id: string;
  name?: string;
  username?: string;
  email?: string;
  emailVerified?: boolean;
  avatarUrl?: string;
  image?: string;
  providers?: string[];
  banned?: boolean;
  stripeCustomerId?: string;
  createdAt?: string | number;
}

interface ProviderInfo {
  name: string;
  icon: string | null;
}

const PROVIDER_INFO: Record<string, ProviderInfo> = {
  google: { name: 'Google', icon: '/logos/google.svg' },
  orcid: { name: 'ORCID', icon: '/logos/orcid.svg' },
  credential: { name: 'Email/Password', icon: null },
};

interface UserTableProps {
  users: UserRow[];
  loading?: boolean;
  refreshing?: boolean;
  fillRows?: boolean;
  skeletonRows?: number;
  emptyState?: React.ReactNode;
}

export function UserTable({
  users,
  loading,
  refreshing,
  fillRows,
  skeletonRows,
  emptyState,
}: UserTableProps) {
  const navigate = useNavigate();

  const columns = useMemo<AdminColumnDef<UserRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'User',
        cell: info => {
          const user = info.row.original;
          return (
            <div className='flex items-center gap-2.5'>
              <UserAvatar
                src={user.avatarUrl || user.image}
                name={user.name}
                className='size-6.5'
              />
              <div className='min-w-0'>
                <Link
                  to={'/admin/users/$userId' as string}
                  params={{ userId: user.id } as Record<string, string>}
                  className='text-foreground hover:text-primary font-medium transition-colors'
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  data-testid='admin-user-link'
                  data-user-id={user.id}
                >
                  {user.name || 'Unknown'}
                </Link>
                {user.username && (
                  <p className='text-muted-foreground truncate text-xs'>@{user.username}</p>
                )}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: info => {
          const user = info.row.original;
          return (
            <div className='text-muted-foreground flex items-center gap-1.5'>
              <span>{user.email}</span>
              {user.emailVerified && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <BadgeCheckIcon className='text-success size-3.5 shrink-0' />
                  </TooltipTrigger>
                  <TooltipContent>Email verified</TooltipContent>
                </Tooltip>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'providers',
        header: 'Providers',
        cell: info => {
          const providers = info.row.original.providers || [];
          if (providers.length === 0) {
            return <span className='text-muted-foreground/60'>-</span>;
          }
          return (
            <div className='flex items-center gap-1.5'>
              {providers.map(provider => {
                const providerInfo = PROVIDER_INFO[provider];
                return (
                  <Tooltip key={provider}>
                    <TooltipTrigger asChild>
                      <span className='flex size-4 items-center justify-center'>
                        {providerInfo?.icon ?
                          <img
                            src={providerInfo.icon}
                            alt={providerInfo.name || provider}
                            className='size-4'
                          />
                        : <MailIcon className='text-muted-foreground size-4' />}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{providerInfo?.name || provider}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          );
        },
      },
      {
        accessorKey: 'banned',
        header: 'Status',
        cell: info =>
          info.row.original.banned ?
            <Badge variant='destructive'>Banned</Badge>
          : <Badge variant='secondary'>Active</Badge>,
      },
      {
        accessorKey: 'stripeCustomerId',
        header: 'Stripe customer',
        cell: info => {
          const value = info.getValue() as string | undefined;
          return value ?
              <code className='text-muted-foreground font-mono text-xs'>{value}</code>
            : <span className='text-muted-foreground/60'>-</span>;
        },
      },
      {
        accessorKey: 'createdAt',
        header: 'Joined',
        cell: info => (
          <span className='text-muted-foreground tabular-nums'>
            {formatDate(info.getValue() as string | number | null | undefined)}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <AdminDataTable
      columns={columns}
      data={users || []}
      loading={loading}
      refreshing={refreshing}
      fillRows={fillRows}
      skeletonRows={skeletonRows}
      emptyState={emptyState ?? 'No users found'}
      enableSorting
      onRowClick={(row: UserRow) =>
        navigate({
          to: '/admin/users/$userId' as string,
          params: { userId: row.id } as Record<string, string>,
        })
      }
    />
  );
}
