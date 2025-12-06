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
    <div class='max-w-4xl mx-auto p-6'>
      {/* Header */}
      <div class='mb-6'>
        <A
          href='/settings'
          class='inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4'
        >
          <FiArrowLeft class='w-4 h-4 mr-1' />
          Back to Settings
        </A>
        <div class='flex items-center space-x-3'>
          <FiCreditCard class='w-6 h-6 text-gray-600' />
          <h1 class='text-2xl font-bold text-gray-900'>Billing & Subscription</h1>
        </div>
      </div>

      {/* Success/Cancel alerts */}
      <Show when={checkoutSuccess()}>
        <div class='mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center'>
          <FiCheckCircle class='w-5 h-5 text-green-500 mr-3' />
          <div>
            <p class='font-medium text-green-800'>Payment successful!</p>
            <p class='text-sm text-green-600'>Your subscription has been activated.</p>
          </div>
        </div>
      </Show>

      <Show when={checkoutCanceled()}>
        <div class='mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center'>
          <FiXCircle class='w-5 h-5 text-yellow-500 mr-3' />
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
          <div class='flex items-center justify-between mb-4'>
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
      <div class='mt-8 bg-gray-50 rounded-lg p-6'>
        <h3 class='text-lg font-medium text-gray-900 mb-4'>Frequently Asked Questions</h3>
        <div class='space-y-4'>
          <div>
            <h4 class='text-sm font-medium text-gray-900'>How do I cancel my subscription?</h4>
            <p class='text-sm text-gray-600 mt-1'>
              Click "Manage Subscription" above to access the billing portal where you can cancel,
              update payment methods, or download invoices.
            </p>
          </div>
          <div>
            <h4 class='text-sm font-medium text-gray-900'>What happens when I upgrade?</h4>
            <p class='text-sm text-gray-600 mt-1'>
              Upgrades take effect immediately. You'll be charged the prorated difference for the
              current billing period.
            </p>
          </div>
          <div>
            <h4 class='text-sm font-medium text-gray-900'>Can I get a refund?</h4>
            <p class='text-sm text-gray-600 mt-1'>
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
    <div class='bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse'>
      <div class='px-6 py-4 border-b border-gray-200 bg-gray-50'>
        <div class='h-6 bg-gray-200 rounded w-32' />
      </div>
      <div class='p-6'>
        <div class='h-8 bg-gray-200 rounded w-24 mb-2' />
        <div class='h-4 bg-gray-200 rounded w-48 mb-6' />
        <div class='h-10 bg-gray-200 rounded w-40' />
      </div>
    </div>
  );
}
