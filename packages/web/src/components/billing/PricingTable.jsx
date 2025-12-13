/**
 * PricingTable Component
 * Displays subscription tiers with pricing and features
 */

import { createSignal, createResource, For, Show } from 'solid-js';
import { FiCheck } from 'solid-icons/fi';
import { getPlans, redirectToCheckout } from '@/api/billing.js';

export default function PricingTable(props) {
  const [plans] = createResource(getPlans);
  const [billingInterval, setBillingInterval] = createSignal('monthly');
  const [loadingTier, setLoadingTier] = createSignal(null);

  const currentTier = () => props.currentTier ?? 'free';

  const handleUpgrade = async tier => {
    if (tier === 'free' || tier === currentTier()) return;

    setLoadingTier(tier);
    try {
      await redirectToCheckout(tier, billingInterval());
    } catch (error) {
      console.error('Checkout error:', error);
      setLoadingTier(null);
    }
  };

  const getButtonText = tier => {
    if (tier === currentTier()) return 'Current Plan';
    if (tier === 'free') return 'Free';
    if (tier === 'enterprise') return 'Contact Sales';
    return 'Upgrade';
  };

  const isButtonDisabled = tier => {
    return tier === currentTier() || tier === 'free' || loadingTier() !== null;
  };

  return (
    <div class='py-6'>
      {/* Billing interval toggle */}
      <div class='flex justify-center mb-8'>
        <div class='bg-gray-100 p-1 rounded-lg inline-flex'>
          <button
            type='button'
            class={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
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
            class={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              billingInterval() === 'yearly' ?
                'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setBillingInterval('yearly')}
          >
            Yearly
            <span class='ml-1 text-xs text-green-600 font-semibold'>Save 20%</span>
          </button>
        </div>
      </div>

      {/* Plans grid */}
      <Show when={!plans.loading} fallback={<PricingTableSkeleton />}>
        <div class='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
          <For each={plans()?.plans ?? []}>
            {plan => (
              <div
                class={`relative rounded-xl border-2 p-6 flex flex-col ${
                  plan.tier === currentTier() ? 'border-blue-500 bg-blue-50/50'
                  : plan.tier === 'pro' ? 'border-blue-200 bg-white'
                  : 'border-gray-200 bg-white'
                }`}
              >
                {/* Popular badge */}
                <Show when={plan.tier === 'pro'}>
                  <div class='absolute -top-3 left-1/2 -translate-x-1/2'>
                    <span class='bg-blue-500 text-white text-xs font-semibold px-3 py-1 rounded-full'>
                      Most Popular
                    </span>
                  </div>
                </Show>

                {/* Current plan badge */}
                <Show when={plan.tier === currentTier()}>
                  <div class='absolute -top-3 left-1/2 -translate-x-1/2'>
                    <span class='bg-green-500 text-white text-xs font-semibold px-3 py-1 rounded-full'>
                      Current Plan
                    </span>
                  </div>
                </Show>

                {/* Plan header */}
                <div class='mb-4'>
                  <h3 class='text-lg font-semibold text-gray-900'>{plan.name}</h3>
                  <p class='text-sm text-gray-500 mt-1'>{plan.description}</p>
                </div>

                {/* Price */}
                <div class='mb-6'>
                  <Show
                    when={plan.price[billingInterval()] !== null}
                    fallback={<div class='text-2xl font-bold text-gray-900'>Custom</div>}
                  >
                    <div class='flex items-baseline'>
                      <span class='text-3xl font-bold text-gray-900'>
                        $
                        {billingInterval() === 'monthly' ?
                          plan.price.monthly
                        : Math.round(plan.price.yearly / 12)}
                      </span>
                      <span class='text-gray-500 ml-1'>/month</span>
                    </div>
                    <Show when={billingInterval() === 'yearly' && plan.price.yearly > 0}>
                      <p class='text-sm text-gray-500 mt-1'>${plan.price.yearly} billed annually</p>
                    </Show>
                  </Show>
                </div>

                {/* Features */}
                <ul class='space-y-3 mb-6 flex-1'>
                  <For each={plan.features}>
                    {feature => (
                      <li class='flex items-start'>
                        <FiCheck class='w-5 h-5 text-green-500 mr-2 shrink-0 mt-0.5' />
                        <span class='text-sm text-gray-600'>{feature}</span>
                      </li>
                    )}
                  </For>
                </ul>

                {/* CTA Button */}
                <button
                  type='button'
                  class={`w-full py-2.5 px-4 rounded-lg font-medium text-sm transition-colors ${
                    plan.tier === currentTier() ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                    : plan.tier === 'pro' ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : plan.tier === 'enterprise' ? 'bg-gray-900 text-white hover:bg-gray-800'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  onClick={() => handleUpgrade(plan.tier)}
                  disabled={isButtonDisabled(plan.tier)}
                >
                  <Show when={loadingTier() === plan.tier} fallback={getButtonText(plan.tier)}>
                    <span class='flex items-center justify-center'>
                      <svg class='animate-spin -ml-1 mr-2 h-4 w-4' fill='none' viewBox='0 0 24 24'>
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
      </Show>
    </div>
  );
}

function PricingTableSkeleton() {
  return (
    <div class='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
      <For each={[1, 2, 3, 4]}>
        {() => (
          <div class='rounded-xl border-2 border-gray-200 p-6 animate-pulse'>
            <div class='h-6 bg-gray-200 rounded w-24 mb-2' />
            <div class='h-4 bg-gray-200 rounded w-32 mb-6' />
            <div class='h-10 bg-gray-200 rounded w-28 mb-6' />
            <div class='space-y-3 mb-6'>
              <div class='h-4 bg-gray-200 rounded' />
              <div class='h-4 bg-gray-200 rounded' />
              <div class='h-4 bg-gray-200 rounded' />
            </div>
            <div class='h-10 bg-gray-200 rounded' />
          </div>
        )}
      </For>
    </div>
  );
}
