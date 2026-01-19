/**
 * Project List component for admin dashboard
 * Lists all projects with search, filtering, and pagination
 */

import { createSignal, Show } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import {
  FiSearch,
  FiFolder,
  FiUsers,
  FiFile,
  FiChevronLeft,
  FiChevronRight,
  FiLoader,
  FiAlertCircle,
  FiX,
  FiHome,
} from 'solid-icons/fi';
import { useAdminProjects, useAdminOrgs } from '@primitives/useAdminQueries.js';
import { isAdminChecked, isAdmin } from '@/stores/adminStore.js';
import { SimpleSelect } from '@/components/ui/select';
import { DashboardHeader, AdminSection, AdminDataTable } from './ui/index.js';
import { input } from './styles/admin-tokens.js';

const formatDate = timestamp => {
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

export default function ProjectList() {
  const navigate = useNavigate();
  const [page, setPage] = createSignal(1);
  const [search, setSearch] = createSignal('');
  const [searchInput, setSearchInput] = createSignal('');
  const [selectedOrgId, setSelectedOrgId] = createSignal('');
  const limit = 20;

  // Fetch projects
  const projectsQuery = useAdminProjects(() => ({
    page: page(),
    limit,
    search: search(),
    orgId: selectedOrgId(),
  }));

  // Fetch orgs for filter dropdown
  const orgsQuery = useAdminOrgs(() => ({ page: 1, limit: 100, search: '' }));

  const projects = () => projectsQuery.data?.projects || [];
  const pagination = () => projectsQuery.data?.pagination || { page: 1, total: 0, totalPages: 1 };
  const orgs = () => orgsQuery.data?.orgs || [];

  const handleSearch = e => {
    e.preventDefault();
    setSearch(searchInput());
    setPage(1);
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearch('');
    setPage(1);
  };

  const handleOrgFilter = orgId => {
    setSelectedOrgId(orgId || '');
    setPage(1);
  };

  const columns = [
    {
      accessorKey: 'name',
      header: 'Project',
      cell: info => {
        const project = info.row.original;
        return (
          <A href={`/admin/projects/${project.id}`} class='flex items-center space-x-3'>
            <div class='flex h-10 w-10 items-center justify-center rounded-lg bg-green-100'>
              <FiFolder class='h-5 w-5 text-green-600' />
            </div>
            <div>
              <p class='font-medium text-blue-600 hover:text-blue-700'>{project.name}</p>
              <Show when={project.description}>
                <p class='text-muted-foreground max-w-xs truncate text-sm'>{project.description}</p>
              </Show>
            </div>
          </A>
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
            <A
              href={`/admin/orgs/${project.orgId}`}
              class='text-secondary-foreground flex items-center space-x-2 hover:text-blue-600'
              onClick={e => e.stopPropagation()}
            >
              <FiHome class='h-4 w-4' />
              <span>{project.orgName}</span>
            </A>
            <p class='text-muted-foreground text-xs'>@{project.orgSlug}</p>
          </div>
        );
      },
    },
    {
      accessorKey: 'createdBy',
      header: 'Created By',
      cell: info => {
        const project = info.row.original;
        return (
          <A
            href={`/admin/users/${project.createdBy}`}
            class='text-secondary-foreground hover:text-blue-600'
            onClick={e => e.stopPropagation()}
          >
            {project.creatorDisplayName || project.creatorName || project.creatorEmail}
          </A>
        );
      },
    },
    {
      accessorKey: 'memberCount',
      header: 'Members',
      cell: info => (
        <span class='bg-secondary text-secondary-foreground inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium'>
          <FiUsers class='mr-1 h-3 w-3' />
          {info.getValue()}
        </span>
      ),
    },
    {
      accessorKey: 'fileCount',
      header: 'Files',
      cell: info => (
        <span class='bg-secondary text-secondary-foreground inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium'>
          <FiFile class='mr-1 h-3 w-3' />
          {info.getValue()}
        </span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: info => <span class='text-muted-foreground'>{formatDate(info.getValue())}</span>,
    },
  ];

  return (
    <Show
      when={isAdminChecked()}
      fallback={
        <div class='flex min-h-100 items-center justify-center'>
          <FiLoader class='h-8 w-8 animate-spin text-blue-600' />
        </div>
      }
    >
      <Show
        when={isAdmin()}
        fallback={
          <div class='text-muted-foreground flex min-h-100 flex-col items-center justify-center'>
            <FiAlertCircle class='mb-4 h-12 w-12' />
            <p class='text-lg font-medium'>Access Denied</p>
            <p class='text-sm'>You do not have admin privileges.</p>
          </div>
        }
      >
        <DashboardHeader
          icon={FiFolder}
          title='Projects'
          description='Manage all projects across organizations'
          iconColor='green'
        />

        {/* Search and Filter Bar */}
        <div class='mb-6 flex flex-col gap-4 sm:flex-row'>
          {/* Search */}
          <form onSubmit={handleSearch} class='flex-1'>
            <div class='relative'>
              <FiSearch class='text-muted-foreground/70 pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
              <input
                type='text'
                value={searchInput()}
                onInput={e => setSearchInput(e.target.value)}
                placeholder='Search by project name...'
                class={`w-full ${input.base} ${input.withIconLeft} pr-10`}
              />
              <Show when={searchInput()}>
                <button
                  type='button'
                  onClick={clearSearch}
                  class='text-muted-foreground/70 hover:text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2'
                >
                  <FiX class='h-4 w-4' />
                </button>
              </Show>
            </div>
          </form>

          {/* Org Filter */}
          <div class='w-full sm:w-64'>
            <SimpleSelect
              value={selectedOrgId()}
              onChange={value => handleOrgFilter(value)}
              placeholder='All Organizations'
              items={[
                { value: '', label: 'All Organizations' },
                ...orgs().map(org => ({ value: org.id, label: org.name })),
              ]}
            />
          </div>
        </div>

        {/* Error State */}
        <Show when={projectsQuery.isError}>
          <div class='rounded-lg border border-red-200 bg-red-50 p-6 text-center'>
            <FiAlertCircle class='mx-auto mb-2 h-8 w-8 text-red-500' />
            <p class='text-red-700'>Failed to load projects</p>
            <button
              onClick={() => projectsQuery.refetch()}
              class='mt-2 text-sm text-red-600 hover:text-red-700'
            >
              Try again
            </button>
          </div>
        </Show>

        {/* Projects Table */}
        <Show when={!projectsQuery.isError}>
          <AdminSection title='All Projects'>
            <AdminDataTable
              columns={columns}
              data={projects()}
              loading={projectsQuery.isLoading}
              emptyState={
                <div class='flex flex-col items-center gap-2'>
                  <FiFolder class='text-muted-foreground/50 h-8 w-8' />
                  <span class='text-muted-foreground'>No projects found</span>
                  <Show when={search() || selectedOrgId()}>
                    <button
                      onClick={() => {
                        clearSearch();
                        setSelectedOrgId('');
                      }}
                      class='text-sm text-blue-600 hover:text-blue-700'
                    >
                      Clear filters
                    </button>
                  </Show>
                </div>
              }
              enableSorting
              onRowClick={row => navigate(`/admin/projects/${row.id}`)}
            />

            {/* Server-side Pagination */}
            <Show when={pagination().totalPages > 1}>
              <div class='mt-4 flex items-center justify-between'>
                <div class='text-muted-foreground text-sm'>
                  Showing {(pagination().page - 1) * limit + 1} to{' '}
                  {Math.min(pagination().page * limit, pagination().total)} of {pagination().total}{' '}
                  projects
                </div>
                <div class='flex items-center space-x-2'>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page() === 1}
                    class='border-border bg-card text-muted-foreground hover:bg-muted rounded-xl border p-2 shadow-xs disabled:cursor-not-allowed disabled:opacity-50'
                  >
                    <FiChevronLeft class='h-4 w-4' />
                  </button>
                  <span class='text-muted-foreground text-sm'>
                    Page {pagination().page} of {pagination().totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(pagination().totalPages, p + 1))}
                    disabled={page() === pagination().totalPages}
                    class='border-border bg-card text-muted-foreground hover:bg-muted rounded-xl border p-2 shadow-xs disabled:cursor-not-allowed disabled:opacity-50'
                  >
                    <FiChevronRight class='h-4 w-4' />
                  </button>
                </div>
              </div>
            </Show>
          </AdminSection>
        </Show>
      </Show>
    </Show>
  );
}
