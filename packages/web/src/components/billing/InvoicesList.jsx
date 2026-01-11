/**
 * InvoicesList Component
 * Premium invoices list with status badges and empty state
 */

import { For, Show } from 'solid-js';
import { FiDownload, FiFileText, FiExternalLink } from 'solid-icons/fi';
import { apiFetch } from '@lib/apiFetch.js';
import { useQuery } from '@tanstack/solid-query';
import { queryKeys } from '@lib/queryKeys.js';

/**
 * Fetch invoices from API
 * @returns {Promise<object>} - The invoices
 */
async function fetchInvoices() {
  try {
    return await apiFetch.get('/api/billing/invoices', { toastMessage: false });
  } catch (err) {
    console.warn('Failed to fetch invoices:', err.message);
    return { invoices: [] };
  }
}

function formatDate(timestamp) {
  if (!timestamp) return null;
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatAmount(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

/**
 * Status badge component
 */
function StatusBadge(props) {
  const statusStyles = {
    paid: 'bg-green-50 text-green-700 border-green-200',
    open: 'bg-blue-50 text-blue-700 border-blue-200',
    draft: 'bg-gray-50 text-gray-700 border-gray-200',
    uncollectible: 'bg-red-50 text-red-700 border-red-200',
    void: 'bg-gray-50 text-gray-500 border-gray-200',
  };

  const statusLabels = {
    paid: 'Paid',
    open: 'Open',
    draft: 'Draft',
    uncollectible: 'Failed',
    void: 'Void',
  };

  return (
    <span
      class={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusStyles[props.status] || statusStyles.paid}`}
    >
      {statusLabels[props.status] || 'Paid'}
    </span>
  );
}

/**
 * Loading skeleton for invoices
 */
function InvoicesSkeleton() {
  return (
    <div class='divide-y divide-gray-100'>
      <For each={[1, 2, 3]}>
        {() => (
          <div class='flex animate-pulse items-center justify-between px-6 py-4'>
            <div class='flex items-center gap-4'>
              <div class='h-10 w-10 rounded-lg bg-gray-200' />
              <div class='space-y-2'>
                <div class='h-4 w-32 rounded bg-gray-200' />
                <div class='h-3 w-24 rounded bg-gray-200' />
              </div>
            </div>
            <div class='flex items-center gap-4'>
              <div class='h-4 w-16 rounded bg-gray-200' />
              <div class='h-6 w-14 rounded-full bg-gray-200' />
              <div class='h-8 w-8 rounded bg-gray-200' />
            </div>
          </div>
        )}
      </For>
    </div>
  );
}

/**
 * Empty state component
 */
function EmptyState() {
  return (
    <div class='px-6 py-12 text-center'>
      <div class='mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100'>
        <FiFileText class='h-7 w-7 text-gray-400' />
      </div>
      <h3 class='text-sm font-medium text-gray-900'>No invoices yet</h3>
      <p class='mt-1 text-sm text-gray-500'>
        Invoices will appear here once you have an active subscription.
      </p>
    </div>
  );
}

export default function InvoicesList() {
  const query = useQuery(() => ({
    queryKey: queryKeys.billing.invoices,
    queryFn: fetchInvoices,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 30,
    retry: 1,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  }));

  const handleDownload = async (invoiceId, pdfUrl) => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    } else {
      console.log('Download invoice:', invoiceId);
    }
  };

  return (
    <div class='overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm'>
      {/* Header */}
      <div class='border-b border-gray-200 bg-gray-50/50 px-6 py-4'>
        <div class='flex items-center justify-between'>
          <div class='flex items-center gap-2'>
            <FiFileText class='h-5 w-5 text-gray-400' />
            <h2 class='text-base font-semibold text-gray-900'>Invoices</h2>
          </div>
          <Show when={query.data?.invoices?.length > 0}>
            <button
              type='button'
              class='text-sm font-medium text-blue-600 transition-colors hover:text-blue-700'
            >
              View all
            </button>
          </Show>
        </div>
      </div>

      {/* Content */}
      <Show when={!query.isFetching} fallback={<InvoicesSkeleton />}>
        <Show when={query.data?.invoices?.length > 0} fallback={<EmptyState />}>
          <div class='divide-y divide-gray-100'>
            <For each={query.data?.invoices ?? []}>
              {invoice => (
                <div class='flex items-center justify-between px-6 py-4 transition-colors hover:bg-gray-50'>
                  <div class='flex items-center gap-4'>
                    <div class='flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100'>
                      <FiFileText class='h-5 w-5 text-gray-500' />
                    </div>
                    <div>
                      <p class='font-medium text-gray-900'>
                        {invoice.description || `Invoice #${invoice.number || invoice.id}`}
                      </p>
                      <p class='text-sm text-gray-500'>{formatDate(invoice.date)}</p>
                    </div>
                  </div>
                  <div class='flex items-center gap-4'>
                    <span class='text-sm font-semibold text-gray-900'>
                      {formatAmount(invoice.amount)}
                    </span>
                    <StatusBadge status={invoice.status || 'paid'} />
                    <Show when={invoice.pdfUrl || invoice.hostedInvoiceUrl}>
                      <button
                        type='button'
                        class='rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600'
                        onClick={() => handleDownload(invoice.id, invoice.pdfUrl)}
                        title='Download invoice'
                      >
                        <FiDownload class='h-4 w-4' />
                      </button>
                    </Show>
                    <Show when={invoice.hostedInvoiceUrl}>
                      <a
                        href={invoice.hostedInvoiceUrl}
                        target='_blank'
                        rel='noopener noreferrer'
                        class='rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600'
                        title='View invoice'
                      >
                        <FiExternalLink class='h-4 w-4' />
                      </a>
                    </Show>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  );
}
