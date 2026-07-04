import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  UsersIcon,
  FolderIcon,
  ActivityIcon,
  UserPlusIcon,
  SearchIcon,
  ShieldIcon,
  LoaderIcon,
} from 'lucide-react';
import { useAdminStats, useAdminUsers } from '@/hooks/useAdminQueries';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { StatsCard } from '@/components/admin/StatsCard';
import { UserTable } from '@/components/admin/UserTable';
import { AnalyticsSection } from '@/components/admin/AnalyticsSection';
import { AdminSection, DashboardHeader, ServerPagination } from '@/components/admin/ui';
import { Input } from '@/components/ui/input';

export const Route = createFileRoute('/_app/_protected/admin/')({
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
        users: Array<{ id: string; [key: string]: unknown }>;
        pagination: { limit: number; total: number; totalPages: number };
      }
    | undefined;

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  return (
    <div className='flex flex-col gap-8'>
      <DashboardHeader
        icon={ShieldIcon}
        title='Admin Dashboard'
        description='Manage users and monitor activity'
      />

      {/* Stats Grid */}
      <AdminSection title='Overview'>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4'>
          <StatsCard
            title='Total Users'
            value={stats?.users ?? '-'}
            icon={UsersIcon}
            color='blue'
            loading={statsQuery.isLoading}
          />
          <StatsCard
            title='Projects'
            value={stats?.projects ?? '-'}
            icon={FolderIcon}
            color='green'
            loading={statsQuery.isLoading}
          />
          <StatsCard
            title='Active Sessions'
            value={stats?.activeSessions ?? '-'}
            icon={ActivityIcon}
            color='purple'
            loading={statsQuery.isLoading}
          />
          <StatsCard
            title='New This Week'
            value={stats?.recentSignups ?? '-'}
            icon={UserPlusIcon}
            color='orange'
            loading={statsQuery.isLoading}
          />
        </div>
      </AdminSection>

      {/* Analytics Charts */}
      <AdminSection title='Analytics' description='Track signups, projects, and revenue over time'>
        <AnalyticsSection />
      </AdminSection>

      {/* Users Section */}
      <AdminSection
        title='Users'
        description='Manage system users and their access'
        cta={
          <div className='relative'>
            <SearchIcon className='text-muted-foreground/70 absolute top-1/2 left-3 size-4 -translate-y-1/2' />
            <Input
              type='text'
              placeholder='Search by name or email...'
              value={search}
              onChange={handleSearchInput}
              className='w-64 pl-10'
            />
          </div>
        }
      >
        {usersDataQuery.isLoading ?
          <div className='flex items-center justify-center py-12'>
            <LoaderIcon className='text-primary size-8 animate-spin' />
          </div>
        : <UserTable users={usersData?.users || []} />}

        {usersData?.pagination && (
          <ServerPagination
            page={page}
            totalPages={usersData.pagination.totalPages || 1}
            total={usersData.pagination.total || 0}
            limit={usersData.pagination.limit || 20}
            onPageChange={setPage}
            label='users'
          />
        )}
      </AdminSection>
    </div>
  );
}
