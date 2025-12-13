/**
 * Admin Dashboard - Main admin panel page
 */

import { createSignal, createResource, Show, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
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
} from 'solid-icons/fi';
import {
  isAdmin,
  isAdminChecked,
  checkAdminStatus,
  fetchStats,
  fetchUsers,
} from '@/stores/adminStore.js';
import UserTable from './UserTable.jsx';
import StatsCard from './StatsCard.jsx';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [search, setSearch] = createSignal('');
  const [page, setPage] = createSignal(1);
  const [debouncedSearch, setDebouncedSearch] = createSignal('');

  // Check admin status on mount
  onMount(async () => {
    await checkAdminStatus();
    if (!isAdmin()) {
      navigate('/dashboard');
    }
  });

  // Fetch stats
  const [stats] = createResource(fetchStats);

  // Fetch users with pagination and search
  const [usersData, { refetch: refetchUsers }] = createResource(
    () => ({ page: page(), search: debouncedSearch() }),
    fetchUsers,
  );

  // Debounce search
  let searchTimeout;
  const handleSearchInput = e => {
    setSearch(e.target.value);
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      setDebouncedSearch(e.target.value);
      setPage(1);
    }, 300);
  };

  const handleRefresh = () => {
    refetchUsers();
  };

  return (
    <Show
      when={isAdminChecked()}
      fallback={
        <div class='flex items-center justify-center min-h-100'>
          <div class='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600' />
        </div>
      }
    >
      <Show
        when={isAdmin()}
        fallback={
          <div class='flex flex-col items-center justify-center min-h-100 text-gray-500'>
            <FiAlertCircle class='w-12 h-12 mb-4' />
            <p class='text-lg font-medium'>Access Denied</p>
            <p class='text-sm'>You do not have admin privileges.</p>
          </div>
        }
      >
        <div class='max-w-7xl mx-auto p-6'>
          {/* Header */}
          <div class='flex items-center justify-between mb-8'>
            <div class='flex items-center space-x-3'>
              <div class='p-2 bg-blue-100 rounded-lg'>
                <FiShield class='w-6 h-6 text-blue-600' />
              </div>
              <div>
                <h1 class='text-2xl font-bold text-gray-900'>Admin Dashboard</h1>
                <p class='text-sm text-gray-500'>Manage users and monitor activity</p>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div class='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8'>
            <StatsCard
              title='Total Users'
              value={stats()?.users ?? '-'}
              icon={FiUsers}
              color='blue'
              loading={stats.loading}
            />
            <StatsCard
              title='Projects'
              value={stats()?.projects ?? '-'}
              icon={FiFolder}
              color='green'
              loading={stats.loading}
            />
            <StatsCard
              title='Active Sessions'
              value={stats()?.activeSessions ?? '-'}
              icon={FiActivity}
              color='purple'
              loading={stats.loading}
            />
            <StatsCard
              title='New This Week'
              value={stats()?.recentSignups ?? '-'}
              icon={FiUserPlus}
              color='orange'
              loading={stats.loading}
            />
          </div>

          {/* Users Section */}
          <div class='bg-white rounded-lg shadow-sm border border-gray-200'>
            <div class='px-6 py-4 border-b border-gray-200'>
              <div class='flex items-center justify-between'>
                <h2 class='text-lg font-semibold text-gray-900'>Users</h2>
                <div class='relative'>
                  <FiSearch class='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
                  <input
                    type='text'
                    placeholder='Search by name or email...'
                    value={search()}
                    onInput={handleSearchInput}
                    class='pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64'
                  />
                </div>
              </div>
            </div>

            {/* Users Table */}
            <Show
              when={!usersData.loading}
              fallback={
                <div class='flex items-center justify-center py-12'>
                  <div class='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600' />
                </div>
              }
            >
              <UserTable users={usersData()?.users || []} onRefresh={handleRefresh} />
            </Show>

            {/* Pagination */}
            <Show when={usersData()?.pagination}>
              <div class='px-6 py-4 border-t border-gray-200 flex items-center justify-between'>
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
                    class='p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
                  >
                    <FiChevronLeft class='w-4 h-4' />
                  </button>
                  <span class='text-sm text-gray-600'>
                    Page {page()} of {usersData()?.pagination?.totalPages || 1}
                  </span>
                  <button
                    onClick={() =>
                      setPage(p => Math.min(usersData()?.pagination?.totalPages || 1, p + 1))
                    }
                    disabled={page() >= (usersData()?.pagination?.totalPages || 1)}
                    class='p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
                  >
                    <FiChevronRight class='w-4 h-4' />
                  </button>
                </div>
              </div>
            </Show>
          </div>
        </div>
      </Show>
    </Show>
  );
}
