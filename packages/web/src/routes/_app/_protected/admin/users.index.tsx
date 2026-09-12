import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { UsersIcon } from 'lucide-react';
import { useAdminUsers } from '@/hooks/useAdminQueries';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { UserTable } from '@/components/admin/UserTable';
import { AdminEmpty, AdminListPage, AdminSearch, ServerPagination } from '@/components/admin/ui';

const PAGE_SIZE = 25;

export const Route = createFileRoute('/_app/_protected/admin/users/')({
  component: AdminUserList,
});

function AdminUserList() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, 300);

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
    <AdminListPage
      title='Users'
      count={pagination?.total}
      filters={
        <AdminSearch
          value={search}
          onChange={handleSearchChange}
          placeholder='Search by name or email...'
          className='w-full max-w-72'
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
        skeletonRows={PAGE_SIZE}
        variant='page'
        emptyState={
          <AdminEmpty
            icon={UsersIcon}
            title='No users found'
            description={search ? 'Try a different name or email.' : undefined}
          />
        }
      />
    </AdminListPage>
  );
}
