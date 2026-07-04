import { useState, useMemo } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
  SearchIcon,
  FolderIcon,
  UsersIcon,
  FileTextIcon,
  AlertCircleIcon,
  HomeIcon,
  LoaderIcon,
  ZapIcon,
} from 'lucide-react';
import { useAdminProjects, useAdminOrgs } from '@/hooks/useAdminQueries';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { formatDate } from '@/lib/formatDate';
import {
  DashboardHeader,
  AdminSection,
  AdminDataTable,
  ServerPagination,
} from '@/components/admin/ui';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { wakeAllProjectDOsAction } from '@/server/functions/admin-projects.functions';
import type { ColumnDef } from '@tanstack/react-table';

interface ProjectRow {
  id: string;
  name: string;
  description?: string;
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

export const Route = createFileRoute('/_app/_protected/admin/projects/')({
  component: AdminProjectList,
});

interface WakeResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: Array<{ projectId: string; error: string }>;
}

function AdminProjectList() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [waking, setWaking] = useState(false);
  const [wakeResult, setWakeResult] = useState<WakeResult | null>(null);

  const handleWakeAllDOs = async () => {
    setWaking(true);
    setWakeResult(null);
    try {
      const result = await wakeAllProjectDOsAction();
      setWakeResult(result as WakeResult);
    } catch {
      setWakeResult({
        total: 0,
        succeeded: 0,
        failed: 1,
        errors: [{ projectId: '-', error: 'Request failed' }],
      });
    } finally {
      setWaking(false);
    }
  };
  const limit = 20;

  const projectsQuery = useAdminProjects({
    page,
    limit,
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
  const pagination = projectsData?.pagination || { page: 1, total: 0, totalPages: 1 };
  const orgs = orgsData?.orgs || [];

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleOrgFilter = (orgId: string) => {
    setSelectedOrgId(orgId || '');
    setPage(1);
  };

  const columns = useMemo<ColumnDef<ProjectRow, unknown>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Project',
        cell: info => {
          const project = info.row.original;
          return (
            <Link
              to={'/admin/projects/$projectId' as string}
              params={{ projectId: project.id } as Record<string, string>}
              className='flex items-center gap-3'
            >
              <div className='bg-success-bg flex size-10 items-center justify-center rounded-lg'>
                <FolderIcon className='text-success size-5' />
              </div>
              <div>
                <p className='text-primary hover:text-primary/80 font-medium'>{project.name}</p>
                {project.description && (
                  <p className='text-muted-foreground max-w-xs truncate text-sm'>
                    {project.description}
                  </p>
                )}
              </div>
            </Link>
          );
        },
      },
      {
        accessorKey: 'orgName',
        header: 'Organization',
        cell: info => {
          const project = info.row.original;
          return (
            <div>
              <Link
                to={'/admin/orgs/$orgId' as string}
                params={{ orgId: project.orgId } as Record<string, string>}
                className='text-secondary-foreground hover:text-primary flex items-center gap-2'
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
              >
                <HomeIcon className='size-4' />
                <span>{project.orgName}</span>
              </Link>
              <p className='text-muted-foreground text-xs'>@{project.orgSlug}</p>
            </div>
          );
        },
      },
      {
        accessorKey: 'memberCount',
        header: 'Members',
        cell: info => (
          <span className='bg-secondary text-secondary-foreground inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium'>
            <UsersIcon className='mr-1 size-3' />
            {info.getValue() as number}
          </span>
        ),
      },
      {
        accessorKey: 'fileCount',
        header: 'Files',
        cell: info => (
          <span className='bg-secondary text-secondary-foreground inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium'>
            <FileTextIcon className='mr-1 size-3' />
            {info.getValue() as number}
          </span>
        ),
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
    ],
    [],
  );

  return (
    <div className='flex flex-col gap-8'>
      <DashboardHeader
        icon={FolderIcon}
        title='Projects'
        description='Manage all projects across organizations'
        iconColor='green'
      />

      {/* DO Operations */}
      <AdminSection title='Durable Object Operations'>
        <div className='flex items-center gap-4'>
          <Button variant='outline' size='sm' onClick={handleWakeAllDOs} disabled={waking}>
            {waking ?
              <LoaderIcon className='mr-2 size-4 animate-spin' />
            : <ZapIcon className='mr-2 size-4' />}
            {waking ? 'Waking DOs...' : 'Wake All DOs'}
          </Button>
          {wakeResult && (
            <span className='text-muted-foreground text-sm'>
              {wakeResult.succeeded}/{wakeResult.total} succeeded
              {wakeResult.failed > 0 && (
                <span className='text-destructive ml-1'>({wakeResult.failed} failed)</span>
              )}
            </span>
          )}
        </div>
        {wakeResult && wakeResult.errors.length > 0 && (
          <div className='border-destructive/20 bg-destructive/5 mt-2 rounded border p-3 text-sm'>
            {wakeResult.errors.map((e, i) => (
              <div key={i} className='text-destructive'>
                {e.projectId}: {e.error}
              </div>
            ))}
          </div>
        )}
      </AdminSection>

      {/* Search and Filter Bar */}
      <div className='flex flex-col gap-4 sm:flex-row'>
        <div className='relative flex-1'>
          <SearchIcon className='text-muted-foreground/70 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2' />
          <Input
            type='text'
            value={search}
            onChange={handleSearchInput}
            placeholder='Search by project name...'
            className='w-full pl-10'
          />
        </div>

        {/* Org Filter */}
        <div className='w-full sm:w-64'>
          <Select
            value={selectedOrgId || 'all'}
            onValueChange={v => handleOrgFilter(v === 'all' ? '' : v)}
          >
            <SelectTrigger className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Organizations</SelectItem>
              {orgs.map(org => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Error State */}
      {projectsQuery.isError && (
        <div className='border-destructive/20 bg-destructive/10 rounded-lg border p-6 text-center'>
          <AlertCircleIcon className='text-destructive mx-auto mb-2 size-8' />
          <p className='text-destructive'>Failed to load projects</p>
          <Button
            type='button'
            variant='link'
            onClick={() => projectsQuery.refetch()}
            className='text-destructive hover:text-destructive/80 mt-2'
          >
            Try again
          </Button>
        </div>
      )}

      {/* Projects Table */}
      {!projectsQuery.isError && (
        <AdminSection title='All Projects'>
          <AdminDataTable
            columns={columns}
            data={projects}
            loading={projectsQuery.isLoading}
            emptyState={
              <div className='flex flex-col items-center gap-2'>
                <FolderIcon className='text-muted-foreground/50 size-8' />
                <span className='text-muted-foreground'>No projects found</span>
                {(search || selectedOrgId) && (
                  <Button
                    type='button'
                    variant='link'
                    onClick={() => {
                      setSearch('');
                      setSelectedOrgId('');
                    }}
                    className='text-primary hover:text-primary/80'
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            }
            enableSorting
            onRowClick={(row: ProjectRow) =>
              navigate({
                to: '/admin/projects/$projectId' as string,
                params: { projectId: row.id } as Record<string, string>,
              })
            }
          />

          <ServerPagination
            page={page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            limit={limit}
            onPageChange={setPage}
            label='projects'
          />
        </AdminSection>
      )}
    </div>
  );
}
