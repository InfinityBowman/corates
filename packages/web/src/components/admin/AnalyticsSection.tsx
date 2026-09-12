import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCwIcon } from 'lucide-react';
import { queryKeys } from '@/lib/queryKeys';
import {
  getAdminSignupStatsAction,
  getAdminOrgStatsAction,
  getAdminProjectStatsAction,
  getAdminWebhookStatsAction,
  getAdminSubscriptionStatsAction,
  getAdminRevenueStatsAction,
} from '@/server/functions/admin-stats.functions';
import { LineChart, BarChart, DoughnutChart } from '@/components/admin/charts';
import { AdminPanel } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const PERIOD_OPTIONS = [
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
];

const QUERY_CONFIG = {
  staleTime: 0,
  gcTime: 1000 * 60 * 5,
  refetchOnMount: 'always' as const,
};

// Every chart body is pinned to this height so a refetch never resizes the grid.
const CHART_HEIGHT = 'h-56';

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatCurrency = (cents: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(cents / 100);
};

function RefreshButton({ onClick, busy }: { onClick: () => void; busy?: boolean }) {
  return (
    <Button
      type='button'
      variant='ghost'
      size='icon-sm'
      onClick={onClick}
      className='text-muted-foreground/70 hover:text-foreground'
      aria-label='Refresh'
    >
      <RefreshCwIcon className={`size-3.5 ${busy ? 'animate-spin' : ''}`} />
    </Button>
  );
}

