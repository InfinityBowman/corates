/**
 * BillingPage Component
 * Settings page for managing subscription and billing
 */

import { createSignal, Show } from 'solid-js';
import { useSearchParams } from '@solidjs/router';
import { FiCreditCard, FiArrowLeft, FiCheckCircle, FiXCircle } from 'solid-icons/fi';
import { A } from '@solidjs/router';
import { useSubscription } from '@/primitives/useSubscription.js';
import { redirectToPortal } from '@/api/billing.js';
import { SubscriptionCard, PricingTable } from '@/components/billing/index.js';

export default function BillingPage() {
  const [searchParams] = useSearchParams();
  const { subscription, loading, refetch, tier } = useSubscription();
  const [portalLoading, setPortalLoading] = createSignal(false);
  const [showPricing, setShowPricing] = createSignal(false);

  // Check for success/canceled query params from Stripe redirect
  const checkoutSuccess = () => searchParams.success === 'true';
  const checkoutCanceled = () => searchParams.canceled === 'true';

  // Refetch subscription on successful checkout
  if (checkoutSuccess()) {
    refetch();
  }

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      await redirectToPortal();
    } catch (error) {
      console.error('Portal error:', error);
      setPortalLoading(false);
    }
  };

  const handleUpgrade = () => {
    setShowPricing(true);
  };

  return (
    <div class='mx-auto max-w-4xl p-6'>
      {/* Header */}
      <div class='mb-6'>
        <A
          href='/settings'
          class='mb-4 inline-flex items-center text-sm text-gray-500 hover:text-gray-700'
        >
          <FiArrowLeft class='mr-1 h-4 w-4' />
          Back to Settings
        </A>
        <div class='flex items-center space-x-3'>
          <FiCreditCard class='h-6 w-6 text-gray-600' />
          <h1 class='text-2xl font-bold text-gray-900'>Billing & Subscription</h1>
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

      <Show when={checkoutCanceled()}>
        <div class='mb-6 flex items-center rounded-lg border border-yellow-200 bg-yellow-50 p-4'>
          <FiXCircle class='mr-3 h-5 w-5 text-yellow-500' />
          <div>
            <p class='font-medium text-yellow-800'>Checkout canceled</p>
            <p class='text-sm text-yellow-600'>No changes were made to your subscription.</p>
          </div>
        </div>
      </Show>

      {/* Current subscription */}
      <Show when={!loading()} fallback={<SubscriptionSkeleton />}>
        <SubscriptionCard
          subscription={subscription()}
          onManage={handleManageSubscription}
          onUpgrade={handleUpgrade}
          loading={portalLoading()}
        />
      </Show>

      {/* Pricing table */}
      <Show when={showPricing() || tier() === 'free'}>
        <div class='mt-8'>
          <div class='mb-4 flex items-center justify-between'>
            <h2 class='text-xl font-semibold text-gray-900'>
              {tier() === 'free' ? 'Choose a Plan' : 'Change Plan'}
            </h2>
            <Show when={showPricing() && tier() !== 'free'}>
              <button
                type='button'
                class='text-sm text-gray-500 hover:text-gray-700'
                onClick={() => setShowPricing(false)}
              >
                Hide plans
              </button>
            </Show>
          </div>
          <PricingTable currentTier={tier()} />
        </div>
      </Show>

      {/* FAQ or Help section */}
      <div class='mt-8 rounded-lg bg-gray-50 p-6'>
        <h3 class='mb-4 text-lg font-medium text-gray-900'>Frequently Asked Questions</h3>
        <div class='space-y-4'>
          <div>
            <h4 class='text-sm font-medium text-gray-900'>How do I cancel my subscription?</h4>
            <p class='mt-1 text-sm text-gray-600'>
              Click "Manage Subscription" above to access the billing portal where you can cancel,
              update payment methods, or download invoices.
            </p>
          </div>
          <div>
            <h4 class='text-sm font-medium text-gray-900'>What happens when I upgrade?</h4>
            <p class='mt-1 text-sm text-gray-600'>
              Upgrades take effect immediately. You'll be charged the prorated difference for the
              current billing period.
            </p>
          </div>
          <div>
            <h4 class='text-sm font-medium text-gray-900'>Can I get a refund?</h4>
            <p class='mt-1 text-sm text-gray-600'>
              We offer a 14-day money-back guarantee. Contact support for refund requests.
            </p>
          </div>
        </div>
      </div>
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
