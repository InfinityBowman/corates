/**
 * PricingTable Component
 * Displays subscription tiers with pricing and features
 */

import { createSignal, For, Show } from 'solid-js';
import { FiCheck } from 'solid-icons/fi';
import { showToast } from '@corates/ui';
import { redirectToCheckout, redirectToSingleProjectCheckout, startTrial } from '@/api/billing.js';
import { useSubscription } from '@/primitives/useSubscription.js';
import { getBillingPlanCatalog } from '@corates/shared/plans';

/**
 * PricingTable component
 * Displays subscription tiers with pricing and features
 * @param {*} props
 * @property {string} props.currentTier - The current tier
 * @returns {JSX.Element} - The PricingTable component
 */
export default function PricingTable(props) {
  const plans = () => getBillingPlanCatalog();
  const [billingInterval, setBillingInterval] = createSignal('monthly');
  const [loadingTier, setLoadingTier] = createSignal(null);

  const { refetch: refetchSubscription } = useSubscription();

  const currentTier = () => props.currentTier ?? 'free';

  const formatUsd = amount =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    }).format(amount);

  const handleAction = async plan => {
    if (!plan || plan.tier === currentTier()) return;

    // cta can be: start_trial | buy_single_project | subscribe | none
    setLoadingTier(plan.tier);
    try {
      if (plan.cta === 'start_trial') {
        await startTrial();
        showToast.success('Trial started', 'Your 14-day trial is now active.');
        await refetchSubscription();
        setLoadingTier(null);
        return;
      }

      if (plan.cta === 'buy_single_project') {
        await redirectToSingleProjectCheckout();
        return;
      }

      if (plan.cta === 'subscribe') {
        await redirectToCheckout(plan.tier, billingInterval());
        return;
      }
    } catch (error) {
      const { handleError } = await import('@/lib/error-utils.js');
      await handleError(error, {
        toastTitle: 'Checkout Error',
      });
      setLoadingTier(null);
    }
  };

  const getButtonText = plan => {
    if (plan.tier === currentTier()) return 'Current plan';
    if (plan.cta === 'start_trial') return 'Start 14-day trial';
    if (plan.cta === 'buy_single_project') return 'Buy Single Project';
    if (plan.cta === 'subscribe') return 'Choose plan';
    return 'Unavailable';
  };

  const isButtonDisabled = plan => {
    if (!plan) return true;
    if (plan.tier === currentTier()) return true;
    if (loadingTier() !== null) return true;
    if (plan.cta === 'none') return true;
    if (plan.cta === 'start_trial' && currentTier() !== 'free') return true;
    return false;
  };

  return (
    <div class='py-6'>
      {/* Billing interval toggle */}
      <div class='mb-8 flex justify-center'>
        <div class='inline-flex rounded-lg bg-gray-100 p-1'>
          <button
            type='button'
            class={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              billingInterval() === 'monthly' ?
                'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setBillingInterval('monthly')}
          >
            Monthly
          </button>
          <button
            type='button'
            class={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              billingInterval() === 'yearly' ?
                'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setBillingInterval('yearly')}
          >
            Yearly
            <span class='ml-1 text-xs font-semibold text-green-600'>2 months free</span>
          </button>
        </div>
      </div>

      {/* Plans grid */}
      <div class='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'>
        <For each={plans()?.plans ?? []}>
          {plan => (
            <div
              class={`relative flex flex-col rounded-xl border-2 p-6 ${
                plan.tier === currentTier() ? 'border-blue-500 bg-white'
                : plan.isPopular ? 'border-blue-200 bg-white'
                : 'border-gray-200 bg-white'
              }`}
            >
              {/* Popular badge */}
              <Show when={plan.isPopular}>
                <div class='absolute -top-3 left-1/2 -translate-x-1/2'>
                  <span class='rounded-full bg-blue-500 px-3 py-1 text-xs font-semibold text-white'>
                    Most Popular
                  </span>
                </div>
              </Show>

              {/* Current plan badge */}
              <Show when={plan.tier === currentTier()}>
                <div class='absolute -top-3 left-1/2 -translate-x-1/2'>
                  <span class='rounded-full bg-green-500 px-3 py-1 text-xs font-semibold text-white'>
                    Current Plan
                  </span>
                </div>
              </Show>

              {/* Plan header */}
              <div class='mb-4'>
                <h3 class='text-lg font-semibold text-gray-900'>{plan.name}</h3>
                <p class='mt-1 text-sm text-gray-500'>{plan.description}</p>
              </div>

              {/* Price */}
              <div class='mb-6'>
                <Show
                  when={plan.oneTime}
                  fallback={
                    <Show
                      when={plan.price}
                      fallback={<div class='text-2xl font-bold text-gray-900'>Included</div>}
                    >
                      <Show
                        when={plan.price[billingInterval()] !== null}
                        fallback={<div class='text-2xl font-bold text-gray-900'>Custom</div>}
                      >
                        <div class='flex items-baseline'>
                          <span class='text-3xl font-bold text-gray-900'>
                            {billingInterval() === 'monthly' ?
                              formatUsd(plan.price.monthly)
                            : formatUsd(plan.price.yearly / 12)}
                          </span>
                          <span class='ml-1 text-gray-500'>/month</span>
                        </div>
                        <Show when={billingInterval() === 'yearly' && plan.price.yearly > 0}>
                          <p class='mt-1 text-sm text-gray-500'>
                            {formatUsd(plan.price.yearly)} billed annually
                          </p>
                        </Show>
                      </Show>
                    </Show>
                  }
                >
                  <div class='text-3xl font-bold text-gray-900'>
                    {formatUsd(plan.oneTime.amount)}
                  </div>
                  <p class='mt-1 text-sm text-gray-500'>
                    One-time for {plan.oneTime.durationMonths} months
                  </p>
                </Show>
              </div>

              {/* Features */}
              <ul class='mb-6 flex-1 space-y-3'>
                <For each={plan.features}>
                  {feature => (
                    <li class='flex items-start'>
                      <FiCheck class='mt-0.5 mr-2 h-5 w-5 shrink-0 text-green-500' />
                      <span class='text-sm text-gray-600'>{feature}</span>
                    </li>
                  )}
                </For>
              </ul>

              {/* CTA Button */}
              <button
                type='button'
                class={`w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-colors focus:outline-none ${
                  plan.tier === currentTier() ? 'cursor-not-allowed bg-gray-100 text-gray-500'
                  : plan.isPopular ?
                    'bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-2 focus:ring-gray-500'
                }`}
                onClick={() => handleAction(plan)}
                disabled={isButtonDisabled(plan)}
              >
                <Show when={loadingTier() === plan.tier} fallback={getButtonText(plan)}>
                  <span class='flex items-center justify-center'>
                    <svg class='mr-2 -ml-1 h-4 w-4 animate-spin' fill='none' viewBox='0 0 24 24'>
                      <circle
                        class='opacity-25'
                        cx='12'
                        cy='12'
                        r='10'
                        stroke='currentColor'
                        stroke-width='4'
                      />
                      <path
                        class='opacity-75'
                        fill='currentColor'
                        d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                      />
                    </svg>
                    Processing...
                  </span>
                </Show>
              </button>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

function _PricingTableSkeleton() {
  return (
    <div class='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4'>
      <For each={[1, 2, 3, 4]}>
        {() => (
          <div class='animate-pulse rounded-xl border-2 border-gray-200 p-6'>
            <div class='mb-2 h-6 w-24 rounded bg-gray-200' />
            <div class='mb-6 h-4 w-32 rounded bg-gray-200' />
            <div class='mb-6 h-10 w-28 rounded bg-gray-200' />
            <div class='mb-6 space-y-3'>
              <div class='h-4 rounded bg-gray-200' />
              <div class='h-4 rounded bg-gray-200' />
              <div class='h-4 rounded bg-gray-200' />
            </div>
            <div class='h-10 rounded bg-gray-200' />
          </div>
        )}
      </For>
    </div>
  );
}
