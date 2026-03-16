/**
 * Admin Dashboard route - Main admin panel page
 * Displays system statistics and user management
 */

import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  UsersIcon,
  FolderIcon,
  ActivityIcon,
  UserPlusIcon,
  SearchIcon,
  ShieldIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LoaderIcon,
} from 'lucide-react';
import { useAdminStats, useAdminUsers } from '@/hooks/useAdminQueries';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { StatsCard } from '@/components/admin/StatsCard';
import { UserTable } from '@/components/admin/UserTable';
import { AdminSection, AdminBox, DashboardHeader } from '@/components/admin/ui';
import { input } from '@/components/admin/styles/admin-tokens';

export const Route = (createFileRoute as unknown as Function)('/_app/_protected/admin/')({
  component: AdminDashboard,
});

function AdminDashboard() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, 300);

  const statsQuery = useAdminStats();
  const stats = statsQuery.data as Record<string, number> | undefined;

  const usersDataQuery = useAdminUsers({
    page,
    limit: 20,
    search: debouncedSearch,
  });
  const usersData = usersDataQuery.data as
    | {
        users: Array<Record<string, unknown>>;
        pagination: { limit: number; total: number; totalPages: number };
      }
    | undefined;

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  return (
    <>
      <DashboardHeader
        icon={ShieldIcon}
        title='Admin Dashboard'
        description='Manage users and monitor activity'
      />

      {/* Stats Grid */}
      <AdminSection title='Overview' className='mb-8'>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4'>
          <StatsCard
            title='Total Users'
            value={stats?.users ?? '-'}
            icon={UsersIcon}
            color='blue'
            loading={statsQuery.isLoading}
          />
          <StatsCard
            title='Organizations'
            value={stats?.orgs ?? '-'}
            icon={FolderIcon}
            color='green'
            loading={statsQuery.isLoading}
          />
          <StatsCard
            title='Projects'
            value={stats?.projects ?? '-'}
            icon={ActivityIcon}
            color='purple'
            loading={statsQuery.isLoading}
          />
          <StatsCard
            title='Checklists'
            value={stats?.checklists ?? '-'}
            icon={UserPlusIcon}
            color='orange'
            loading={statsQuery.isLoading}
          />
        </div>
      </AdminSection>

      {/* Users Section */}
      <AdminSection
        title='Users'
        description='Manage system users and their access'
        cta={
          <div className='relative'>
            <SearchIcon className='text-muted-foreground/70 absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
            <input
              type='text'
              placeholder='Search by name or email...'
              value={search}
              onChange={handleSearchInput}
              className={`w-64 ${input.base} ${input.withIconLeft}`}
            />
          </div>
        }
      >
        <AdminBox padding='compact' className='overflow-hidden p-0'>
          {usersDataQuery.isLoading ?
            <div className='flex items-center justify-center py-12'>
              <LoaderIcon className='h-8 w-8 animate-spin text-blue-600' />
            </div>
          : <UserTable users={(usersData?.users as Array<Record<string, unknown>>) || []} />}

          {/* Pagination */}
          {usersData?.pagination && (
            <div className='border-border flex items-center justify-between border-t px-6 py-4'>
              <p className='text-muted-foreground text-sm'>
                Showing {(page - 1) * (usersData.pagination.limit || 20) + 1} to{' '}
                {Math.min(
                  page * (usersData.pagination.limit || 20),
                  usersData.pagination.total || 0,
                )}{' '}
                of {usersData.pagination.total || 0} users
              </p>
              <div className='flex items-center space-x-2'>
                <button
                  type='button'
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className='border-border hover:bg-muted rounded-lg border p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50'
                >
                  <ChevronLeftIcon className='h-4 w-4' />
                </button>
                <span className='text-muted-foreground text-sm'>
                  Page {page} of {usersData.pagination.totalPages || 1}
                </span>
                <button
                  type='button'
                  onClick={() =>
                    setPage(p => Math.min(usersData.pagination.totalPages || 1, p + 1))
                  }
                  disabled={page >= (usersData.pagination.totalPages || 1)}
                  className='border-border hover:bg-muted rounded-lg border p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50'
                >
                  <ChevronRightIcon className='h-4 w-4' />
                </button>
              </div>
            </div>
          )}
        </AdminBox>
      </AdminSection>
    </>
  );
}
