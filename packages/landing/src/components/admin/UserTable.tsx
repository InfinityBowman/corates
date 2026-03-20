/**
 * User Table component for admin dashboard
 * Lists users with search and pagination via AdminDataTable
 */

import { useMemo } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { CheckCircleIcon, MailIcon } from 'lucide-react';
import { UserAvatar } from '@/components/ui/avatar';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { AdminDataTable } from '@/components/admin/ui';
import { getStatusBadgeClass } from '@/components/admin/styles/admin-tokens';
import type { ColumnDef } from '@tanstack/react-table';

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

const formatDate = (timestamp: string | number | null | undefined): string => {
  if (!timestamp) return '-';
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

interface UserTableProps {
  users: UserRow[];
  loading?: boolean;
}

export function UserTable({ users, loading }: UserTableProps) {
  const navigate = useNavigate();

  const columns = useMemo<ColumnDef<UserRow, unknown>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'User',
        cell: info => {
          const user = info.row.original;
          return (
            <div className='flex items-center space-x-3'>
              <UserAvatar src={user.avatarUrl || user.image} name={user.name} className='h-8 w-8' />
              <div>
                <Link
                  to={'/admin/users/$userId' as string}
                  params={{ userId: user.id } as Record<string, string>}
                  className='font-medium text-blue-600 hover:text-blue-700 hover:underline'
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                >
                  {user.name || 'Unknown'}
                </Link>
                {user.username && <p className='text-muted-foreground text-sm'>@{user.username}</p>}
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
            <div className='flex items-center space-x-2'>
              <span className='text-muted-foreground text-sm'>{user.email}</span>
              {user.emailVerified && (
                <span title='Email verified'>
                  <CheckCircleIcon className='h-4 w-4 text-green-500' />
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'providers',
        header: 'Providers',
        cell: info => {
          const user = info.row.original;
          const providers = user.providers || [];
          return (
            <div className='flex items-center gap-1.5'>
              {providers.length > 0 ?
                providers.map(provider => {
                  const providerInfo = PROVIDER_INFO[provider];
                  return (
                    <Tooltip key={provider}>
                      <TooltipTrigger asChild>
                        <div className='flex h-5 w-5 items-center justify-center'>
                          {providerInfo?.icon ?
                            <img
                              src={providerInfo.icon}
                              alt={providerInfo.name || provider}
                              title={providerInfo.name || provider}
                              className='h-4 w-4'
                            />
                          : <MailIcon className='text-muted-foreground h-4 w-4' />}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>{providerInfo?.name || provider}</TooltipContent>
                    </Tooltip>
                  );
                })
              : <span className='text-muted-foreground/70 text-xs'>None</span>}
            </div>
          );
        },
      },
      {
        accessorKey: 'banned',
        header: 'Status',
        cell: info => {
          const user = info.row.original;
          return user.banned ?
              <span className={getStatusBadgeClass('error')}>Banned</span>
            : <span className={getStatusBadgeClass('success')}>Active</span>;
        },
      },
      {
        accessorKey: 'stripeCustomerId',
        header: 'Stripe Customer',
        cell: info => {
          const value = info.getValue() as string | undefined;
          return value ?
              <code className='bg-secondary text-secondary-foreground rounded px-2 py-1 text-xs'>
                {value}
              </code>
            : <span className='text-muted-foreground/70 text-sm'>-</span>;
        },
      },
      {
        accessorKey: 'createdAt',
        header: 'Joined',
        cell: info => (
          <span className='text-muted-foreground'>
            {formatDate(info.getValue() as string | number | null | undefined)}
          </span>
        ),
      },
    ],
    [navigate],
  );

  return (
    <AdminDataTable
      columns={columns}
      data={users || []}
      loading={loading}
      emptyMessage='No users found'
      enableSorting
      pageSize={20}
      onRowClick={(_row: UserRow) =>
        navigate({
          to: '/admin/users/$userId' as string,
          params: { userId: _row.id } as Record<string, string>,
        })
      }
    />
  );
}
