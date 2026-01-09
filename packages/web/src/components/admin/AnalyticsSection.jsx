/**
 * Analytics Section for Admin Dashboard
 * Displays charts for signups, webhooks, subscriptions, and revenue
 */

import { createSignal, Show, For, createResource, Suspense } from 'solid-js';
import {
  FiTrendingUp,
  FiLoader,
  FiRefreshCw,
  FiAlertTriangle,
  FiUsers,
  FiHome,
  FiDollarSign,
} from 'solid-icons/fi';
import { apiFetch } from '@/lib/apiFetch.js';
import { LineChart, BarChart, DoughnutChart } from './charts/index.js';
import { AdminBox } from './ui/index.js';
import { input } from './styles/admin-tokens.js';

const PERIOD_OPTIONS = [
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
];

export default function AnalyticsSection() {
  const [signupDays, setSignupDays] = createSignal(30);
  const [webhookDays, setWebhookDays] = createSignal(7);

  // Fetch signup stats
  const [signupData, { refetch: refetchSignups }] = createResource(
    () => signupDays(),
    async days => {
      try {
        return await apiFetch.get(`/api/admin/stats/signups?days=${days}`, { toastMessage: false });
      } catch {
        return null;
      }
    },
  );

  // Fetch organization stats
  const [orgData] = createResource(
    () => signupDays(),
    async days => {
      try {
        return await apiFetch.get(`/api/admin/stats/organizations?days=${days}`, {
          toastMessage: false,
        });
      } catch {
        return null;
      }
    },
  );

  // Fetch project stats
  const [projectData] = createResource(
    () => signupDays(),
    async days => {
      try {
        return await apiFetch.get(`/api/admin/stats/projects?days=${days}`, {
          toastMessage: false,
        });
      } catch {
        return null;
      }
    },
  );

  // Fetch webhook stats
  const [webhookData, { refetch: refetchWebhooks }] = createResource(
    () => webhookDays(),
    async days => {
      try {
        return await apiFetch.get(`/api/admin/stats/webhooks?days=${days}`, {
          toastMessage: false,
        });
      } catch {
        return null;
      }
    },
  );

  // Fetch subscription breakdown
  const [subscriptionData, { refetch: refetchSubs }] = createResource(async () => {
    try {
      return await apiFetch.get('/api/admin/stats/subscriptions', { toastMessage: false });
    } catch {
      return null;
    }
  });

  // Fetch revenue
  const [revenueData, { refetch: refetchRevenue }] = createResource(async () => {
    try {
      return await apiFetch.get('/api/admin/stats/revenue?months=6', { toastMessage: false });
    } catch {
      return null;
    }
  });

  const formatDate = dateStr => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatCurrency = cents => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(cents / 100);
  };

  return (
    <div class='space-y-6'>
      {/* Section Header */}
      <div class='flex items-center justify-between'>
        <div class='flex items-center space-x-3'>
          <div class='rounded-xl bg-purple-100 p-2'>
            <FiTrendingUp class='h-5 w-5 text-purple-600' />
          </div>
          <h2 class='text-lg font-semibold text-gray-900'>Analytics</h2>
        </div>
      </div>

      {/* Growth Charts Row */}
      <div class='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        {/* Signups Chart */}
        <AdminBox>
          <div class='mb-4 flex items-center justify-between'>
            <div class='flex items-center space-x-2'>
              <FiUsers class='h-5 w-5 text-blue-500' />
              <h3 class='font-medium text-gray-900'>User Signups</h3>
            </div>
            <div class='flex items-center space-x-2'>
              <select
                value={signupDays()}
                onChange={e => setSignupDays(parseInt(e.target.value, 10))}
                class={input.base}
              >
                <For each={PERIOD_OPTIONS}>
                  {opt => <option value={opt.value}>{opt.label}</option>}
                </For>
              </select>
              <button
                onClick={() => refetchSignups()}
                class='rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600'
              >
                <FiRefreshCw class='h-4 w-4' />
              </button>
            </div>
          </div>
          <Suspense
            fallback={
              <div class='flex h-64 items-center justify-center'>
                <FiLoader class='h-6 w-6 animate-spin text-blue-500' />
              </div>
            }
          >
            <Show
              when={signupData() && signupData().data}
              fallback={
                <div class='flex h-64 items-center justify-center text-gray-400'>
                  <span>No data available</span>
                </div>
              }
            >
              <div class='mb-2 text-2xl font-bold text-gray-900'>
                {signupData().total} <span class='text-sm font-normal text-gray-500'>total</span>
              </div>
              <LineChart
                labels={signupData().data.map(d => formatDate(d.date))}
                data={signupData().data.map(d => d.count)}
                label='Signups'
                color='rgb(59, 130, 246)'
                fill={true}
              />
            </Show>
          </Suspense>
        </AdminBox>

        {/* Organizations & Projects Chart */}
        <AdminBox>
          <div class='mb-4 flex items-center justify-between'>
            <div class='flex items-center space-x-2'>
              <FiHome class='h-5 w-5 text-green-500' />
              <h3 class='font-medium text-gray-900'>Orgs & Projects</h3>
            </div>
          </div>
          <Suspense
            fallback={
              <div class='flex h-64 items-center justify-center'>
                <FiLoader class='h-6 w-6 animate-spin text-green-500' />
              </div>
            }
          >
            <Show
              when={orgData() && projectData()}
              fallback={
                <div class='flex h-64 items-center justify-center text-gray-400'>
                  <span>No data available</span>
                </div>
              }
            >
              <div class='mb-2 flex space-x-4'>
                <div>
                  <span class='text-2xl font-bold text-green-600'>{orgData()?.total || 0}</span>
                  <span class='ml-1 text-sm text-gray-500'>orgs</span>
                </div>
                <div>
                  <span class='text-2xl font-bold text-purple-600'>
                    {projectData()?.total || 0}
                  </span>
                  <span class='ml-1 text-sm text-gray-500'>projects</span>
                </div>
              </div>
              <LineChart
                labels={orgData().data.map(d => formatDate(d.date))}
                datasets={[
                  {
                    label: 'Organizations',
                    data: orgData().data.map(d => d.count),
                    borderColor: 'rgb(16, 185, 129)',
                    backgroundColor: 'transparent',
                    tension: 0.3,
                    pointRadius: 2,
                  },
                  {
                    label: 'Projects',
                    data: projectData().data.map(d => d.count),
                    borderColor: 'rgb(139, 92, 246)',
                    backgroundColor: 'transparent',
                    tension: 0.3,
                    pointRadius: 2,
                  },
                ]}
                showLegend={true}
              />
            </Show>
          </Suspense>
        </AdminBox>
      </div>

      {/* Billing Row */}
      <div class='grid grid-cols-1 gap-6 lg:grid-cols-3'>
        {/* Subscriptions Breakdown */}
        <AdminBox>
          <div class='mb-4 flex items-center justify-between'>
            <h3 class='font-medium text-gray-900'>Subscriptions</h3>
            <button
              onClick={() => refetchSubs()}
              class='rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600'
            >
              <FiRefreshCw class='h-4 w-4' />
            </button>
          </div>
          <Suspense
            fallback={
              <div class='flex h-48 items-center justify-center'>
                <FiLoader class='h-6 w-6 animate-spin text-blue-500' />
              </div>
            }
          >
            <Show
              when={subscriptionData()}
              fallback={
                <div class='flex h-48 items-center justify-center text-gray-400'>
                  <span>No data</span>
                </div>
              }
            >
              <Show when={subscriptionData().error}>
                <div class='mb-2 flex items-center text-sm text-yellow-600'>
                  <FiAlertTriangle class='mr-1 h-4 w-4' />
                  Stripe unavailable
                </div>
              </Show>
              <DoughnutChart
                class='h-48'
                labels={['Active', 'Trialing', 'Past Due', 'Canceled']}
                data={[
                  subscriptionData().active || 0,
                  subscriptionData().trialing || 0,
                  subscriptionData().pastDue || 0,
                  subscriptionData().canceled || 0,
                ]}
                colors={[
                  'rgba(16, 185, 129, 0.8)',
                  'rgba(59, 130, 246, 0.8)',
                  'rgba(245, 158, 11, 0.8)',
                  'rgba(107, 114, 128, 0.8)',
                ]}
                legendPosition='bottom'
              />
            </Show>
          </Suspense>
        </AdminBox>

        {/* Revenue Chart */}
        <AdminBox class='lg:col-span-2'>
          <div class='mb-4 flex items-center justify-between'>
            <div class='flex items-center space-x-2'>
              <FiDollarSign class='h-5 w-5 text-green-500' />
              <h3 class='font-medium text-gray-900'>Revenue (6 months)</h3>
            </div>
            <button
              onClick={() => refetchRevenue()}
              class='rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600'
            >
              <FiRefreshCw class='h-4 w-4' />
            </button>
          </div>
          <Suspense
            fallback={
              <div class='flex h-48 items-center justify-center'>
                <FiLoader class='h-6 w-6 animate-spin text-green-500' />
              </div>
            }
          >
            <Show
              when={revenueData() && revenueData().data?.length > 0}
              fallback={
                <div class='flex h-48 flex-col items-center justify-center text-gray-400'>
                  <Show when={revenueData()?.error}>
                    <FiAlertTriangle class='mb-2 h-6 w-6 text-yellow-500' />
                  </Show>
                  <span>No revenue data</span>
                </div>
              }
            >
              <div class='mb-2 text-2xl font-bold text-gray-900'>
                {formatCurrency(revenueData().total)}{' '}
                <span class='text-sm font-normal text-gray-500'>total</span>
              </div>
              <BarChart
                class='h-48'
                labels={revenueData().data.map(d => d.label)}
                data={revenueData().data.map(d => d.revenue / 100)}
                label='Revenue ($)'
                colors={revenueData().data.map(() => 'rgba(16, 185, 129, 0.8)')}
              />
            </Show>
          </Suspense>
        </AdminBox>
      </div>

      {/* Webhook Health Row */}
      <AdminBox>
        <div class='mb-4 flex items-center justify-between'>
          <div class='flex items-center space-x-2'>
            <FiAlertTriangle class='h-5 w-5 text-orange-500' />
            <h3 class='font-medium text-gray-900'>Webhook Health</h3>
          </div>
          <div class='flex items-center space-x-2'>
            <select
              value={webhookDays()}
              onChange={e => setWebhookDays(parseInt(e.target.value, 10))}
              class={input.base}
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
            </select>
            <button
              onClick={() => refetchWebhooks()}
              class='rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600'
            >
              <FiRefreshCw class='h-4 w-4' />
            </button>
          </div>
        </div>
        <Suspense
          fallback={
            <div class='flex h-48 items-center justify-center'>
              <FiLoader class='h-6 w-6 animate-spin text-orange-500' />
            </div>
          }
        >
          <Show
            when={webhookData() && webhookData().data}
            fallback={
              <div class='flex h-48 items-center justify-center text-gray-400'>
                <span>No webhook data</span>
              </div>
            }
          >
            <div class='mb-4 flex space-x-6'>
              <div>
                <span class='text-2xl font-bold text-green-600'>
                  {webhookData().totals?.success || 0}
                </span>
                <span class='ml-1 text-sm text-gray-500'>success</span>
              </div>
              <div>
                <span class='text-2xl font-bold text-red-600'>
                  {webhookData().totals?.failed || 0}
                </span>
                <span class='ml-1 text-sm text-gray-500'>failed</span>
              </div>
              <div>
                <span class='text-2xl font-bold text-yellow-600'>
                  {webhookData().totals?.pending || 0}
                </span>
                <span class='ml-1 text-sm text-gray-500'>pending</span>
              </div>
            </div>
            <LineChart
              class='h-48'
              labels={webhookData().data.map(d => formatDate(d.date))}
              datasets={[
                {
                  label: 'Success',
                  data: webhookData().data.map(d => d.success),
                  borderColor: 'rgb(16, 185, 129)',
                  backgroundColor: 'transparent',
                  tension: 0.3,
                  pointRadius: 3,
                },
                {
                  label: 'Failed',
                  data: webhookData().data.map(d => d.failed),
                  borderColor: 'rgb(239, 68, 68)',
                  backgroundColor: 'transparent',
                  tension: 0.3,
                  pointRadius: 3,
                },
                {
                  label: 'Pending',
                  data: webhookData().data.map(d => d.pending),
                  borderColor: 'rgb(245, 158, 11)',
                  backgroundColor: 'transparent',
                  tension: 0.3,
                  pointRadius: 3,
                },
              ]}
              showLegend={true}
            />
          </Show>
        </Suspense>
      </AdminBox>
    </div>
  );
}
