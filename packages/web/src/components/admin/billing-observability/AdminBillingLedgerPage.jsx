/**
 * Admin Billing Ledger Page
 * Displays Stripe event ledger entries with filtering and search
 */

import { createSignal, Show, For, Switch, Match } from 'solid-js';
import { useDebouncedSignal } from '@/primitives/useDebouncedSignal.js';
import { A } from '@solidjs/router';
import { FiLoader, FiAlertCircle, FiCopy, FiCheck, FiExternalLink, FiFilter } from 'solid-icons/fi';
import { isAdmin, isAdminChecked } from '@/stores/adminStore.js';
import { useAdminBillingLedger } from '@primitives/useAdminQueries.js';
import { showToast } from '@/components/ui/toast';
import { DashboardHeader, AdminBox, AdminDataTable } from '../ui/index.js';
import { input } from '../styles/admin-tokens.js';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'received', label: 'Received' },
  { value: 'processed', label: 'Processed' },
  { value: 'skipped_duplicate', label: 'Skipped (Duplicate)' },
  { value: 'failed', label: 'Failed' },
  { value: 'ignored_unverified', label: 'Ignored (Unverified)' },
];

const LIMIT_OPTIONS = [25, 50, 100, 200];

const formatDate = timestamp => {
  if (!timestamp) return '-';
  const date =
    timestamp instanceof Date ? timestamp
    : typeof timestamp === 'string' ? new Date(timestamp)
    : new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
};

