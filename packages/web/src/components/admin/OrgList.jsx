import { createSignal, Show, For } from 'solid-js';
import { A } from '@solidjs/router';
import {
  FiSearch,
  FiChevronLeft,
  FiChevronRight,
  FiHome,
  FiUsers,
  FiFolder,
  FiShield,
  FiLoader,
} from 'solid-icons/fi';
import { useAdminOrgs } from '@primitives/useAdminQueries.js';
import { isAdminChecked, isAdmin } from '@/stores/adminStore.js';
import { useDebouncedSignal } from '@/primitives/useDebouncedSignal.js';

/**
 * Org List component for admin dashboard
 * Lists all organizations with search and pagination
 * Allows admins to view organization details and navigate to organization management
 * @returns {JSX.Element} - The OrgList component
 */
export default function OrgList() {
  const [search, setSearch, debouncedSearch] = useDebouncedSignal('', 300);
  const [page, setPage] = createSignal(1);

  // Fetch orgs with pagination and search
  const orgsDataQuery = useAdminOrgs(() => ({
    page: page(),
    limit: 20,
    search: debouncedSearch(),
  }));
  const orgsData = () => orgsDataQuery.data;

  // Handle search input - reset page when search changes
  const handleSearchInput = e => {
    setSearch(e.target.value);
    setPage(1);
  };

  const formatDate = timestamp => {
    if (!timestamp) return '-';
    const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp * 1000);
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
            <FiShield class='mb-4 h-12 w-12' />
            <p class='text-lg font-medium'>Access Denied</p>
            <p class='text-sm'>You do not have admin privileges.</p>
          </div>
        }
      >
        {/* Header */}
        <div class='mb-8 flex items-center space-x-3'>
          <div class='rounded-lg bg-blue-100 p-2'>
            <FiHome class='h-6 w-6 text-blue-600' />
          </div>
          <div>
            <h1 class='text-2xl font-bold text-gray-900'>Organizations</h1>
            <p class='text-sm text-gray-500'>Manage organizations and billing</p>
          </div>
        </div>

        {/* Orgs Section */}
        <div class='rounded-lg border border-gray-200 bg-white shadow-sm'>
          <div class='border-b border-gray-200 px-6 py-4'>
            <div class='flex items-center justify-between'>
              <h2 class='text-lg font-semibold text-gray-900'>Organizations</h2>
              <div class='relative'>
                <FiSearch class='absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400' />
                <input
                  type='text'
                  placeholder='Search by name or slug...'
                  value={search()}
                  onInput={handleSearchInput}
                  class='w-64 rounded-lg border border-gray-300 py-2 pr-4 pl-9 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none'
                />
              </div>
            </div>
          </div>

          {/* Orgs Table */}
          <Show
            when={!orgsDataQuery.isLoading}
            fallback={
              <div class='flex items-center justify-center py-12'>
                <FiLoader class='h-8 w-8 animate-spin text-blue-600' />
              </div>
            }
          >
            <div class='overflow-x-auto'>
              <table class='w-full'>
                <thead>
                  <tr class='border-b border-gray-200 bg-gray-50'>
                    <th class='px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase'>
                      Organization
                    </th>
                    <th class='px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase'>
                      Slug
                    </th>
                    <th class='px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase'>
                      Members
                    </th>
                    <th class='px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase'>
                      Projects
                    </th>
                    <th class='px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase'>
                      Created
                    </th>
                    <th class='px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase'>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody class='divide-y divide-gray-200'>
                  <For
                    each={orgsData()?.orgs || []}
                    fallback={
                      <tr>
                        <td colspan='6' class='px-6 py-12 text-center text-gray-500'>
                          No organizations found
                        </td>
                      </tr>
                    }
                  >
                    {org => (
                      <tr class='hover:bg-gray-50'>
                        <td class='px-6 py-4'>
                          <div class='flex items-center space-x-3'>
                            <div class='flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100'>
                              <FiHome class='h-5 w-5 text-blue-600' />
                            </div>
                            <div>
                              <p class='font-medium text-gray-900'>{org.name}</p>
                            </div>
                          </div>
                        </td>
                        <td class='px-6 py-4'>
                          <code class='rounded bg-gray-100 px-2 py-1 text-sm text-gray-700'>
                            {org.slug}
                          </code>
                        </td>
                        <td class='px-6 py-4 text-sm text-gray-500'>
                          <div class='flex items-center space-x-1'>
                            <FiUsers class='h-4 w-4 text-gray-400' />
                            <span>{org.stats?.memberCount ?? '-'}</span>
                          </div>
                        </td>
                        <td class='px-6 py-4 text-sm text-gray-500'>
                          <div class='flex items-center space-x-1'>
                            <FiFolder class='h-4 w-4 text-gray-400' />
                            <span>{org.stats?.projectCount ?? '-'}</span>
                          </div>
                        </td>
                        <td class='px-6 py-4 text-sm text-gray-500'>{formatDate(org.createdAt)}</td>
                        <td class='px-6 py-4 text-right'>
                          <A
                            href={`/admin/orgs/${org.id}`}
                            class='inline-flex items-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none'
                          >
                            Details
                          </A>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>

          {/* Pagination */}
          <Show when={orgsData()?.pagination}>
            <div class='flex items-center justify-between border-t border-gray-200 px-6 py-4'>
              <p class='text-sm text-gray-500'>
                Showing {(page() - 1) * (orgsData()?.pagination?.limit || 20) + 1} to{' '}
                {Math.min(
                  page() * (orgsData()?.pagination?.limit || 20),
                  orgsData()?.pagination?.total || 0,
                )}{' '}
                of {orgsData()?.pagination?.total || 0} organizations
              </p>
              <div class='flex items-center space-x-2'>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page() === 1}
                  class='rounded-lg border border-gray-300 p-2 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50'
                >
                  <FiChevronLeft class='h-4 w-4' />
                </button>
                <span class='text-sm text-gray-500'>
                  Page {page()} of {orgsData()?.pagination?.totalPages || 1}
                </span>
                <button
                  onClick={() =>
                    setPage(p => Math.min(orgsData()?.pagination?.totalPages || 1, p + 1))
                  }
                  disabled={page() >= (orgsData()?.pagination?.totalPages || 1)}
                  class='rounded-lg border border-gray-300 p-2 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50'
                >
                  <FiChevronRight class='h-4 w-4' />
                </button>
              </div>
            </div>
          </Show>
        </div>
      </Show>
    </Show>
  );
}
