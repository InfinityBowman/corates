import { createSignal, Show } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
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
import { DashboardHeader, AdminSection, AdminDataTable } from './ui/index.js';
import { input } from './styles/admin-tokens.js';

const formatDate = timestamp => {
  if (!timestamp) return '-';
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Org List component for admin dashboard
 * Lists all organizations with search and pagination
 * Allows admins to view organization details and navigate to organization management
 * @returns {JSX.Element} - The OrgList component
 */
export default function OrgList() {
  const navigate = useNavigate();
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

  const columns = [
    {
      accessorKey: 'name',
      header: 'Organization',
      cell: info => {
        const org = info.row.original;
        return (
          <div class='flex items-center space-x-3'>
            <div class='flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100'>
              <FiHome class='h-5 w-5 text-blue-600' />
            </div>
            <div>
              <p class='text-foreground font-medium'>{org.name}</p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'slug',
      header: 'Slug',
      cell: info => (
        <code class='bg-secondary text-secondary-foreground rounded px-2 py-1 text-sm'>
          {info.getValue()}
        </code>
      ),
    },
    {
      accessorKey: 'stats.memberCount',
      header: 'Members',
      cell: info => {
        const org = info.row.original;
        return (
          <div class='text-muted-foreground flex items-center space-x-1'>
            <FiUsers class='text-muted-foreground/70 h-4 w-4' />
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
          <div class='text-muted-foreground flex items-center space-x-1'>
            <FiFolder class='text-muted-foreground/70 h-4 w-4' />
            <span>{org.stats?.projectCount ?? '-'}</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: info => <span class='text-muted-foreground'>{formatDate(info.getValue())}</span>,
    },
    {
      id: 'actions',
      header: '',
      cell: info => {
        const org = info.row.original;
        return (
          <A
            href={`/admin/orgs/${org.id}`}
            class='inline-flex items-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-[3px] focus:ring-blue-100 focus:outline-none'
            onClick={e => e.stopPropagation()}
          >
            Details
          </A>
        );
      },
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
            <FiShield class='mb-4 h-12 w-12' />
            <p class='text-lg font-medium'>Access Denied</p>
            <p class='text-sm'>You do not have admin privileges.</p>
          </div>
        }
      >
        <DashboardHeader
          icon={FiHome}
          title='Organizations'
          description='Manage organizations and billing'
        />

        {/* Orgs Section */}
        <AdminSection
          title='Organizations'
          cta={
            <div class='relative'>
              <FiSearch class='text-muted-foreground/70 absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
              <input
                type='text'
                placeholder='Search by name or slug...'
                value={search()}
                onInput={handleSearchInput}
                class={`w-64 ${input.base} ${input.withIconLeft}`}
              />
            </div>
          }
        >
          <AdminDataTable
            columns={columns}
            data={orgsData()?.orgs || []}
            loading={orgsDataQuery.isLoading}
            emptyMessage='No organizations found'
            enableSorting
            onRowClick={row => navigate(`/admin/orgs/${row.id}`)}
          />

          {/* Server-side Pagination */}
          <Show when={orgsData()?.pagination}>
            <div class='mt-4 flex items-center justify-between'>
              <p class='text-muted-foreground text-sm'>
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
                  class='border-border bg-card text-muted-foreground hover:bg-muted rounded-xl border p-2 shadow-xs disabled:cursor-not-allowed disabled:opacity-50'
                >
                  <FiChevronLeft class='h-4 w-4' />
                </button>
                <span class='text-muted-foreground text-sm'>
                  Page {page()} of {orgsData()?.pagination?.totalPages || 1}
                </span>
                <button
                  onClick={() =>
                    setPage(p => Math.min(orgsData()?.pagination?.totalPages || 1, p + 1))
                  }
                  disabled={page() >= (orgsData()?.pagination?.totalPages || 1)}
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
  );
}