const getStatusColor = status => {
  switch (status) {
    case 'processed':
      return 'bg-green-100 text-green-800';
    case 'failed':
      return 'bg-red-100 text-red-800';
    case 'ignored_unverified':
      return 'bg-yellow-100 text-yellow-800';
    case 'skipped_duplicate':
      return 'bg-gray-100 text-gray-800';
    case 'received':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getStripeUrl = (type, id) => {
  if (!id) return null;
  const base = 'https://dashboard.stripe.com';
  switch (type) {
    case 'customer':
      return `${base}/customers/${id}`;
    case 'subscription':
      return `${base}/subscriptions/${id}`;
    case 'event':
      return `${base}/events/${id}`;
    default:
      return null;
  }
};

export default function AdminBillingLedgerPage() {
  const [statusFilter, setStatusFilter] = createSignal('');
  const [typeFilter, setTypeFilter, debouncedTypeFilter] = useDebouncedSignal('', 300);
  const [limit, setLimit] = createSignal(50);
  const [copiedId, setCopiedId] = createSignal(null);

  const ledgerQuery = useAdminBillingLedger(() => ({
    limit: limit(),
    status: statusFilter() || undefined,
    type: debouncedTypeFilter() || undefined,
  }));

  const handleTypeInput = e => {
    setTypeFilter(e.target.value);
  };

  const handleCopy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(`${label}-${text}`);
      showToast.success('Copied', `${label} copied to clipboard`);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.warn('Clipboard copy failed:', err.message);
      showToast.error('Error', 'Failed to copy to clipboard');
    }
  };

  const entries = () => ledgerQuery.data?.entries || [];
  const stats = () => ledgerQuery.data?.stats || {};

  const columns = [
    {
      accessorKey: 'receivedAt',
      header: 'Time',
      cell: info => {
        const entry = info.row.original;
        return (
          <div class='whitespace-nowrap text-gray-500'>
            <div>{formatDate(entry.receivedAt)}</div>
            {entry.processedAt && (
              <div class='text-xs text-gray-400'>Processed: {formatDate(entry.processedAt)}</div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: info => {
        const value = info.getValue();
        return (
          <span
            class={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${getStatusColor(value)}`}
          >
            {value.replace(/_/g, ' ')}
          </span>
        );
      },
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: info => <code class='text-xs whitespace-nowrap'>{info.getValue() || '-'}</code>,
    },
    {
      accessorKey: 'stripeEventId',
      header: 'Event ID',
      cell: info => {
        const entry = info.row.original;
        return (
          <Show when={entry.stripeEventId} fallback={<span class='text-gray-400'>-</span>}>
            <div class='flex items-center space-x-1 whitespace-nowrap'>
              <code class='font-mono text-xs text-gray-800'>
                {entry.stripeEventId.slice(0, 12)}...
              </code>
              <button
                onClick={() => handleCopy(entry.stripeEventId, 'Event ID')}
                class='text-gray-400 hover:text-gray-600'
                title='Copy event ID'
              >
                {copiedId() === `Event ID-${entry.stripeEventId}` ?
                  <FiCheck class='h-3 w-3 text-green-600' />
                : <FiCopy class='h-3 w-3' />}
              </button>
              <a
                href={getStripeUrl('event', entry.stripeEventId)}
                target='_blank'
                rel='noopener noreferrer'
                class='text-gray-400 hover:text-gray-600'
                title='Open in Stripe'
              >
                <FiExternalLink class='h-3 w-3' />
              </a>
            </div>
          </Show>
        );
      },
    },
    {
      accessorKey: 'orgId',
      header: 'Org ID',
      cell: info => {
        const entry = info.row.original;
        return (
          <Show when={entry.orgId} fallback={<span class='text-gray-400'>-</span>}>
            <div class='flex items-center space-x-1 whitespace-nowrap'>
              <A href={`/admin/orgs/${entry.orgId}`} class='text-blue-600 hover:text-blue-800'>
                <code class='font-mono text-xs'>{entry.orgId.slice(0, 8)}...</code>
              </A>
              <button
                onClick={() => handleCopy(entry.orgId, 'Org ID')}
                class='text-gray-400 hover:text-gray-600'
                title='Copy org ID'
              >
                {copiedId() === `Org ID-${entry.orgId}` ?
                  <FiCheck class='h-3 w-3 text-green-600' />
                : <FiCopy class='h-3 w-3' />}
              </button>
            </div>
          </Show>
        );
      },
    },
    {
      id: 'stripeIds',
      header: 'Stripe IDs',
      cell: info => {
        const entry = info.row.original;
        return (
          <div class='space-y-1'>
            {entry.stripeCustomerId && (
              <div class='flex items-center space-x-1'>
                <span class='text-xs text-gray-500'>C:</span>
                <code class='font-mono text-xs text-gray-800'>
                  {entry.stripeCustomerId.slice(0, 12)}...
                </code>
                <button
                  onClick={() => handleCopy(entry.stripeCustomerId, 'Customer ID')}
                  class='text-gray-400 hover:text-gray-600'
                  title='Copy customer ID'
                >
                  {copiedId() === `Customer ID-${entry.stripeCustomerId}` ?
                    <FiCheck class='h-3 w-3 text-green-600' />
                  : <FiCopy class='h-3 w-3' />}
                </button>
                <a
                  href={getStripeUrl('customer', entry.stripeCustomerId)}
                  target='_blank'
                  rel='noopener noreferrer'
                  class='text-gray-400 hover:text-gray-600'
                  title='Open in Stripe'
                >
                  <FiExternalLink class='h-3 w-3' />
                </a>
              </div>
            )}
            {entry.stripeSubscriptionId && (
              <div class='flex items-center space-x-1'>
                <span class='text-xs text-gray-500'>S:</span>
                <code class='font-mono text-xs text-gray-800'>
                  {entry.stripeSubscriptionId.slice(0, 12)}...
                </code>
                <button
                  onClick={() => handleCopy(entry.stripeSubscriptionId, 'Subscription ID')}
                  class='text-gray-400 hover:text-gray-600'
                  title='Copy subscription ID'
                >
                  {copiedId() === `Subscription ID-${entry.stripeSubscriptionId}` ?
                    <FiCheck class='h-3 w-3 text-green-600' />
                  : <FiCopy class='h-3 w-3' />}
                </button>
                <a
                  href={getStripeUrl('subscription', entry.stripeSubscriptionId)}
                  target='_blank'
                  rel='noopener noreferrer'
                  class='text-gray-400 hover:text-gray-600'
                  title='Open in Stripe'
                >
                  <FiExternalLink class='h-3 w-3' />
                </a>
              </div>
            )}
            {entry.stripeCheckoutSessionId && (
              <div class='flex items-center space-x-1'>
                <span class='text-xs text-gray-500'>CS:</span>
                <code class='font-mono text-xs text-gray-800'>
                  {entry.stripeCheckoutSessionId.slice(0, 12)}...
                </code>
                <button
                  onClick={() => handleCopy(entry.stripeCheckoutSessionId, 'Checkout Session ID')}
                  class='text-gray-400 hover:text-gray-600'
                  title='Copy checkout session ID'
                >
                  {copiedId() === `Checkout Session ID-${entry.stripeCheckoutSessionId}` ?
                    <FiCheck class='h-3 w-3 text-green-600' />
                  : <FiCopy class='h-3 w-3' />}
                </button>
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'requestId',
      header: 'Request ID',
      cell: info => {
        const entry = info.row.original;
        return (
          <Show when={entry.requestId} fallback={<span class='text-gray-400'>-</span>}>
            <div class='flex items-center space-x-1 whitespace-nowrap'>
              <code class='font-mono text-xs text-gray-800'>{entry.requestId.slice(0, 8)}...</code>
              <button
                onClick={() => handleCopy(entry.requestId, 'Request ID')}
                class='text-gray-400 hover:text-gray-600'
                title='Copy request ID'
              >
                {copiedId() === `Request ID-${entry.requestId}` ?
                  <FiCheck class='h-3 w-3 text-green-600' />
                : <FiCopy class='h-3 w-3' />}
              </button>
            </div>
          </Show>
        );
      },
    },
    {
      accessorKey: 'error',
      header: 'Error',
      cell: info => {
        const entry = info.row.original;
        return (
          <Switch fallback={<span class='text-gray-400'>-</span>}>
            <Match when={entry.error}>
              <span class='text-xs text-red-600' title={entry.error}>
                {entry.error.length > 50 ? `${entry.error.slice(0, 50)}...` : entry.error}
              </span>
            </Match>
            <Match when={entry.httpStatus}>
              <span class='text-xs text-gray-500'>{entry.httpStatus}</span>
            </Match>
          </Switch>
        );
      },
    },
  ];

  return (
    <Show
      when={isAdminChecked()}
      fallback={
        <div class='flex min-h-100 items-center justify-center'>
          <FiLoader class='h-8 w-8 animate-spin text-blue-600' />
        </div>
      }
    >
      <Show
        when={isAdmin()}
        fallback={
          <div class='flex min-h-100 flex-col items-center justify-center text-gray-500'>
            <FiAlertCircle class='mb-4 h-12 w-12' />
            <p class='text-lg font-medium'>Access Denied</p>
            <p class='text-sm'>You do not have admin privileges.</p>
          </div>
        }
      >
        <DashboardHeader
          icon={FiFilter}
          title='Billing Ledger'
          description='Stripe event ledger entries with filtering and search'
          actions={
            <button
              onClick={() => ledgerQuery.refetch()}
              class='inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-xs hover:bg-gray-50 focus:ring-[3px] focus:ring-blue-100 focus:outline-none'
              disabled={ledgerQuery.isFetching}
            >
              {ledgerQuery.isFetching ?
                <FiLoader class='h-4 w-4 animate-spin' />
              : 'Refresh'}
            </button>
          }
        />

        {/* Stats Summary */}
        <Show when={stats()}>
          <div class='mb-6 grid grid-cols-2 gap-4 md:grid-cols-5'>
            <div class='rounded-xl border border-gray-200 bg-white p-4 shadow-xs'>
              <p class='text-sm text-gray-500'>Total</p>
              <p class='text-2xl font-bold text-gray-900'>{stats().total || 0}</p>
            </div>
            <For each={Object.entries(stats().byStatus || {})}>
              {([status, count]) => (
                <div class='rounded-xl border border-gray-200 bg-white p-4 shadow-xs'>
                  <p class='text-sm text-gray-500 capitalize'>{status.replace(/_/g, ' ')}</p>
                  <p class='text-2xl font-bold text-gray-900'>{count}</p>
                </div>
              )}
            </For>
          </div>
        </Show>

        {/* Filters */}
        <AdminBox class='mb-6'>
          <div class='grid grid-cols-1 gap-4 md:grid-cols-3'>
            <div>
              <label class='block text-sm font-medium text-gray-700'>Status</label>
              <select
                value={statusFilter()}
                onInput={e => setStatusFilter(e.target.value)}
                class={`mt-1 block w-full ${input.base}`}
              >
                <For each={STATUS_OPTIONS}>
                  {option => <option value={option.value}>{option.label}</option>}
                </For>
              </select>
            </div>
            <div>
              <label class='block text-sm font-medium text-gray-700'>Event Type</label>
              <input
                type='text'
                value={typeFilter()}
                onInput={handleTypeInput}
                placeholder='e.g., checkout.session.completed'
                class={`mt-1 block w-full ${input.base}`}
              />
            </div>
            <div>
              <label class='block text-sm font-medium text-gray-700'>Limit</label>
              <select
                value={limit()}
                onInput={e => setLimit(parseInt(e.target.value, 10))}
                class={`mt-1 block w-full ${input.base}`}
              >
                <For each={LIMIT_OPTIONS}>{opt => <option value={opt}>{opt}</option>}</For>
              </select>
            </div>
          </div>
        </AdminBox>

        {/* Table */}
        <AdminDataTable
          columns={columns}
          data={entries()}
          loading={ledgerQuery.isLoading}
          emptyMessage='No ledger entries found'
          enableSorting
          pageSize={limit()}
        />
      </Show>
    </Show>
  );
}
