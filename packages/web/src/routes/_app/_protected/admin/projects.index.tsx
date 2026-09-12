import { useState, useMemo } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { FolderIcon } from 'lucide-react';
import { useAdminProjects, useAdminOrgs } from '@/hooks/useAdminQueries';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { formatDate } from '@/lib/formatDate';
import {
  AdminDataTable,
  AdminEmpty,
  AdminError,
  AdminListPage,
  AdminPage,
  AdminSearch,
  ServerPagination,
  type AdminColumnDef,
} from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ProjectRow {
  id: string;
  name: string;
  orgId: string;
  orgName: string;
  orgSlug: string;
  createdBy: string;
  creatorDisplayName?: string;
  creatorName?: string;
  creatorEmail?: string;
  memberCount: number;
  fileCount: number;
  createdAt?: string | number;
}

interface OrgOption {
  id: string;
  name: string;
}

const PAGE_SIZE = 25;
const ALL_ORGS_VALUE = 'all';

export const Route = createFileRoute('/_app/_protected/admin/projects/')({
  component: AdminProjectList,
});

function AdminProjectList() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);

  const projectsQuery = useAdminProjects({
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch,
    orgId: selectedOrgId,
  });
  const projectsData = projectsQuery.data as
    | {
        projects: ProjectRow[];
        pagination: { page: number; total: number; totalPages: number };
      }
    | undefined;

  const orgsQuery = useAdminOrgs({ page: 1, limit: 100, search: '' });
  const orgsData = orgsQuery.data as { orgs: OrgOption[] } | undefined;

  const projects = projectsData?.projects || [];
  const pagination = projectsData?.pagination;
  const orgs = orgsData?.orgs || [];

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleOrgFilter = (orgId: string) => {
    setSelectedOrgId(orgId);
    setPage(1);
  };

  const columns = useMemo<AdminColumnDef<ProjectRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Project',
        cell: info => <span className='text-foreground font-medium'>{info.row.original.name}</span>,
      },
      {
        accessorKey: 'orgName',
        header: 'Organization',
        cell: info => {
          const project = info.row.original;
          return (
            <Link
              to={'/admin/orgs/$orgId' as string}
              params={{ orgId: project.orgId } as Record<string, string>}
              className='text-muted-foreground hover:text-primary transition-colors'
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              {project.orgName}
            </Link>
          );
        },
      },
      {
        accessorKey: 'creatorDisplayName',
        header: 'Created by',
        cell: info => {
          const project = info.row.original;
          const name = project.creatorDisplayName || project.creatorName;
          if (!name && !project.creatorEmail) {
            return <span className='text-muted-foreground/60'>-</span>;
          }
          return (
            <Link
              to={'/admin/users/$userId' as string}
              params={{ userId: project.createdBy } as Record<string, string>}
              className='text-muted-foreground hover:text-primary transition-colors'
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              {name || project.creatorEmail}
            </Link>
          );
        },
      },
      {
        accessorKey: 'memberCount',
        header: 'Members',
        meta: { className: 'w-24', align: 'right' },
        cell: info => (
          <span className='text-muted-foreground tabular-nums'>{info.getValue() as number}</span>
        ),
      },
      {
        accessorKey: 'fileCount',
        header: 'Files',
        meta: { className: 'w-20', align: 'right' },
        cell: info => (
          <span className='text-muted-foreground tabular-nums'>{info.getValue() as number}</span>
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

  if (projectsQuery.isError) {
    return (
      <AdminPage title='Projects' description='Every project across all organizations'>
        <AdminError title='Failed to load projects' onRetry={() => projectsQuery.refetch()} />
      </AdminPage>
    );
  }

  return (
    <AdminListPage
      title='Projects'
      count={pagination?.total}
      filters={
        <>
          <AdminSearch
            value={search}
            onChange={handleSearchChange}
            placeholder='Search by project name...'
            className='w-full max-w-64'
          />
          <Select
            value={selectedOrgId || ALL_ORGS_VALUE}
            onValueChange={v => handleOrgFilter(v === ALL_ORGS_VALUE ? '' : v)}
          >
            <SelectTrigger className='w-48 text-[13px]'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ORGS_VALUE}>All organizations</SelectItem>
              {orgs.map(org => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      }
      footer={
        <ServerPagination
          page={page}
          totalPages={pagination?.totalPages ?? 1}
          total={pagination?.total ?? 0}
          limit={PAGE_SIZE}
          onPageChange={setPage}
          label='projects'
        />
      }
    >
      <AdminDataTable
        columns={columns}
        data={projects}
        loading={projectsQuery.isLoading}
        refreshing={projectsQuery.isFetching}
        skeletonRows={PAGE_SIZE}
        variant='page'
        emptyState={
          <AdminEmpty
            icon={FolderIcon}
            title='No projects found'
            description={
              search || selectedOrgId ? 'No project matches the current filters.' : undefined
            }
            action={
              (search || selectedOrgId) && (
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => {
                    setSearch('');
                    setSelectedOrgId('');
                    setPage(1);
                  }}
                >
                  Clear filters
                </Button>
              )
            }
          />
        }
        enableSorting
        onRowClick={(row: ProjectRow) =>
          navigate({
            to: '/admin/projects/$projectId' as string,
            params: { projectId: row.id } as Record<string, string>,
          })
        }
      />
    </AdminListPage>
  );
}
