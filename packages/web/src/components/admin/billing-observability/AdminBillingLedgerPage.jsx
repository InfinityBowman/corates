/**
 * Admin Billing Ledger Page
 * Displays Stripe event ledger entries with filtering and search
 */

import { createSignal, Show, For, onCleanup } from 'solid-js';
import { A } from '@solidjs/router';
import { FiLoader, FiAlertCircle, FiCopy, FiCheck, FiExternalLink, FiFilter } from 'solid-icons/fi';
import { isAdmin, isAdminChecked } from '@/stores/adminStore.js';
import { useAdminBillingLedger } from '@primitives/useAdminQueries.js';
import { showToast } from '@corates/ui';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'received', label: 'Received' },
  { value: 'processed', label: 'Processed' },
  { value: 'skipped_duplicate', label: 'Skipped (Duplicate)' },
  { value: 'failed', label: 'Failed' },
  { value: 'ignored_unverified', label: 'Ignored (Unverified)' },
];

const LIMIT_OPTIONS = [25, 50, 100, 200];

export default function AdminBillingLedgerPage() {
  const [statusFilter, setStatusFilter] = createSignal('');
  const [typeFilter, setTypeFilter] = createSignal('');
  const [limit, setLimit] = createSignal(50);
  const [debouncedTypeFilter, setDebouncedTypeFilter] = createSignal('');
  const [copiedId, setCopiedId] = createSignal(null);

  const ledgerQuery = useAdminBillingLedger(() => ({
    limit: limit(),
    status: statusFilter() || undefined,
    type: debouncedTypeFilter() || undefined,
  }));

  let typeTimeout;
  const handleTypeInput = e => {
    setTypeFilter(e.target.value);
    clearTimeout(typeTimeout);
    typeTimeout = setTimeout(() => {
      setDebouncedTypeFilter(e.target.value);
    }, 300);
  };

  onCleanup(() => {
    clearTimeout(typeTimeout);
  });

  const handleCopy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(`${label}-${text}`);
      showToast.success('Copied', `${label} copied to clipboard`);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      showToast.error('Error', 'Failed to copy to clipboard');
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
      // Checkout sessions don't have a direct dashboard URL
      // They can be accessed via payment intent or customer page if needed
      default:
        return null;
    }
  };

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

  const entries = () => ledgerQuery.data?.entries || [];
  const stats = () => ledgerQuery.data?.stats || {};

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
        {/* Header */}
        <div class='mb-6 flex items-center justify-between'>
          <div class='flex items-center space-x-3'>
            <div class='flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100'>
              <FiFilter class='h-6 w-6 text-blue-600' />
            </div>
            <div>
              <h1 class='text-2xl font-bold text-gray-900'>Stripe Event Ledger</h1>
              <p class='text-sm text-gray-500'>View and search Stripe webhook events</p>
            </div>
          </div>
          <button
            onClick={() => ledgerQuery.refetch()}
            class='rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50'
            disabled={ledgerQuery.isFetching}
          >
            {ledgerQuery.isFetching ?
              <FiLoader class='h-4 w-4 animate-spin' />
            : 'Refresh'}
          </button>
        </div>

        {/* Stats Summary */}
        <Show when={stats()}>
          <div class='mb-6 grid grid-cols-2 gap-4 md:grid-cols-5'>
            <div class='rounded-lg border border-gray-200 bg-white p-4'>
              <p class='text-sm text-gray-500'>Total</p>
              <p class='text-2xl font-bold text-gray-900'>{stats().total || 0}</p>
            </div>
            <For each={Object.entries(stats().byStatus || {})}>
              {([status, count]) => (
                <div class='rounded-lg border border-gray-200 bg-white p-4'>
                  <p class='text-sm text-gray-500 capitalize'>{status.replace(/_/g, ' ')}</p>
                  <p class='text-2xl font-bold text-gray-900'>{count}</p>
                </div>
              )}
            </For>
          </div>
        </Show>

        {/* Filters */}
        <div class='mb-6 rounded-lg border border-gray-200 bg-white p-4'>
          <div class='grid grid-cols-1 gap-4 md:grid-cols-3'>
            <div>
              <label class='block text-sm font-medium text-gray-700'>Status</label>
              <select
                value={statusFilter()}
                onInput={e => setStatusFilter(e.target.value)}
                class='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500'
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
                class='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500'
              />
            </div>
            <div>
              <label class='block text-sm font-medium text-gray-700'>Limit</label>
              <select
                value={limit()}
                onInput={e => setLimit(parseInt(e.target.value, 10))}
                class='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500'
              >
                <For each={LIMIT_OPTIONS}>{opt => <option value={opt}>{opt}</option>}</For>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div class='rounded-lg border border-gray-200 bg-white'>
          <Show
            when={!ledgerQuery.isLoading}
            fallback={
              <div class='flex items-center justify-center py-12'>
                <FiLoader class='h-8 w-8 animate-spin text-blue-600' />
              </div>
            }
          >
            <Show
              when={entries().length > 0}
              fallback={
                <div class='p-12 text-center text-gray-500'>
                  <p>No ledger entries found</p>
                </div>
              }
            >
              <div class='overflow-x-auto'>
                <table class='min-w-full divide-y divide-gray-200'>
                  <thead class='bg-gray-50'>
                    <tr>
                      <th class='px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase'>
                        Time
                      </th>
                      <th class='px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase'>
                        Status
                      </th>
                      <th class='px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase'>
                        Type
                      </th>
                      <th class='px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase'>
                        Event ID
                      </th>
                      <th class='px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase'>
                        Org ID
                      </th>
                      <th class='px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase'>
                        Stripe IDs
                      </th>
                      <th class='px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase'>
                        Request ID
                      </th>
                      <th class='px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase'>
                        Error
                      </th>
                    </tr>
                  </thead>
                  <tbody class='divide-y divide-gray-200 bg-white'>
                    <For each={entries()}>
                      {entry => (
                        <tr class='hover:bg-gray-50'>
                          <td class='px-6 py-4 text-sm whitespace-nowrap text-gray-500'>
                            <div>{formatDate(entry.receivedAt)}</div>
                            {entry.processedAt && (
                              <div class='text-xs text-gray-400'>
                                Processed: {formatDate(entry.processedAt)}
                              </div>
                            )}
                          </td>
                          <td class='px-6 py-4 whitespace-nowrap'>
                            <span
                              class={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(entry.status)}`}
                            >
                              {entry.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td class='px-6 py-4 text-sm whitespace-nowrap text-gray-900'>
                            <code class='text-xs'>{entry.type || '-'}</code>
                          </td>
                          <td class='px-6 py-4 text-sm whitespace-nowrap'>
                            {entry.stripeEventId ?
                              <div class='flex items-center space-x-1'>
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
                            : <span class='text-gray-400'>-</span>}
                          </td>
                          <td class='px-6 py-4 text-sm whitespace-nowrap'>
                            {entry.orgId ?
                              <div class='flex items-center space-x-1'>
                                <A
                                  href={`/admin/orgs/${entry.orgId}`}
                                  class='text-blue-600 hover:text-blue-800'
                                >
                                  <code class='font-mono text-xs'>
                                    {entry.orgId.slice(0, 8)}...
                                  </code>
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
                            : <span class='text-gray-400'>-</span>}
                          </td>
                          <td class='px-6 py-4 text-sm'>
                            <div class='space-y-1'>
                              {entry.stripeCustomerId && (
                                <div class='flex items-center space-x-1'>
                                  <span class='text-xs text-gray-500'>C:</span>
                                  <code class='font-mono text-xs text-gray-800'>
                                    {entry.stripeCustomerId.slice(0, 12)}...
                                  </code>
                                  <button
                                    onClick={() =>
                                      handleCopy(entry.stripeCustomerId, 'Customer ID')
                                    }
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
                                    onClick={() =>
                                      handleCopy(entry.stripeSubscriptionId, 'Subscription ID')
                                    }
                                    class='text-gray-400 hover:text-gray-600'
                                    title='Copy subscription ID'
                                  >
                                    {(
                                      copiedId() === `Subscription ID-${entry.stripeSubscriptionId}`
                                    ) ?
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
                                    onClick={() =>
                                      handleCopy(
                                        entry.stripeCheckoutSessionId,
                                        'Checkout Session ID',
                                      )
                                    }
                                    class='text-gray-400 hover:text-gray-600'
                                    title='Copy checkout session ID'
                                  >
                                    {(
                                      copiedId() ===
                                      `Checkout Session ID-${entry.stripeCheckoutSessionId}`
                                    ) ?
                                      <FiCheck class='h-3 w-3 text-green-600' />
                                    : <FiCopy class='h-3 w-3' />}
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                          <td class='px-6 py-4 text-sm whitespace-nowrap'>
                            {entry.requestId ?
                              <div class='flex items-center space-x-1'>
                                <code class='font-mono text-xs text-gray-800'>
                                  {entry.requestId.slice(0, 8)}...
                                </code>
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
                            : <span class='text-gray-400'>-</span>}
                          </td>
                          <td class='px-6 py-4 text-sm text-gray-500'>
                            {entry.error ?
                              <span class='text-xs text-red-600' title={entry.error}>
                                {entry.error.length > 50 ?
                                  `${entry.error.slice(0, 50)}...`
                                : entry.error}
                              </span>
                            : entry.httpStatus ?
                              <span class='text-xs'>{entry.httpStatus}</span>
                            : '-'}
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>
          </Show>
        </div>
      </Show>
    </Show>
  );
}