function PeriodSelect({ value, onChange }: { value: number; onChange: (days: number) => void }) {
  return (
    <Select value={String(value)} onValueChange={v => onChange(Number(v))}>
      <SelectTrigger className='text-[13px]'>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PERIOD_OPTIONS.map(opt => (
          <SelectItem key={opt.value} value={String(opt.value)}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Headline figures above a chart. Keeps its height while the query resolves. */
function ChartSummary({ loading, children }: { loading: boolean; children: ReactNode }) {
  return (
    <div className='mb-3 flex h-8 items-baseline gap-5'>
      {loading ?
        <Skeleton className='h-7 w-28' />
      : children}
    </div>
  );
}

function Figure({ value, unit, tone }: { value: ReactNode; unit: string; tone?: string }) {
  return (
    <div className='flex items-baseline gap-1.5'>
      <span
        className={`text-2xl leading-7 font-semibold tabular-nums ${tone ?? 'text-foreground'}`}
      >
        {value}
      </span>
      <span className='text-muted-foreground text-[13px]'>{unit}</span>
    </div>
  );
}

function ChartBody({
  loading,
  hasData,
  emptyLabel,
  children,
}: {
  loading: boolean;
  hasData: boolean;
  emptyLabel: string;
  children: ReactNode;
}) {
  if (loading) return <Skeleton className={`${CHART_HEIGHT} w-full`} />;
  if (!hasData) {
    return (
      <div
        className={`text-muted-foreground/70 flex ${CHART_HEIGHT} items-center justify-center text-[13px]`}
      >
        {emptyLabel}
      </div>
    );
  }
  return <>{children}</>;
}

export function AnalyticsSection() {
  const [signupDays, setSignupDays] = useState(30);
  const [webhookDays, setWebhookDays] = useState(7);

  const signupQuery = useQuery({
    queryKey: [...queryKeys.admin.stats, 'signups', signupDays],
    queryFn: async () => {
      try {
        return await getAdminSignupStatsAction({ data: { days: signupDays } });
      } catch (err) {
        console.warn('Failed to fetch signups stats:', (err as Error).message);
        return null;
      }
    },
    ...QUERY_CONFIG,
  });

  const orgQuery = useQuery({
    queryKey: [...queryKeys.admin.stats, 'orgs', signupDays],
    queryFn: async () => {
      try {
        return await getAdminOrgStatsAction({ data: { days: signupDays } });
      } catch (err) {
        console.warn('Failed to fetch orgs stats:', (err as Error).message);
        return null;
      }
    },
    ...QUERY_CONFIG,
  });

  const projectQuery = useQuery({
    queryKey: [...queryKeys.admin.stats, 'projects', signupDays],
    queryFn: async () => {
      try {
        return await getAdminProjectStatsAction({ data: { days: signupDays } });
      } catch (err) {
        console.warn('Failed to fetch projects stats:', (err as Error).message);
        return null;
      }
    },
    ...QUERY_CONFIG,
  });

  const webhookQuery = useQuery({
    queryKey: [...queryKeys.admin.stats, 'webhooks', webhookDays],
    queryFn: async () => {
      try {
        return await getAdminWebhookStatsAction({ data: { days: webhookDays } });
      } catch (err) {
        console.warn('Failed to fetch webhooks stats:', (err as Error).message);
        return null;
      }
    },
    ...QUERY_CONFIG,
  });

  const subscriptionQuery = useQuery({
    queryKey: [...queryKeys.admin.stats, 'subscriptions'],
    queryFn: async () => {
      try {
        return await getAdminSubscriptionStatsAction();
      } catch (err) {
        console.warn('Failed to fetch subscriptions stats:', (err as Error).message);
        return null;
      }
    },
    ...QUERY_CONFIG,
  });

  const revenueQuery = useQuery({
    queryKey: [...queryKeys.admin.stats, 'revenue'],
    queryFn: async () => {
      try {
        return await getAdminRevenueStatsAction({ data: { months: 6 } });
      } catch (err) {
        console.warn('Failed to fetch revenue stats:', (err as Error).message);
        return null;
      }
    },
    ...QUERY_CONFIG,
  });

  const signupData = signupQuery.data;
  const orgData = orgQuery.data;
  const projectData = projectQuery.data;
  const webhookData = webhookQuery.data;
  const subscriptionData = subscriptionQuery.data;
  const revenueData = revenueQuery.data;

  const growthLoading = orgQuery.isLoading || projectQuery.isLoading;

  return (
    <div className='flex flex-col gap-6'>
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        <AdminPanel
          title='User signups'
          padded
          action={
            <>
              <PeriodSelect value={signupDays} onChange={setSignupDays} />
              <RefreshButton onClick={() => signupQuery.refetch()} busy={signupQuery.isFetching} />
            </>
          }
        >
          <ChartSummary loading={signupQuery.isLoading}>
            <Figure value={signupData?.total ?? 0} unit='total' />
          </ChartSummary>
          <ChartBody
            loading={signupQuery.isLoading}
            hasData={!!signupData?.data}
            emptyLabel='No signup data'
          >
            <LineChart
              className={CHART_HEIGHT}
              labels={(signupData?.data ?? []).map(d => formatDate(d.date))}
              data={(signupData?.data ?? []).map(d => d.count)}
              label='Signups'
              color='var(--chart-cat-1)'
              fill
            />
          </ChartBody>
        </AdminPanel>

        <AdminPanel
          title='Orgs and projects'
          padded
          action={
            <RefreshButton
              onClick={() => {
                orgQuery.refetch();
                projectQuery.refetch();
              }}
              busy={orgQuery.isFetching || projectQuery.isFetching}
            />
          }
        >
          <ChartSummary loading={growthLoading}>
            <Figure value={orgData?.total ?? 0} unit='orgs' />
            <Figure value={projectData?.total ?? 0} unit='projects' />
          </ChartSummary>
          <ChartBody
            loading={growthLoading}
            hasData={!!orgData && !!projectData}
            emptyLabel='No growth data'
          >
            <LineChart
              className={CHART_HEIGHT}
              labels={(orgData?.data ?? []).map(d => formatDate(d.date))}
              datasets={[
                {
                  label: 'Organizations',
                  data: (orgData?.data ?? []).map(d => d.count),
                  color: 'var(--chart-cat-1)',
                },
                {
                  label: 'Projects',
                  data: (projectData?.data ?? []).map(d => d.count),
                  color: 'var(--chart-cat-2)',
                },
              ]}
              showLegend
            />
          </ChartBody>
        </AdminPanel>
      </div>

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
        <AdminPanel
          title='Subscriptions'
          description={
            subscriptionData?.truncated ?
              `At least ${subscriptionData.statusScanLimit} in one status - counts are floors`
            : undefined
          }
          padded
          action={
            <RefreshButton
              onClick={() => subscriptionQuery.refetch()}
              busy={subscriptionQuery.isFetching}
            />
          }
        >
          <ChartBody
            loading={subscriptionQuery.isLoading}
            hasData={!!subscriptionData}
            emptyLabel='No subscription data'
          >
            <DoughnutChart
              className={CHART_HEIGHT}
              labels={['Active', 'Trialing', 'Past due', 'Canceled']}
              data={[
                subscriptionData?.active ?? 0,
                subscriptionData?.trialing ?? 0,
                subscriptionData?.pastDue ?? 0,
                subscriptionData?.canceled ?? 0,
              ]}
              colors={[
                'var(--chart-cat-1)',
                'var(--chart-cat-2)',
                'var(--chart-cat-3)',
                'var(--muted-foreground)',
              ]}
              legendPosition='bottom'
            />
          </ChartBody>
        </AdminPanel>

        <AdminPanel
          title='Revenue'
          description='Last 6 months'
          padded
          className='lg:col-span-2'
          action={
            <RefreshButton onClick={() => revenueQuery.refetch()} busy={revenueQuery.isFetching} />
          }
        >
          <ChartSummary loading={revenueQuery.isLoading}>
            <Figure value={formatCurrency(revenueData?.total ?? 0)} unit='total' />
          </ChartSummary>
          <ChartBody
            loading={revenueQuery.isLoading}
            hasData={(revenueData?.data?.length ?? 0) > 0}
            emptyLabel='No revenue data'
          >
            <BarChart
              className={CHART_HEIGHT}
              labels={(revenueData?.data ?? []).map(d => d.label)}
              data={(revenueData?.data ?? []).map(d => d.revenue / 100)}
              label='Revenue ($)'
              colors={(revenueData?.data ?? []).map(() => 'var(--chart-cat-2)')}
            />
          </ChartBody>
        </AdminPanel>
      </div>

      <AdminPanel
        title='Webhook health'
        padded
        action={
          <>
            <PeriodSelect value={webhookDays} onChange={setWebhookDays} />
            <RefreshButton onClick={() => webhookQuery.refetch()} busy={webhookQuery.isFetching} />
          </>
        }
      >
        <ChartSummary loading={webhookQuery.isLoading}>
          <Figure value={webhookData?.totals?.success ?? 0} unit='success' tone='text-success' />
          <Figure value={webhookData?.totals?.failed ?? 0} unit='failed' tone='text-destructive' />
          <Figure value={webhookData?.totals?.pending ?? 0} unit='pending' tone='text-warning' />
        </ChartSummary>
        <ChartBody
          loading={webhookQuery.isLoading}
          hasData={!!webhookData?.data}
          emptyLabel='No webhook data'
        >
          <LineChart
            className={CHART_HEIGHT}
            labels={(webhookData?.data ?? []).map(d => formatDate(d.date))}
            datasets={[
              {
                label: 'Success',
                data: (webhookData?.data ?? []).map(d => d.success),
                color: 'var(--success)',
              },
              {
                label: 'Failed',
                data: (webhookData?.data ?? []).map(d => d.failed),
                color: 'var(--destructive)',
              },
              {
                label: 'Pending',
                data: (webhookData?.data ?? []).map(d => d.pending),
                color: 'var(--warning)',
              },
            ]}
            showLegend
          />
        </ChartBody>
      </AdminPanel>
    </div>
  );
}
