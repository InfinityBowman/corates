/**
 * Stripe Tools Page for admin dashboard
 * Provides customer lookup, portal link generation, and invoice viewing
 */

import { createSignal, Show, For } from 'solid-js';
import { A } from '@solidjs/router';
import {
  FiSearch,
  FiLoader,
  FiAlertCircle,
  FiExternalLink,
  FiUser,
  FiHome,
  FiCreditCard,
  FiFileText,
  FiDollarSign,
  FiCopy,
  FiCheckCircle,
  FiXCircle,
  FiClock,
  FiRefreshCw,
} from 'solid-icons/fi';
import { isAdminChecked, isAdmin } from '@/stores/adminStore.js';
import { apiFetch } from '@/lib/apiFetch.js';
import { showToast } from '@corates/ui';
import { handleError } from '@/lib/error-utils.js';

export default function StripeToolsPage() {
  // Search state
  const [searchType, setSearchType] = createSignal('email');
  const [searchInput, setSearchInput] = createSignal('');
  const [searching, setSearching] = createSignal(false);
  const [customerData, setCustomerData] = createSignal(null);
  const [searchError, setSearchError] = createSignal(null);

  // Additional data loading states
  const [loadingInvoices, setLoadingInvoices] = createSignal(false);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = createSignal(false);
  const [loadingSubscriptions, setLoadingSubscriptions] = createSignal(false);
  const [invoices, setInvoices] = createSignal(null);
  const [paymentMethods, setPaymentMethods] = createSignal(null);
  const [subscriptions, setSubscriptions] = createSignal(null);

  // Portal link state
  const [generatingPortal, setGeneratingPortal] = createSignal(false);
  const [portalUrl, setPortalUrl] = createSignal(null);

  // Copy state
  const [copiedId, setCopiedId] = createSignal(null);

  const formatDate = timestamp => {
    if (!timestamp) return '-';
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount, currency = 'usd') => {
    if (amount === null || amount === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

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

  const handleSearch = async e => {
    e.preventDefault();
    if (!searchInput().trim()) return;

    setSearching(true);
    setSearchError(null);
    setCustomerData(null);
    setInvoices(null);
    setPaymentMethods(null);
    setSubscriptions(null);
    setPortalUrl(null);

    try {
      const params = new URLSearchParams();
      if (searchType() === 'email') {
        params.set('email', searchInput().trim());
      } else {
        params.set('customerId', searchInput().trim());
      }

      const data = await apiFetch.get(`/api/admin/stripe/customer?${params}`, {
        toastMessage: false,
      });
      setCustomerData(data);

      if (!data.found) {
        setSearchError(data.message);
      }
    } catch (error) {
      await handleError(error, { toastTitle: 'Search failed' });
      setSearchError(error.message || 'Failed to search');
    } finally {
      setSearching(false);
    }
  };

  const loadInvoices = async () => {
    if (!customerData()?.customer?.id) return;

    setLoadingInvoices(true);
    try {
      const data = await apiFetch.get(
        `/api/admin/stripe/customer/${customerData().customer.id}/invoices`,
        { toastMessage: false },
      );
      setInvoices(data.invoices);
    } catch (error) {
      await handleError(error, { toastTitle: 'Failed to load invoices' });
    } finally {
      setLoadingInvoices(false);
    }
  };

  const loadPaymentMethods = async () => {
    if (!customerData()?.customer?.id) return;

    setLoadingPaymentMethods(true);
    try {
      const data = await apiFetch.get(
        `/api/admin/stripe/customer/${customerData().customer.id}/payment-methods`,
        { toastMessage: false },
      );
      setPaymentMethods(data.paymentMethods);
    } catch (error) {
      await handleError(error, { toastTitle: 'Failed to load payment methods' });
    } finally {
      setLoadingPaymentMethods(false);
    }
  };

  const loadSubscriptions = async () => {
    if (!customerData()?.customer?.id) return;

    setLoadingSubscriptions(true);
    try {
      const data = await apiFetch.get(
        `/api/admin/stripe/customer/${customerData().customer.id}/subscriptions`,
        { toastMessage: false },
      );
      setSubscriptions(data.subscriptions);
    } catch (error) {
      await handleError(error, { toastTitle: 'Failed to load subscriptions' });
    } finally {
      setLoadingSubscriptions(false);
    }
  };

  const generatePortalLink = async () => {
    if (!customerData()?.customer?.id) return;

    setGeneratingPortal(true);
    try {
      const data = await apiFetch.post(
        '/api/admin/stripe/portal-link',
        { customerId: customerData().customer.id },
        { toastMessage: false },
      );
      setPortalUrl(data.url);
      showToast.success('Success', 'Portal link generated');
    } catch (error) {
      await handleError(error, { toastTitle: 'Failed to generate portal link' });
    } finally {
      setGeneratingPortal(false);
    }
  };

  const getStatusColor = status => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      trialing: 'bg-blue-100 text-blue-800',
      past_due: 'bg-yellow-100 text-yellow-800',
      canceled: 'bg-gray-100 text-gray-800',
      unpaid: 'bg-red-100 text-red-800',
      incomplete: 'bg-orange-100 text-orange-800',
      incomplete_expired: 'bg-red-100 text-red-800',
      paused: 'bg-gray-100 text-gray-800',
      paid: 'bg-green-100 text-green-800',
      open: 'bg-blue-100 text-blue-800',
      draft: 'bg-gray-100 text-gray-800',
      void: 'bg-gray-100 text-gray-800',
      uncollectible: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

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
        <div class='mb-6'>
          <h1 class='text-2xl font-bold text-gray-900'>Stripe Tools</h1>
          <p class='mt-1 text-sm text-gray-500'>
            Look up customers, view invoices, and manage billing
          </p>
        </div>

        {/* Search Section */}
        <div class='mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm'>
          <h2 class='mb-4 text-lg font-semibold text-gray-900'>Customer Lookup</h2>
          <form onSubmit={handleSearch} class='flex flex-col gap-4 sm:flex-row'>
            <select
              value={searchType()}
              onChange={e => setSearchType(e.target.value)}
              class='rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none'
            >
              <option value='email'>Search by Email</option>
              <option value='customerId'>Search by Customer ID</option>
            </select>
            <div class='relative flex-1'>
              <FiSearch class='pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400' />
              <input
                type='text'
                value={searchInput()}
                onInput={e => setSearchInput(e.target.value)}
                placeholder={
                  searchType() === 'email' ? 'customer@example.com' : 'cus_xxxxxxxxxxxxx'
                }
                class='w-full rounded-lg border border-gray-300 py-2 pr-4 pl-10 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none'
              />
            </div>
            <button
              type='submit'
              disabled={searching() || !searchInput().trim()}
              class='inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50'
            >
              {searching() ?
                <FiLoader class='mr-2 h-4 w-4 animate-spin' />
              : <FiSearch class='mr-2 h-4 w-4' />}
              Search
            </button>
          </form>

          {/* Search Error */}
          <Show when={searchError()}>
            <div class='mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4'>
              <p class='text-sm text-yellow-700'>{searchError()}</p>
            </div>
          </Show>
        </div>

        {/* Customer Results */}
        <Show when={customerData()?.found}>
          {/* Customer Info Card */}
          <div class='mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm'>
            <div class='mb-4 flex items-start justify-between'>
              <h2 class='text-lg font-semibold text-gray-900'>Customer Details</h2>
              <a
                href={customerData().stripeDashboardUrl}
                target='_blank'
                rel='noopener noreferrer'
                class='inline-flex items-center text-sm text-blue-600 hover:text-blue-700'
              >
                View in Stripe
                <FiExternalLink class='ml-1 h-4 w-4' />
              </a>
            </div>

            <dl class='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
              <div>
                <dt class='text-sm font-medium text-gray-500'>Customer ID</dt>
                <dd class='mt-1 flex items-center text-sm text-gray-900'>
                  <span class='font-mono'>{customerData().customer.id}</span>
                  <button
                    onClick={() => handleCopy(customerData().customer.id, 'Customer ID')}
                    class='ml-2 text-gray-400 hover:text-gray-600'
                  >
                    <Show
                      when={copiedId() === `Customer ID-${customerData().customer.id}`}
                      fallback={<FiCopy class='h-4 w-4' />}
                    >
                      <FiCheckCircle class='h-4 w-4 text-green-500' />
                    </Show>
                  </button>
                </dd>
              </div>
              <div>
                <dt class='text-sm font-medium text-gray-500'>Email</dt>
                <dd class='mt-1 text-sm text-gray-900'>{customerData().customer.email || '-'}</dd>
              </div>
              <div>
                <dt class='text-sm font-medium text-gray-500'>Name</dt>
                <dd class='mt-1 text-sm text-gray-900'>{customerData().customer.name || '-'}</dd>
              </div>
              <div>
                <dt class='text-sm font-medium text-gray-500'>Created</dt>
                <dd class='mt-1 text-sm text-gray-900'>
                  {formatDate(customerData().customer.created)}
                </dd>
              </div>
              <div>
                <dt class='text-sm font-medium text-gray-500'>Balance</dt>
                <dd class='mt-1 text-sm text-gray-900'>
                  {formatCurrency(
                    customerData().customer.balance,
                    customerData().customer.currency,
                  )}
                </dd>
              </div>
              <div>
                <dt class='text-sm font-medium text-gray-500'>Delinquent</dt>
                <dd class='mt-1'>
                  <span
                    class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      customerData().customer.delinquent ?
                        'bg-red-100 text-red-800'
                      : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {customerData().customer.delinquent ? 'Yes' : 'No'}
                  </span>
                </dd>
              </div>
              <div>
                <dt class='text-sm font-medium text-gray-500'>Mode</dt>
                <dd class='mt-1'>
                  <span
                    class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      customerData().customer.livemode ?
                        'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {customerData().customer.livemode ? 'Live' : 'Test'}
                  </span>
                </dd>
              </div>
            </dl>

            {/* Linked Resources */}
            <div class='mt-6 border-t border-gray-200 pt-4'>
              <h3 class='mb-3 text-sm font-medium text-gray-900'>Linked Resources</h3>
              <div class='flex flex-wrap gap-4'>
                <Show
                  when={customerData().linkedUser}
                  fallback={
                    <span class='inline-flex items-center text-sm text-gray-500'>
                      <FiUser class='mr-1 h-4 w-4' />
                      No linked user
                    </span>
                  }
                >
                  <A
                    href={`/admin/users/${customerData().linkedUser.id}`}
                    class='inline-flex items-center text-sm text-blue-600 hover:text-blue-700'
                  >
                    <FiUser class='mr-1 h-4 w-4' />
                    {customerData().linkedUser.displayName ||
                      customerData().linkedUser.name ||
                      customerData().linkedUser.email}
                  </A>
                </Show>
                <Show
                  when={customerData().linkedOrg}
                  fallback={
                    <span class='inline-flex items-center text-sm text-gray-500'>
                      <FiHome class='mr-1 h-4 w-4' />
                      No linked organization
                    </span>
                  }
                >
                  <A
                    href={`/admin/orgs/${customerData().linkedOrg.id}`}
                    class='inline-flex items-center text-sm text-blue-600 hover:text-blue-700'
                  >
                    <FiHome class='mr-1 h-4 w-4' />
                    {customerData().linkedOrg.name}
                  </A>
                </Show>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div class='mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm'>
            <h2 class='mb-4 text-lg font-semibold text-gray-900'>Quick Actions</h2>
            <div class='flex flex-wrap gap-3'>
              <button
                onClick={generatePortalLink}
                disabled={generatingPortal()}
                class='inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50'
              >
                {generatingPortal() ?
                  <FiLoader class='mr-2 h-4 w-4 animate-spin' />
                : <FiExternalLink class='mr-2 h-4 w-4' />}
                Generate Portal Link
              </button>
              <button
                onClick={loadInvoices}
                disabled={loadingInvoices()}
                class='inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50'
              >
                {loadingInvoices() ?
                  <FiLoader class='mr-2 h-4 w-4 animate-spin' />
                : <FiFileText class='mr-2 h-4 w-4' />}
                Load Invoices
              </button>
              <button
                onClick={loadPaymentMethods}
                disabled={loadingPaymentMethods()}
                class='inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50'
              >
                {loadingPaymentMethods() ?
                  <FiLoader class='mr-2 h-4 w-4 animate-spin' />
                : <FiCreditCard class='mr-2 h-4 w-4' />}
                Load Payment Methods
              </button>
              <button
                onClick={loadSubscriptions}
                disabled={loadingSubscriptions()}
                class='inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50'
              >
                {loadingSubscriptions() ?
                  <FiLoader class='mr-2 h-4 w-4 animate-spin' />
                : <FiDollarSign class='mr-2 h-4 w-4' />}
                Load Subscriptions
              </button>
            </div>

            {/* Portal Link Result */}
            <Show when={portalUrl()}>
              <div class='mt-4 rounded-lg border border-green-200 bg-green-50 p-4'>
                <p class='mb-2 text-sm font-medium text-green-800'>Portal Link Generated</p>
                <div class='flex items-center gap-2'>
                  <input
                    type='text'
                    value={portalUrl()}
                    readOnly
                    class='flex-1 rounded border border-green-300 bg-white px-3 py-1 text-sm'
                  />
                  <button
                    onClick={() => handleCopy(portalUrl(), 'Portal URL')}
                    class='rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700'
                  >
                    Copy
                  </button>
                  <a
                    href={portalUrl()}
                    target='_blank'
                    rel='noopener noreferrer'
                    class='rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700'
                  >
                    Open
                  </a>
                </div>
                <p class='mt-2 text-xs text-green-600'>Link expires in 5 minutes</p>
              </div>
            </Show>
          </div>

          {/* Subscriptions Section */}
          <Show when={subscriptions()}>
            <div class='mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm'>
              <h2 class='mb-4 flex items-center text-lg font-semibold text-gray-900'>
                <FiDollarSign class='mr-2 h-5 w-5' />
                Subscriptions ({subscriptions().length})
              </h2>
              <Show
                when={subscriptions().length > 0}
                fallback={<p class='text-sm text-gray-500'>No subscriptions found</p>}
              >
                <div class='space-y-4'>
                  <For each={subscriptions()}>
                    {sub => (
                      <div class='rounded-lg border border-gray-100 bg-gray-50 p-4'>
                        <div class='flex items-start justify-between'>
                          <div>
                            <p class='font-mono text-sm text-gray-900'>{sub.id}</p>
                            <span
                              class={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(sub.status)}`}
                            >
                              {sub.status}
                            </span>
                          </div>
                          <a
                            href={`https://dashboard.stripe.com/subscriptions/${sub.id}`}
                            target='_blank'
                            rel='noopener noreferrer'
                            class='text-blue-600 hover:text-blue-700'
                          >
                            <FiExternalLink class='h-4 w-4' />
                          </a>
                        </div>
                        <div class='mt-3 grid grid-cols-2 gap-2 text-sm'>
                          <div>
                            <span class='text-gray-500'>Period:</span>{' '}
                            {formatDate(sub.currentPeriodStart)} -{' '}
                            {formatDate(sub.currentPeriodEnd)}
                          </div>
                          <Show when={sub.cancelAtPeriodEnd}>
                            <div class='text-red-600'>Cancels at period end</div>
                          </Show>
                          <Show when={sub.trialEnd && sub.status === 'trialing'}>
                            <div>
                              <span class='text-gray-500'>Trial ends:</span>{' '}
                              {formatDate(sub.trialEnd)}
                            </div>
                          </Show>
                        </div>
                        <Show when={sub.items?.length > 0}>
                          <div class='mt-2 text-sm text-gray-600'>
                            <For each={sub.items}>
                              {item => (
                                <span class='mr-2'>
                                  {formatCurrency(item.unitAmount, sub.currency)}/{item.interval}
                                </span>
                              )}
                            </For>
                          </div>
                        </Show>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </Show>

          {/* Invoices Section */}
          <Show when={invoices()}>
            <div class='mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm'>
              <h2 class='mb-4 flex items-center text-lg font-semibold text-gray-900'>
                <FiFileText class='mr-2 h-5 w-5' />
                Recent Invoices ({invoices().length})
              </h2>
              <Show
                when={invoices().length > 0}
                fallback={<p class='text-sm text-gray-500'>No invoices found</p>}
              >
                <div class='overflow-x-auto'>
                  <table class='w-full'>
                    <thead>
                      <tr class='border-b border-gray-200 bg-gray-50'>
                        <th class='px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase'>
                          Invoice
                        </th>
                        <th class='px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase'>
                          Status
                        </th>
                        <th class='px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase'>
                          Amount
                        </th>
                        <th class='px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase'>
                          Created
                        </th>
                        <th class='px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase'>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody class='divide-y divide-gray-200'>
                      <For each={invoices()}>
                        {invoice => (
                          <tr class='hover:bg-gray-50'>
                            <td class='px-4 py-3'>
                              <span class='font-mono text-sm'>{invoice.number || invoice.id}</span>
                            </td>
                            <td class='px-4 py-3'>
                              <span
                                class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(invoice.status)}`}
                              >
                                {invoice.status}
                              </span>
                            </td>
                            <td class='px-4 py-3 text-right text-sm'>
                              {formatCurrency(invoice.total, invoice.currency)}
                            </td>
                            <td class='px-4 py-3 text-sm text-gray-500'>
                              {formatDate(invoice.created)}
                            </td>
                            <td class='px-4 py-3 text-right'>
                              <div class='flex justify-end gap-2'>
                                <Show when={invoice.hostedInvoiceUrl}>
                                  <a
                                    href={invoice.hostedInvoiceUrl}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    class='text-blue-600 hover:text-blue-700'
                                    title='View Invoice'
                                  >
                                    <FiExternalLink class='h-4 w-4' />
                                  </a>
                                </Show>
                                <Show when={invoice.invoicePdf}>
                                  <a
                                    href={invoice.invoicePdf}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    class='text-gray-600 hover:text-gray-700'
                                    title='Download PDF'
                                  >
                                    <FiFileText class='h-4 w-4' />
                                  </a>
                                </Show>
                              </div>
                            </td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
              </Show>
            </div>
          </Show>

          {/* Payment Methods Section */}
          <Show when={paymentMethods()}>
            <div class='mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm'>
              <h2 class='mb-4 flex items-center text-lg font-semibold text-gray-900'>
                <FiCreditCard class='mr-2 h-5 w-5' />
                Payment Methods ({paymentMethods().length})
              </h2>
              <Show
                when={paymentMethods().length > 0}
                fallback={<p class='text-sm text-gray-500'>No payment methods found</p>}
              >
                <div class='space-y-3'>
                  <For each={paymentMethods()}>
                    {pm => (
                      <div class='flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-4'>
                        <div class='flex items-center space-x-3'>
                          <FiCreditCard class='h-6 w-6 text-gray-400' />
                          <div>
                            <p class='text-sm font-medium text-gray-900 capitalize'>
                              {pm.card?.brand} **** {pm.card?.last4}
                            </p>
                            <p class='text-xs text-gray-500'>
                              Expires {pm.card?.expMonth}/{pm.card?.expYear}
                            </p>
                          </div>
                        </div>
                        <span class='text-xs text-gray-500 capitalize'>{pm.card?.funding}</span>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </Show>
        </Show>
      </Show>
    </Show>
  );
}
