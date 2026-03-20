/**
 * Admin Project List route
 * Lists all projects with search, org filtering, and pagination
 */

import { useState, useMemo } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
  SearchIcon,
  FolderIcon,
  UsersIcon,
  FileTextIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  AlertCircleIcon,
  XIcon,
  HomeIcon,
} from 'lucide-react';
import { useAdminProjects, useAdminOrgs } from '@/hooks/useAdminQueries';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { DashboardHeader, AdminSection, AdminDataTable } from '@/components/admin/ui';
import { Input } from '@/components/ui/input';
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
  });
};

export const Route = createFileRoute('/_app/_protected/admin/projects')({
  component: AdminProjectList,
});

function AdminProjectList() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearch('');
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
              <div className='bg-success/10 flex size-10 items-center justify-center rounded-lg'>
                <FolderIcon className='text-success size-5' />
              </div>
              <div>
                <p className='font-medium text-blue-600 hover:text-blue-700'>{project.name}</p>
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
                className='text-secondary-foreground flex items-center gap-2 hover:text-blue-600'
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
    <>
      <DashboardHeader
        icon={FolderIcon}
        title='Projects'
        description='Manage all projects across organizations'
        iconColor='green'
      />

      {/* Search and Filter Bar */}
      <div className='mb-6 flex flex-col gap-4 sm:flex-row'>
        <form onSubmit={handleSearch} className='flex-1'>
          <div className='relative'>
            <SearchIcon className='text-muted-foreground/70 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2' />
            <Input
              type='text'
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder='Search by project name...'
              className='w-full pr-10 pl-10'
            />
            {searchInput && (
              <button
                type='button'
                onClick={clearSearch}
                className='text-muted-foreground/70 hover:text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2'
              >
                <XIcon className='size-4' />
              </button>
            )}
          </div>
        </form>

        {/* Org Filter */}
        <div className='w-full sm:w-64'>
          <select
            value={selectedOrgId}
            onChange={e => handleOrgFilter(e.target.value)}
            className='border-input h-8 rounded-lg border bg-transparent px-2.5 py-2 text-sm'
          >
            <option value=''>All Organizations</option>
            {orgs.map(org => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error State */}
      {projectsQuery.isError && (
        <div className='border-destructive/20 bg-destructive/10 rounded-lg border p-6 text-center'>
          <AlertCircleIcon className='text-destructive mx-auto mb-2 size-8' />
          <p className='text-destructive'>Failed to load projects</p>
          <button
            type='button'
            onClick={() => projectsQuery.refetch()}
            className='text-destructive hover:text-destructive/80 mt-2 text-sm'
          >
            Try again
          </button>
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
                  <button
                    type='button'
                    onClick={() => {
                      clearSearch();
                      setSelectedOrgId('');
                    }}
                    className='text-sm text-blue-600 hover:text-blue-700'
                  >
                    Clear filters
                  </button>
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

          {/* Server-side Pagination */}
          {pagination.totalPages > 1 && (
            <div className='mt-4 flex items-center justify-between'>
              <div className='text-muted-foreground text-sm'>
                Showing {(pagination.page - 1) * limit + 1} to{' '}
                {Math.min(pagination.page * limit, pagination.total)} of {pagination.total} projects
              </div>
              <div className='flex items-center gap-2'>
                <button
                  type='button'
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className='border-border bg-card text-muted-foreground hover:bg-muted rounded-xl border p-2 shadow-xs disabled:cursor-not-allowed disabled:opacity-50'
                >
                  <ChevronLeftIcon className='size-4' />
                </button>
                <span className='text-muted-foreground text-sm'>
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  type='button'
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                  className='border-border bg-card text-muted-foreground hover:bg-muted rounded-xl border p-2 shadow-xs disabled:cursor-not-allowed disabled:opacity-50'
                >
                  <ChevronRightIcon className='size-4' />
                </button>
              </div>
            </div>
          )}
        </AdminSection>
      )}
    </>
  );
}
