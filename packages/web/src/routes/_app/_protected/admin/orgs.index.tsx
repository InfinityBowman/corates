import { useState, useMemo } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { BuildingIcon } from 'lucide-react';
import { useAdminOrgs } from '@/hooks/useAdminQueries';
import { formatDate } from '@/lib/formatDate';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  AdminDataTable,
  AdminEmpty,
  AdminListPage,
  AdminSearch,
  ServerPagination,
  type AdminColumnDef,
} from '@/components/admin/ui';

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  stats?: {
    memberCount?: number;
    projectCount?: number;
  };
  createdAt?: string | number;
}

const PAGE_SIZE = 25;

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
    limit: PAGE_SIZE,
    search: debouncedSearch,
  });
  const orgsData = orgsDataQuery.data as
    | {
        orgs: OrgRow[];
        pagination: { limit: number; total: number; totalPages: number };
      }
    | undefined;

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const columns = useMemo<AdminColumnDef<OrgRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Organization',
        cell: info => <span className='text-foreground font-medium'>{info.row.original.name}</span>,
      },
      {
        accessorKey: 'slug',
        header: 'Slug',
        cell: info => (
          <code className='text-muted-foreground font-mono text-xs'>
            {info.getValue() as string}
          </code>
        ),
      },
      {
        accessorKey: 'stats.memberCount',
        header: 'Members',
        meta: { className: 'w-24', align: 'right' },
        cell: info => (
          <span className='text-muted-foreground tabular-nums'>
            {info.row.original.stats?.memberCount ?? 0}
          </span>
        ),
      },
      {
        accessorKey: 'stats.projectCount',
        header: 'Projects',
        meta: { className: 'w-24', align: 'right' },
        cell: info => (
          <span className='text-muted-foreground tabular-nums'>
            {info.row.original.stats?.projectCount ?? 0}
          </span>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Created',
        meta: { className: 'w-32' },
        cell: info => (
          <span className='text-muted-foreground tabular-nums'>
            {formatDate(info.getValue() as string | number | null | undefined)}
          </span>
        ),
      },
    ],
    [],
  );

  const pagination = orgsData?.pagination;

  return (
    <AdminListPage
      title='Organizations'
      count={pagination?.total}
      filters={
        <AdminSearch
          value={search}
          onChange={handleSearchChange}
          placeholder='Search by name or slug...'
          className='w-full max-w-72'
        />
      }
      footer={
        <ServerPagination
          page={page}
          totalPages={pagination?.totalPages ?? 1}
          total={pagination?.total ?? 0}
          limit={pagination?.limit ?? PAGE_SIZE}
          onPageChange={setPage}
          label='organizations'
        />
      }
    >
      <AdminDataTable
        columns={columns}
        data={orgsData?.orgs || []}
        loading={orgsDataQuery.isLoading}
        refreshing={orgsDataQuery.isFetching}
        skeletonRows={PAGE_SIZE}
        variant='page'
        emptyState={
          <AdminEmpty
            icon={BuildingIcon}
            title='No organizations found'
            description={search ? 'Try a different name or slug.' : undefined}
          />
        }
        enableSorting
        onRowClick={(row: OrgRow) =>
          navigate({
            to: '/admin/orgs/$orgId' as string,
            params: { orgId: row.id } as Record<string, string>,
          })
        }
      />
    </AdminListPage>
  );
}
