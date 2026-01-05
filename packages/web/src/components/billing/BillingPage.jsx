/**
 * BillingPage Component
 * Settings page showing current plan and invoices
 */

import { Show, createSignal } from 'solid-js';
import { useSearchParams, A } from '@solidjs/router';
import { FiArrowLeft, FiCheckCircle, FiExternalLink } from 'solid-icons/fi';
import { useSubscription } from '@/primitives/useSubscription.js';
import { redirectToPortal } from '@/api/billing.js';
import InvoicesList from './InvoicesList.jsx';

/**
 * Billing Page component
 * Shows current plan and invoices
 * @returns {JSX.Element} - The BillingPage component
 */
export default function BillingPage() {
  const [searchParams] = useSearchParams();
  const { subscription, loading, refetch } = useSubscription();
  const [portalLoading, setPortalLoading] = createSignal(false);

  // Check for success/canceled query params from Stripe redirect
  const checkoutSuccess = () => searchParams.success === 'true';

  // Refetch subscription on successful checkout
  if (checkoutSuccess()) {
    refetch();
  }

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      await redirectToPortal();
    } catch (error) {
      const { handleError } = await import('@/lib/error-utils.js');
      await handleError(error, {
        toastTitle: 'Portal Error',
      });
      setPortalLoading(false);
    }
  };

  return (
    <div class='mx-auto max-w-6xl p-6'>
      {/* Header */}
      <div class='mb-6'>
        <A
          href='/settings'
          class='mb-4 inline-flex items-center text-sm text-gray-500 hover:text-gray-700'
        >
          <FiArrowLeft class='mr-1 h-4 w-4' />
          Back to Settings
        </A>
        <div class='flex items-center justify-between'>
          <div>
            <h1 class='text-3xl font-bold text-gray-900'>Billing</h1>
            <p class='mt-2 text-sm text-gray-600'>
              For questions about billing,{' '}
              <a href='#' class='font-medium text-blue-600 hover:text-blue-700'>
                contact us
              </a>
            </p>
          </div>
          <A
            href='/settings/billing/plans'
            class='inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700'
          >
            All plans
            <FiExternalLink class='ml-1 h-4 w-4' />
          </A>
        </div>
      </div>

      {/* Success/Cancel alerts */}
      <Show when={checkoutSuccess()}>
        <div class='mb-6 flex items-center rounded-lg border border-green-200 bg-green-50 p-4'>
          <FiCheckCircle class='mr-3 h-5 w-5 text-green-500' />
          <div>
            <p class='font-medium text-green-800'>Payment successful!</p>
            <p class='text-sm text-green-600'>Your subscription has been activated.</p>
          </div>
        </div>
      </Show>

      {/* Current Plan Card */}
      <div class='mb-8'>
        <Show when={!loading()} fallback={<SubscriptionSkeleton />}>
          <div class='rounded-lg border border-gray-200 bg-white p-6 shadow-sm'>
            <div class='flex items-center justify-between'>
              <div>
                <div class='mb-2 flex items-center space-x-3'>
                  <h2 class='text-xl font-semibold text-gray-900'>
                    {subscription()?.tierInfo?.name || 'Free'}
                  </h2>
                  <span class='inline-flex items-center rounded-full border border-blue-500 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700'>
                    Current
                  </span>
                </div>
                <p class='text-sm text-gray-600'>
                  {subscription()?.tierInfo?.description || 'Free for all users'}
                </p>
              </div>
              <div class='text-right'>
                <div class='text-sm text-gray-500'>Users</div>
                <div class='text-2xl font-semibold text-gray-900'>
                  {subscription()?.memberCount ?? 0}
                </div>
              </div>
            </div>
            <Show when={subscription()?.currentPeriodEnd}>
              {() => {
                const periodEnd = new Date(subscription().currentPeriodEnd * 1000);
                const formattedDate = periodEnd.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                });
                return (
                  <div class='mt-4 flex items-center text-sm text-gray-600'>
                    <span>Renews {formattedDate}</span>
                  </div>
                );
              }}
            </Show>
            <div class='mt-4 flex space-x-3'>
              <Show when={subscription()?.tier !== 'free'}>
                <button
                  type='button'
                  class='rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50'
                  onClick={handleManageSubscription}
                  disabled={portalLoading()}
                >
                  Manage Subscription
                </button>
              </Show>
              <A
                href='/settings/billing/plans'
                class='rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700'
              >
                Change Plan
              </A>
            </div>
          </div>
        </Show>
      </div>

      {/* Invoices */}
      <InvoicesList />
    </div>
  );
}

function SubscriptionSkeleton() {
  return (
    <div class='animate-pulse overflow-hidden rounded-xl border border-gray-200 bg-white'>
      <div class='border-b border-gray-200 bg-gray-50 px-6 py-4'>
        <div class='h-6 w-32 rounded bg-gray-200' />
      </div>
      <div class='p-6'>
        <div class='mb-2 h-8 w-24 rounded bg-gray-200' />
        <div class='mb-6 h-4 w-48 rounded bg-gray-200' />
        <div class='h-10 w-40 rounded bg-gray-200' />
      </div>
    </div>
  );
}
