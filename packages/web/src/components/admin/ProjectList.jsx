/**
 * Project List component for admin dashboard
 * Lists all projects with search, filtering, and pagination
 */

import { createSignal, Show, For } from 'solid-js';
import { A } from '@solidjs/router';
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
import { Select } from '@corates/ui';
import { DashboardHeader, AdminSection, AdminBox } from './ui/index.js';
import { input, table } from './styles/admin-tokens.js';

export default function ProjectList() {
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
          <div class='flex min-h-100 flex-col items-center justify-center text-gray-500'>
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
              <FiSearch class='pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400' />
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
                  class='absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-600'
                >
                  <FiX class='h-4 w-4' />
                </button>
              </Show>
            </div>
          </form>

          {/* Org Filter */}
          <div class='w-full sm:w-64'>
            <Select
              value={selectedOrgId()}
              onValueChange={value => handleOrgFilter(value)}
              placeholder='All Organizations'
              items={[
                { value: '', label: 'All Organizations' },
                ...orgs().map(org => ({ value: org.id, label: org.name })),
              ]}
            />
          </div>
        </div>

        {/* Loading State */}
        <Show when={projectsQuery.isLoading}>
          <div class='flex min-h-64 items-center justify-center'>
            <FiLoader class='h-8 w-8 animate-spin text-blue-600' />
          </div>
        </Show>

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
        <Show when={!projectsQuery.isLoading && !projectsQuery.isError}>
          <AdminSection title='All Projects'>
            <AdminBox padding='compact' class='overflow-hidden p-0'>
              <div class='overflow-x-auto'>
                <table class={table.base}>
                  <thead class={table.header}>
                    <tr class='border-b border-gray-200'>
                      <th class={table.headerCell}>Project</th>
                      <th class={table.headerCell}>Organization</th>
                      <th class={table.headerCell}>Created By</th>
                      <th class={`${table.headerCell} text-center`}>Members</th>
                      <th class={`${table.headerCell} text-center`}>Files</th>
                      <th class={table.headerCell}>Created</th>
                    </tr>
                  </thead>
                  <tbody class={table.body}>
                    <For
                      each={projects()}
                      fallback={
                        <tr>
                          <td colspan='6' class='px-6 py-12 text-center text-gray-500'>
                            <FiFolder class='mx-auto mb-2 h-8 w-8 text-gray-300' />
                            <p>No projects found</p>
                            <Show when={search() || selectedOrgId()}>
                              <button
                                onClick={() => {
                                  clearSearch();
                                  setSelectedOrgId('');
                                }}
                                class='mt-2 text-sm text-blue-600 hover:text-blue-700'
                              >
                                Clear filters
                              </button>
                            </Show>
                          </td>
                        </tr>
                      }
                    >
                      {project => (
                        <tr class={table.row}>
                          <td class={table.cell}>
                            <A
                              href={`/admin/projects/${project.id}`}
                              class='flex items-center space-x-3'
                            >
                              <div class='flex h-10 w-10 items-center justify-center rounded-lg bg-green-100'>
                                <FiFolder class='h-5 w-5 text-green-600' />
                              </div>
                              <div>
                                <p class='font-medium text-blue-600 hover:text-blue-700'>
                                  {project.name}
                                </p>
                                <Show when={project.description}>
                                  <p class='max-w-xs truncate text-sm text-gray-500'>
                                    {project.description}
                                  </p>
                                </Show>
                              </div>
                            </A>
                          </td>
                          <td class={table.cell}>
                            <A
                              href={`/admin/orgs/${project.orgId}`}
                              class='flex items-center space-x-2 text-gray-700 hover:text-blue-600'
                            >
                              <FiHome class='h-4 w-4' />
                              <span>{project.orgName}</span>
                            </A>
                            <p class='text-xs text-gray-500'>@{project.orgSlug}</p>
                          </td>
                          <td class={table.cell}>
                            <A
                              href={`/admin/users/${project.createdBy}`}
                              class='text-gray-700 hover:text-blue-600'
                            >
                              {project.creatorDisplayName ||
                                project.creatorName ||
                                project.creatorEmail}
                            </A>
                          </td>
                          <td class={`${table.cell} text-center`}>
                            <span class='inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-medium text-gray-700'>
                              <FiUsers class='mr-1 h-3 w-3' />
                              {project.memberCount}
                            </span>
                          </td>
                          <td class={`${table.cell} text-center`}>
                            <span class='inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-medium text-gray-700'>
                              <FiFile class='mr-1 h-3 w-3' />
                              {project.fileCount}
                            </span>
                          </td>
                          <td class={`${table.cell} text-gray-500`}>
                            {formatDate(project.createdAt)}
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <Show when={pagination().totalPages > 1}>
                <div class='flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-3'>
                  <div class='text-sm text-gray-500'>
                    Showing {(pagination().page - 1) * limit + 1} to{' '}
                    {Math.min(pagination().page * limit, pagination().total)} of{' '}
                    {pagination().total} projects
                  </div>
                  <div class='flex items-center space-x-2'>
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page() === 1}
                      class='rounded-xl border border-gray-200 bg-white p-2 text-gray-600 shadow-xs hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50'
                    >
                      <FiChevronLeft class='h-4 w-4' />
                    </button>
                    <span class='text-sm text-gray-500'>
                      Page {pagination().page} of {pagination().totalPages}
                    </span>
                    <button
                      onClick={() => setPage(p => Math.min(pagination().totalPages, p + 1))}
                      disabled={page() === pagination().totalPages}
                      class='rounded-xl border border-gray-200 bg-white p-2 text-gray-600 shadow-xs hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50'
                    >
                      <FiChevronRight class='h-4 w-4' />
                    </button>
                  </div>
                </div>
              </Show>
            </AdminBox>
          </AdminSection>
        </Show>
      </Show>
    </Show>
  );
}
