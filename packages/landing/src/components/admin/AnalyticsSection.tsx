/**
 * Analytics Section for Admin Dashboard
 * Displays charts for signups, webhooks, subscriptions, and revenue
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUpIcon,
  LoaderIcon,
  RefreshCwIcon,
  AlertTriangleIcon,
  UsersIcon,
  HomeIcon,
  DollarSignIcon,
} from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';
import { queryKeys } from '@/lib/queryKeys';
import { LineChart, BarChart, DoughnutChart } from '@/components/admin/charts';
import { AdminBox } from '@/components/admin/ui';
import { input } from '@/components/admin/styles/admin-tokens';

const PERIOD_OPTIONS = [
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
];

interface SignupDataPoint {
  date: string;
  count: number;
}

interface SignupData {
  data: SignupDataPoint[];
  total: number;
}

interface OrgDataPoint {
  date: string;
  count: number;
}

interface OrgData {
  data: OrgDataPoint[];
  total: number;
}

interface ProjectDataPoint {
  date: string;
  count: number;
}

interface ProjectData {
  data: ProjectDataPoint[];
  total: number;
}

interface WebhookDataPoint {
  date: string;
  success: number;
  failed: number;
  pending: number;
}

interface WebhookData {
  data: WebhookDataPoint[];
  totals?: { success?: number; failed?: number; pending?: number };
}

interface SubscriptionStatsData {
  active?: number;
  trialing?: number;
  pastDue?: number;
  canceled?: number;
  error?: string;
}

interface RevenueDataPoint {
  label: string;
  revenue: number;
}

interface RevenueData {
  data: RevenueDataPoint[];
  total: number;
  error?: string;
}

const QUERY_CONFIG = {
  staleTime: 0,
  gcTime: 1000 * 60 * 5,
  refetchOnMount: 'always' as const,
};

async function fetchStats(path: string): Promise<unknown> {
  try {
    return await apiFetch(`/api/admin/stats/${path}`, { showToast: false });
  } catch (err) {
    console.warn(`Failed to fetch ${path} stats:`, (err as Error).message);
    return null;
  }
}

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
    queryFn: () => fetchStats(`signups?days=${signupDays}`) as Promise<SignupData | null>,
    ...QUERY_CONFIG,
  });

  const orgQuery = useQuery({
    queryKey: [...queryKeys.admin.stats, 'organizations', signupDays],
    queryFn: () => fetchStats(`organizations?days=${signupDays}`) as Promise<OrgData | null>,
    ...QUERY_CONFIG,
  });

  const projectQuery = useQuery({
    queryKey: [...queryKeys.admin.stats, 'projects', signupDays],
    queryFn: () => fetchStats(`projects?days=${signupDays}`) as Promise<ProjectData | null>,
    ...QUERY_CONFIG,
  });

  const webhookQuery = useQuery({
    queryKey: [...queryKeys.admin.stats, 'webhooks', webhookDays],
    queryFn: () => fetchStats(`webhooks?days=${webhookDays}`) as Promise<WebhookData | null>,
    ...QUERY_CONFIG,
  });

  const subscriptionQuery = useQuery({
    queryKey: [...queryKeys.admin.stats, 'subscriptions'],
    queryFn: () => fetchStats('subscriptions') as Promise<SubscriptionStatsData | null>,
    ...QUERY_CONFIG,
  });

  const revenueQuery = useQuery({
    queryKey: [...queryKeys.admin.stats, 'revenue'],
    queryFn: () => fetchStats('revenue?months=6') as Promise<RevenueData | null>,
    ...QUERY_CONFIG,
  });

  const signupData = signupQuery.data;
  const orgData = orgQuery.data;
  const projectData = projectQuery.data;
  const webhookData = webhookQuery.data;
  const subscriptionData = subscriptionQuery.data;
  const revenueData = revenueQuery.data;

  return (
    <div className='space-y-6'>
      {/* Section Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center space-x-3'>
          <div className='rounded-xl bg-purple-100 p-2'>
            <TrendingUpIcon className='size-5 text-purple-600' />
          </div>
          <h2 className='text-foreground text-lg font-semibold'>Analytics</h2>
        </div>
      </div>

      {/* Growth Charts Row */}
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        {/* Signups Chart */}
        <AdminBox>
          <div className='mb-4 flex items-center justify-between'>
            <div className='flex items-center space-x-2'>
              <UsersIcon className='size-5 text-blue-500' />
              <h3 className='text-foreground font-medium'>User Signups</h3>
            </div>
            <div className='flex items-center space-x-2'>
              <select
                value={signupDays}
                onChange={e => setSignupDays(parseInt(e.target.value, 10))}
                className={input.base}
              >
                {PERIOD_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                type='button'
                onClick={() => signupQuery.refetch()}
                className='text-muted-foreground/70 hover:bg-secondary hover:text-muted-foreground rounded-lg p-1'
              >
                <RefreshCwIcon className='size-4' />
              </button>
            </div>
          </div>
          {signupQuery.isLoading ?
            <div className='flex h-64 items-center justify-center'>
              <LoaderIcon className='size-6 animate-spin text-blue-500' />
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
                color='rgb(59, 130, 246)'
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
            <div className='flex items-center space-x-2'>
              <HomeIcon className='size-5 text-green-500' />
              <h3 className='text-foreground font-medium'>Orgs & Projects</h3>
            </div>
          </div>
          {orgQuery.isLoading || projectQuery.isLoading ?
            <div className='flex h-64 items-center justify-center'>
              <LoaderIcon className='size-6 animate-spin text-green-500' />
            </div>
          : orgData && projectData ?
            <>
              <div className='mb-2 flex space-x-4'>
                <div>
                  <span className='text-2xl font-bold text-green-600'>{orgData.total ?? 0}</span>
                  <span className='text-muted-foreground ml-1 text-sm'>orgs</span>
                </div>
                <div>
                  <span className='text-2xl font-bold text-purple-600'>
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
                    color: 'rgb(16, 185, 129)',
                  },
                  {
                    label: 'Projects',
                    data: projectData.data.map(d => d.count),
                    color: 'rgb(139, 92, 246)',
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
            <button
              type='button'
              onClick={() => subscriptionQuery.refetch()}
              className='text-muted-foreground/70 hover:bg-secondary hover:text-muted-foreground rounded p-1'
            >
              <RefreshCwIcon className='size-4' />
            </button>
          </div>
          {subscriptionQuery.isLoading ?
            <div className='flex h-48 items-center justify-center'>
              <LoaderIcon className='size-6 animate-spin text-blue-500' />
            </div>
          : subscriptionData ?
            <>
              {subscriptionData.error && (
                <div className='mb-2 flex items-center text-sm text-yellow-600'>
                  <AlertTriangleIcon className='mr-1 size-4' />
                  Stripe unavailable
                </div>
              )}
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
                  'rgba(16, 185, 129, 0.8)',
                  'rgba(59, 130, 246, 0.8)',
                  'rgba(245, 158, 11, 0.8)',
                  'rgba(107, 114, 128, 0.8)',
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
            <div className='flex items-center space-x-2'>
              <DollarSignIcon className='size-5 text-green-500' />
              <h3 className='text-foreground font-medium'>Revenue (6 months)</h3>
            </div>
            <button
              type='button'
              onClick={() => revenueQuery.refetch()}
              className='text-muted-foreground/70 hover:bg-secondary hover:text-muted-foreground rounded p-1'
            >
              <RefreshCwIcon className='size-4' />
            </button>
          </div>
          {revenueQuery.isLoading ?
            <div className='flex h-48 items-center justify-center'>
              <LoaderIcon className='size-6 animate-spin text-green-500' />
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
                colors={revenueData.data.map(() => 'rgba(16, 185, 129, 0.8)')}
              />
            </>
          : <div className='text-muted-foreground/70 flex h-48 flex-col items-center justify-center'>
              {revenueData?.error && <AlertTriangleIcon className='mb-2 size-6 text-yellow-500' />}
              <span>No revenue data</span>
            </div>
          }
        </AdminBox>
      </div>

      {/* Webhook Health Row */}
      <AdminBox>
        <div className='mb-4 flex items-center justify-between'>
          <div className='flex items-center space-x-2'>
            <AlertTriangleIcon className='size-5 text-orange-500' />
            <h3 className='text-foreground font-medium'>Webhook Health</h3>
          </div>
          <div className='flex items-center space-x-2'>
            <select
              value={webhookDays}
              onChange={e => setWebhookDays(parseInt(e.target.value, 10))}
              className={input.base}
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
            </select>
            <button
              type='button'
              onClick={() => webhookQuery.refetch()}
              className='text-muted-foreground/70 hover:bg-secondary hover:text-muted-foreground rounded p-1'
            >
              <RefreshCwIcon className='size-4' />
            </button>
          </div>
        </div>
        {webhookQuery.isLoading ?
          <div className='flex h-48 items-center justify-center'>
            <LoaderIcon className='size-6 animate-spin text-orange-500' />
          </div>
        : webhookData?.data ?
          <>
            <div className='mb-4 flex space-x-6'>
              <div>
                <span className='text-2xl font-bold text-green-600'>
                  {webhookData.totals?.success ?? 0}
                </span>
                <span className='text-muted-foreground ml-1 text-sm'>success</span>
              </div>
              <div>
                <span className='text-2xl font-bold text-red-600'>
                  {webhookData.totals?.failed ?? 0}
                </span>
                <span className='text-muted-foreground ml-1 text-sm'>failed</span>
              </div>
              <div>
                <span className='text-2xl font-bold text-yellow-600'>
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
                  color: 'rgb(16, 185, 129)',
                },
                {
                  label: 'Failed',
                  data: webhookData.data.map(d => d.failed),
                  color: 'rgb(239, 68, 68)',
                },
                {
                  label: 'Pending',
                  data: webhookData.data.map(d => d.pending),
                  color: 'rgb(245, 158, 11)',
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
