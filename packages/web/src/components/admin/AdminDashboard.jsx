/**
 * Admin Dashboard - Main admin panel page
 * Displays system statistics, user management, and provides navigation to other admin features
 */

import { createSignal, Show } from 'solid-js';
import { useDebouncedSignal } from '@/primitives/useDebouncedSignal.js';
import {
  FiUsers,
  FiFolder,
  FiActivity,
  FiUserPlus,
  FiSearch,
  FiChevronLeft,
  FiChevronRight,
  FiShield,
  FiAlertCircle,
  FiLoader,
} from 'solid-icons/fi';
import { isAdmin, isAdminChecked } from '@/stores/adminStore.js';
import { useAdminStats, useAdminUsers } from '@primitives/useAdminQueries.js';
import UserTable from './UserTable.jsx';
import StatsCard from './StatsCard.jsx';
import AnalyticsSection from './AnalyticsSection.jsx';

/**
 * Admin Dashboard component
 * Main admin panel displaying statistics and user management
 * @returns {JSX.Element} - The AdminDashboard component
 */
export default function AdminDashboard() {
  const [search, setSearch, debouncedSearch] = useDebouncedSignal('', 300);
  const [page, setPage] = createSignal(1);

  // Fetch stats using TanStack Query
  const statsQuery = useAdminStats();
  const stats = () => statsQuery.data;

  // Fetch users with pagination and search using TanStack Query
  const usersDataQuery = useAdminUsers(() => ({
    page: page(),
    limit: 20,
    search: debouncedSearch(),
  }));
  const usersData = () => usersDataQuery.data;

  // Handle search input - reset page when search changes
  const handleSearchInput = e => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleRefresh = () => {
    usersDataQuery.refetch();
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
        {/* Header */}
        <div class='mb-8 flex items-center space-x-3'>
          <div class='rounded-lg bg-blue-100 p-2'>
            <FiShield class='h-6 w-6 text-blue-600' />
          </div>
          <div>
            <h1 class='text-2xl font-bold text-gray-900'>Admin Dashboard</h1>
            <p class='text-sm text-gray-500'>Manage users and monitor activity</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div class='mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4'>
          <StatsCard
            title='Total Users'
            value={stats()?.users ?? '-'}
            icon={FiUsers}
            color='blue'
            loading={statsQuery.isLoading}
          />
          <StatsCard
            title='Projects'
            value={stats()?.projects ?? '-'}
            icon={FiFolder}
            color='green'
            loading={statsQuery.isLoading}
          />
          <StatsCard
            title='Active Sessions'
            value={stats()?.activeSessions ?? '-'}
            icon={FiActivity}
            color='purple'
            loading={statsQuery.isLoading}
          />
          <StatsCard
            title='New This Week'
            value={stats()?.recentSignups ?? '-'}
            icon={FiUserPlus}
            color='orange'
            loading={statsQuery.isLoading}
          />
        </div>

        {/* Analytics Charts Section */}
        <div class='mb-8'>
          <AnalyticsSection />
        </div>

        {/* Users Section */}
        <div class='rounded-lg border border-gray-200 bg-white shadow-sm'>
          <div class='border-b border-gray-200 px-6 py-4'>
            <div class='flex items-center justify-between'>
              <h2 class='text-lg font-semibold text-gray-900'>Users</h2>
              <div class='relative'>
                <FiSearch class='absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400' />
                <input
                  type='text'
                  placeholder='Search by name or email...'
                  value={search()}
                  onInput={handleSearchInput}
                  class='w-64 rounded-lg border border-gray-300 py-2 pr-4 pl-9 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none'
                />
              </div>
            </div>
          </div>

          {/* Users Table */}
          <Show
            when={!usersDataQuery.isLoading}
            fallback={
              <div class='flex items-center justify-center py-12'>
                <FiLoader class='h-8 w-8 animate-spin text-blue-600' />
              </div>
            }
          >
            <UserTable users={usersData()?.users || []} onRefresh={handleRefresh} />
          </Show>

          {/* Pagination */}
          <Show when={usersData()?.pagination}>
            <div class='flex items-center justify-between border-t border-gray-200 px-6 py-4'>
              <p class='text-sm text-gray-500'>
                Showing {(page() - 1) * (usersData()?.pagination?.limit || 20) + 1} to{' '}
                {Math.min(
                  page() * (usersData()?.pagination?.limit || 20),
                  usersData()?.pagination?.total || 0,
                )}{' '}
                of {usersData()?.pagination?.total || 0} users
              </p>
              <div class='flex items-center space-x-2'>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page() === 1}
                  class='rounded-lg border border-gray-300 p-2 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50'
                >
                  <FiChevronLeft class='h-4 w-4' />
                </button>
                <span class='text-sm text-gray-600'>
                  Page {page()} of {usersData()?.pagination?.totalPages || 1}
                </span>
                <button
                  onClick={() =>
                    setPage(p => Math.min(usersData()?.pagination?.totalPages || 1, p + 1))
                  }
                  disabled={page() >= (usersData()?.pagination?.totalPages || 1)}
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
