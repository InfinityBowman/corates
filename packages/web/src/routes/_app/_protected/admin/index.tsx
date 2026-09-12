import { createFileRoute } from '@tanstack/react-router';
import { useAdminStats } from '@/hooks/useAdminQueries';
import { AnalyticsSection } from '@/components/admin/AnalyticsSection';
import { AdminPage, AdminStat, AdminStatRow } from '@/components/admin/ui';

export const Route = createFileRoute('/_app/_protected/admin/')({
  component: AdminDashboard,
});

function AdminDashboard() {
  const statsQuery = useAdminStats();
  const stats = statsQuery.data;

  return (
    <AdminPage title='Admin Dashboard' description='Platform activity at a glance'>
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
    </AdminPage>
  );
}
