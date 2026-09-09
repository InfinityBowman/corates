import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { UsersIcon } from 'lucide-react';
import { useAdminStats, useAdminUsers } from '@/hooks/useAdminQueries';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { UserTable } from '@/components/admin/UserTable';
import { AnalyticsSection } from '@/components/admin/AnalyticsSection';
import {
  AdminEmpty,
  AdminPage,
  AdminPanel,
  AdminSearch,
  AdminStat,
  AdminStatRow,
  ServerPagination,
} from '@/components/admin/ui';

const PAGE_SIZE = 10;

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
    limit: PAGE_SIZE,
    search: debouncedSearch,
  });
  const usersData = usersDataQuery.data as
    | {
        users: Array<{ id: string; [key: string]: unknown }>;
        pagination: { limit: number; total: number; totalPages: number };
      }
    | undefined;

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const pagination = usersData?.pagination;

  return (
    <AdminPage title='Admin Dashboard' description='Manage users and monitor activity'>
      <AdminStatRow>
        <AdminStat label='Total Users' value={stats?.users ?? 0} loading={statsQuery.isLoading} />
        <AdminStat label='Projects' value={stats?.projects ?? 0} loading={statsQuery.isLoading} />
        <AdminStat
          label='Active Sessions'
          value={stats?.activeSessions ?? 0}
          loading={statsQuery.isLoading}
        />
        <AdminStat
          label='New This Week'
          value={stats?.recentSignups ?? 0}
          loading={statsQuery.isLoading}
        />
      </AdminStatRow>

      <AnalyticsSection />

      <AdminPanel
        title='Users'
        action={
          <AdminSearch
            value={search}
            onChange={handleSearchChange}
            placeholder='Search by name or email...'
            className='w-full sm:w-72'
          />
        }
        footer={
          <ServerPagination
            page={page}
            totalPages={pagination?.totalPages ?? 1}
            total={pagination?.total ?? 0}
            limit={pagination?.limit ?? PAGE_SIZE}
            onPageChange={setPage}
            label='users'
          />
        }
      >
        <UserTable
          users={usersData?.users || []}
          loading={usersDataQuery.isLoading}
          refreshing={usersDataQuery.isFetching}
          fillRows
          skeletonRows={PAGE_SIZE}
          emptyState={
            <AdminEmpty
              icon={UsersIcon}
              title='No users found'
              description={search ? 'Try a different name or email.' : undefined}
            />
          }
        />
      </AdminPanel>
    </AdminPage>
  );
}
