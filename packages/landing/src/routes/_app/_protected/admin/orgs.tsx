/**
 * Admin Org List route
 * Lists all organizations with search, pagination, and navigation to details
 */

import { useState, useMemo } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
  SearchIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  HomeIcon,
  UsersIcon,
  FolderIcon,
} from 'lucide-react';
import { useAdminOrgs } from '@/hooks/useAdminQueries';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { DashboardHeader, AdminSection, AdminDataTable } from '@/components/admin/ui';
import { input } from '@/components/admin/styles/admin-tokens';
import type { ColumnDef } from '@tanstack/react-table';

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  stats?: {
    memberCount?: number;
    projectCount?: number;
  };
  plan?: string;
  createdAt?: string | number;
}

const formatDate = (timestamp: string | number | null | undefined): string => {
  if (!timestamp) return '-';
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const Route = createFileRoute('/_app/_protected/admin/orgs')({
  component: AdminOrgList,
});

function AdminOrgList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, 300);

  const orgsDataQuery = useAdminOrgs({
    page,
    limit: 20,
    search: debouncedSearch,
  });
  const orgsData = orgsDataQuery.data as
    | {
        orgs: OrgRow[];
        pagination: { limit: number; total: number; totalPages: number };
      }
    | undefined;

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const columns = useMemo<ColumnDef<OrgRow, unknown>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Organization',
        cell: info => {
          const org = info.row.original;
          return (
            <div className='flex items-center space-x-3'>
              <div className='flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100'>
                <HomeIcon className='h-5 w-5 text-blue-600' />
              </div>
              <div>
                <p className='text-foreground font-medium'>{org.name}</p>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'slug',
        header: 'Slug',
        cell: info => (
          <code className='bg-secondary text-secondary-foreground rounded px-2 py-1 text-sm'>
            {info.getValue() as string}
          </code>
        ),
      },
      {
        accessorKey: 'stats.memberCount',
        header: 'Members',
        cell: info => {
          const org = info.row.original;
          return (
            <div className='text-muted-foreground flex items-center space-x-1'>
              <UsersIcon className='text-muted-foreground/70 h-4 w-4' />
              <span>{org.stats?.memberCount ?? '-'}</span>
            </div>
          );
        },
      },
      {
        accessorKey: 'stats.projectCount',
        header: 'Projects',
        cell: info => {
          const org = info.row.original;
          return (
            <div className='text-muted-foreground flex items-center space-x-1'>
              <FolderIcon className='text-muted-foreground/70 h-4 w-4' />
              <span>{org.stats?.projectCount ?? '-'}</span>
            </div>
          );
        },
      },
      {
        accessorKey: 'createdAt',
        header: 'Created',
        cell: info => (
          <span className='text-muted-foreground'>
            {formatDate(info.getValue() as string | number | null | undefined)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: info => {
          const org = info.row.original;
          return (
            <Link
              to={'/admin/orgs/$orgId' as string}
              params={{ orgId: org.id } as Record<string, string>}
              className='inline-flex items-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-[3px] focus:ring-blue-100 focus:outline-none'
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              Details
            </Link>
          );
        },
      },
    ],
    [navigate],
  );

  return (
    <>
      <DashboardHeader
        icon={HomeIcon}
        title='Organizations'
        description='Manage organizations and billing'
      />

      <AdminSection
        title='Organizations'
        cta={
          <div className='relative'>
            <SearchIcon className='text-muted-foreground/70 absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
            <input
              type='text'
              placeholder='Search by name or slug...'
              value={search}
              onChange={handleSearchInput}
              className={`w-64 ${input.base} ${input.withIconLeft}`}
            />
          </div>
        }
      >
        <AdminDataTable
          columns={columns}
          data={orgsData?.orgs || []}
          loading={orgsDataQuery.isLoading}
          emptyMessage='No organizations found'
          enableSorting
          onRowClick={(row: OrgRow) =>
            navigate({
              to: '/admin/orgs/$orgId' as string,
              params: { orgId: row.id } as Record<string, string>,
            })
          }
        />

        {/* Server-side Pagination */}
        {orgsData?.pagination && (
          <div className='mt-4 flex items-center justify-between'>
            <p className='text-muted-foreground text-sm'>
              {(orgsData.pagination.total || 0) > 0 ?
                `Showing ${(page - 1) * (orgsData.pagination.limit || 20) + 1} to ${Math.min(
                  page * (orgsData.pagination.limit || 20),
                  orgsData.pagination.total || 0,
                )} of ${orgsData.pagination.total || 0} organizations`
              : 'No organizations found'}
            </p>
            <div className='flex items-center space-x-2'>
              <button
                type='button'
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className='border-border bg-card text-muted-foreground hover:bg-muted rounded-xl border p-2 shadow-xs disabled:cursor-not-allowed disabled:opacity-50'
              >
                <ChevronLeftIcon className='h-4 w-4' />
              </button>
              <span className='text-muted-foreground text-sm'>
                Page {page} of {orgsData.pagination.totalPages || 1}
              </span>
              <button
                type='button'
                onClick={() => setPage(p => Math.min(orgsData.pagination.totalPages || 1, p + 1))}
                disabled={page >= (orgsData.pagination.totalPages || 1)}
                className='border-border bg-card text-muted-foreground hover:bg-muted rounded-xl border p-2 shadow-xs disabled:cursor-not-allowed disabled:opacity-50'
              >
                <ChevronRightIcon className='h-4 w-4' />
              </button>
            </div>
          </div>
        )}
      </AdminSection>
    </>
  );
}
