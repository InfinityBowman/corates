import { useState, useMemo } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { SearchIcon, HomeIcon, UsersIcon, FolderIcon } from 'lucide-react';
import { useAdminOrgs } from '@/hooks/useAdminQueries';
import { formatDate } from '@/lib/formatDate';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  DashboardHeader,
  AdminSection,
  AdminDataTable,
  ServerPagination,
} from '@/components/admin/ui';
import { Input } from '@/components/ui/input';
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

export const Route = createFileRoute('/_app/_protected/admin/orgs/')({
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
            <div className='flex items-center gap-3'>
              <div className='bg-info-bg flex size-10 items-center justify-center rounded-lg'>
                <HomeIcon className='text-info size-5' />
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
            <div className='text-muted-foreground flex items-center gap-1'>
              <UsersIcon className='text-muted-foreground/70 size-4' />
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
            <div className='text-muted-foreground flex items-center gap-1'>
              <FolderIcon className='text-muted-foreground/70 size-4' />
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
              className='bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-ring/50 inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium focus:ring-[3px] focus:outline-none'
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              Details
            </Link>
          );
        },
      },
    ],
    [],
  );

  return (
    <div className='flex flex-col gap-8'>
      <DashboardHeader
        icon={HomeIcon}
        title='Organizations'
        description='Manage organizations and billing'
      />

      <AdminSection
        title='Organizations'
        cta={
          <div className='relative'>
            <SearchIcon className='text-muted-foreground/70 absolute top-1/2 left-3 size-4 -translate-y-1/2' />
            <Input
              type='text'
              placeholder='Search by name or slug...'
              value={search}
              onChange={handleSearchInput}
              className='w-64 pl-10'
            />
          </div>
        }
      >
        <AdminDataTable
          columns={columns}
          data={orgsData?.orgs || []}
          loading={orgsDataQuery.isLoading}
          emptyState='No organizations found'
          enableSorting
          onRowClick={(row: OrgRow) =>
            navigate({
              to: '/admin/orgs/$orgId' as string,
              params: { orgId: row.id } as Record<string, string>,
            })
          }
        />

        {orgsData?.pagination && (
          <ServerPagination
            page={page}
            totalPages={orgsData.pagination.totalPages || 1}
            total={orgsData.pagination.total || 0}
            limit={orgsData.pagination.limit || 20}
            onPageChange={setPage}
            label='organizations'
          />
        )}
      </AdminSection>
    </div>
  );
}
