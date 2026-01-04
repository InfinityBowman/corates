/**
 * InvoicesList Component
 * Displays recent invoices with download functionality
 */

import { For, Show, createResource } from 'solid-js';
import { FiDownload, FiMail } from 'solid-icons/fi';
import { API_BASE } from '@config/api.js';
import { handleFetchError } from '@/lib/error-utils.js';

/**
 * Fetch invoices from API
 * @returns {Promise<object>} - The invoices
 */
async function fetchInvoices() {
  // TODO: Replace with actual invoices API endpoint when available
  // For now, return empty array as placeholder
  try {
    const response = await handleFetchError(
      fetch(`${API_BASE}/api/billing/invoices`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'GET',
      }),
      { showToast: false },
    );
    return response.json();
  } catch {
    // API endpoint doesn't exist yet, return empty array
    return { invoices: [] };
  }
}

function formatDate(timestamp) {
  if (!timestamp) return null;
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function InvoicesList() {
  const [invoices] = createResource(fetchInvoices);

  const handleDownload = async invoiceId => {
    // TODO: Implement invoice download when API is available
    console.log('Download invoice:', invoiceId);
  };

  return (
    <div>
      <h2 class='mb-4 text-xl font-semibold text-gray-900'>Recent invoices</h2>
      <div class='overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm'>
        <Show
          when={!invoices.loading && invoices()?.invoices?.length > 0}
          fallback={
            <div class='px-6 py-12 text-center'>
              <FiMail class='mx-auto h-12 w-12 text-gray-400' />
              <p class='mt-4 text-sm text-gray-500'>No invoices yet</p>
            </div>
          }
        >
          <div class='divide-y divide-gray-200'>
            <For each={invoices()?.invoices ?? []}>
              {invoice => (
                <div class='px-6 py-4 hover:bg-gray-50'>
                  <div class='flex items-center justify-between'>
                    <div class='flex-1'>
                      <p class='text-sm font-medium text-gray-900'>
                        {invoice.description || `Invoice ${invoice.id}`}
                      </p>
                      <p class='mt-1 text-xs text-gray-500'>
                        {formatDate(invoice.date)} • Invoice {invoice.id}
                      </p>
                    </div>
                    <div class='flex items-center space-x-4'>
                      <span class='text-sm font-semibold text-gray-900'>${invoice.amount}</span>
                      <span class='inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800'>
                        {invoice.status || 'paid'}
                      </span>
                      <button
                        type='button'
                        class='rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                        onClick={() => handleDownload(invoice.id)}
                        title='Download invoice'
                      >
                        <FiDownload class='h-4 w-4' />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>
          <div class='border-t border-gray-200 bg-gray-50 px-6 py-3'>
            <button type='button' class='text-sm font-medium text-blue-600 hover:text-blue-700'>
              View all invoices
            </button>
          </div>
        </Show>
      </div>
    </div>
  );
}
