import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  RefreshCwIcon,
  AlertTriangleIcon,
  UsersIcon,
  HomeIcon,
  DollarSignIcon,
} from 'lucide-react';
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
import { AdminBox } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
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
    queryKey: [...queryKeys.admin.stats, 'organizations', signupDays],
    queryFn: async () => {
      try {
        return await getAdminOrgStatsAction({ data: { days: signupDays } });
      } catch (err) {
        console.warn('Failed to fetch organizations stats:', (err as Error).message);
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

  return (
    <div className='flex flex-col gap-6'>
      {/* Growth Charts Row */}
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        {/* Signups Chart */}
        <AdminBox>
          <div className='mb-4 flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <UsersIcon className='text-info size-5' />
              <h3 className='text-foreground font-medium'>User Signups</h3>
            </div>
            <div className='flex items-center gap-2'>
              <Select value={String(signupDays)} onValueChange={v => setSignupDays(Number(v))}>
                <SelectTrigger>
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
              <Button
                type='button'
                variant='ghost'
                size='icon'
                onClick={() => signupQuery.refetch()}
              >
                <RefreshCwIcon className='size-4' />
              </Button>
            </div>
          </div>
          {signupQuery.isLoading ?
            <div className='flex h-64 items-center justify-center'>
              <Spinner size='md' variant='current' className='text-info' />
            </div>
          : signupData?.data ?
            <>
              <div className='text-foreground mb-2 text-2xl font-bold'>
                {signupData.total}{' '}
                <span className='text-muted-foreground text-sm font-normal'>total</span>
              </div>
              <LineChart
                labels={signupData.data.map(d => formatDate(d.date))}
                data={signupData.data.map(d => d.count)}
                label='Signups'
                color='var(--chart-cat-1)'
                fill
              />
            </>
          : <div className='text-muted-foreground/70 flex h-64 items-center justify-center'>
              <span>No data available</span>
            </div>
          }
        </AdminBox>

        {/* Organizations & Projects Chart */}
        <AdminBox>
          <div className='mb-4 flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <HomeIcon className='text-success size-5' />
              <h3 className='text-foreground font-medium'>Orgs & Projects</h3>
            </div>
          </div>
          {orgQuery.isLoading || projectQuery.isLoading ?
            <div className='flex h-64 items-center justify-center'>
              <Spinner size='md' variant='current' className='text-success' />
            </div>
          : orgData && projectData ?
            <>
              <div className='mb-2 flex gap-4'>
                <div>
                  <span className='text-chart-cat-1 text-2xl font-bold'>{orgData.total ?? 0}</span>
                  <span className='text-muted-foreground ml-1 text-sm'>orgs</span>
                </div>
                <div>
                  <span className='text-chart-cat-2 text-2xl font-bold'>
                    {projectData.total ?? 0}
                  </span>
                  <span className='text-muted-foreground ml-1 text-sm'>projects</span>
                </div>
              </div>
              <LineChart
                labels={orgData.data.map(d => formatDate(d.date))}
                datasets={[
                  {
                    label: 'Organizations',
                    data: orgData.data.map(d => d.count),
                    color: 'var(--chart-cat-1)',
                  },
                  {
                    label: 'Projects',
                    data: projectData.data.map(d => d.count),
                    color: 'var(--chart-cat-2)',
                  },
                ]}
                showLegend
              />
            </>
          : <div className='text-muted-foreground/70 flex h-64 items-center justify-center'>
              <span>No data available</span>
            </div>
          }
        </AdminBox>
      </div>

      {/* Billing Row */}
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
        {/* Subscriptions Breakdown */}
        <AdminBox>
          <div className='mb-4 flex items-center justify-between'>
            <h3 className='text-foreground font-medium'>Subscriptions</h3>
            <Button
              type='button'
              variant='ghost'
              size='icon'
              onClick={() => subscriptionQuery.refetch()}
            >
              <RefreshCwIcon className='size-4' />
            </Button>
          </div>
          {subscriptionQuery.isLoading ?
            <div className='flex h-48 items-center justify-center'>
              <Spinner size='md' variant='current' className='text-info' />
            </div>
          : subscriptionData ?
            <>
              <DoughnutChart
                className='h-48'
                labels={['Active', 'Trialing', 'Past Due', 'Canceled']}
                data={[
                  subscriptionData.active ?? 0,
                  subscriptionData.trialing ?? 0,
                  subscriptionData.pastDue ?? 0,
                  subscriptionData.canceled ?? 0,
                ]}
                colors={[
                  'var(--chart-cat-1)',
                  'var(--chart-cat-2)',
                  'var(--chart-cat-3)',
                  'var(--muted-foreground)',
                ]}
                legendPosition='bottom'
              />
            </>
          : <div className='text-muted-foreground/70 flex h-48 items-center justify-center'>
              <span>No data</span>
            </div>
          }
        </AdminBox>

        {/* Revenue Chart */}
        <AdminBox className='lg:col-span-2'>
          <div className='mb-4 flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <DollarSignIcon className='text-success size-5' />
              <h3 className='text-foreground font-medium'>Revenue (6 months)</h3>
            </div>
            <Button
              type='button'
              variant='ghost'
              size='icon'
              onClick={() => revenueQuery.refetch()}
            >
              <RefreshCwIcon className='size-4' />
            </Button>
          </div>
          {revenueQuery.isLoading ?
            <div className='flex h-48 items-center justify-center'>
              <Spinner size='md' variant='current' className='text-success' />
            </div>
          : revenueData?.data && revenueData.data.length > 0 ?
            <>
              <div className='text-foreground mb-2 text-2xl font-bold'>
                {formatCurrency(revenueData.total)}{' '}
                <span className='text-muted-foreground text-sm font-normal'>total</span>
              </div>
              <BarChart
                className='h-48'
                labels={revenueData.data.map(d => d.label)}
                data={revenueData.data.map(d => d.revenue / 100)}
                label='Revenue ($)'
                colors={revenueData.data.map(() => 'var(--chart-cat-2)')}
              />
            </>
          : <div className='text-muted-foreground/70 flex h-48 items-center justify-center'>
              <span>No revenue data</span>
            </div>
          }
        </AdminBox>
      </div>

      {/* Webhook Health Row */}
      <AdminBox>
        <div className='mb-4 flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <AlertTriangleIcon className='text-warning size-5' />
            <h3 className='text-foreground font-medium'>Webhook Health</h3>
          </div>
          <div className='flex items-center gap-2'>
            <Select value={String(webhookDays)} onValueChange={v => setWebhookDays(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='7'>7 days</SelectItem>
                <SelectItem value='14'>14 days</SelectItem>
                <SelectItem value='30'>30 days</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type='button'
              variant='ghost'
              size='icon'
              onClick={() => webhookQuery.refetch()}
            >
              <RefreshCwIcon className='size-4' />
            </Button>
          </div>
        </div>
        {webhookQuery.isLoading ?
          <div className='flex h-48 items-center justify-center'>
            <Spinner size='md' variant='current' className='text-warning' />
          </div>
        : webhookData?.data ?
          <>
            <div className='mb-4 flex gap-6'>
              <div>
                <span className='text-success text-2xl font-bold'>
                  {webhookData.totals?.success ?? 0}
                </span>
                <span className='text-muted-foreground ml-1 text-sm'>success</span>
              </div>
              <div>
                <span className='text-destructive text-2xl font-bold'>
                  {webhookData.totals?.failed ?? 0}
                </span>
                <span className='text-muted-foreground ml-1 text-sm'>failed</span>
              </div>
              <div>
                <span className='text-warning text-2xl font-bold'>
                  {webhookData.totals?.pending ?? 0}
                </span>
                <span className='text-muted-foreground ml-1 text-sm'>pending</span>
              </div>
            </div>
            <LineChart
              className='h-48'
              labels={webhookData.data.map(d => formatDate(d.date))}
              datasets={[
                {
                  label: 'Success',
                  data: webhookData.data.map(d => d.success),
                  color: 'var(--success)',
                },
                {
                  label: 'Failed',
                  data: webhookData.data.map(d => d.failed),
                  color: 'var(--destructive)',
                },
                {
                  label: 'Pending',
                  data: webhookData.data.map(d => d.pending),
                  color: 'var(--warning)',
                },
              ]}
              showLegend
            />
          </>
        : <div className='text-muted-foreground/70 flex h-48 items-center justify-center'>
            <span>No webhook data</span>
          </div>
        }
      </AdminBox>
    </div>
  );
}
