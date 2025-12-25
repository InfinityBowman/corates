/**
 * PricingTable Component
 * Displays subscription tiers with pricing and features
 */

import { createSignal, createResource, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { FiCheck } from 'solid-icons/fi';
import { getPlans } from '@/api/billing.js';

export default function PricingTable(props) {
  const [plans] = createResource(getPlans);
  const [billingInterval, setBillingInterval] = createSignal('monthly');
  const navigate = useNavigate();

  const currentTier = () => props.currentTier ?? 'free';

  const handleUpgrade = tier => {
    if (tier === 'free' || tier === currentTier() || tier === 'enterprise') return;

    navigate(`/billing/checkout?tier=${tier}&interval=${billingInterval()}`);
  };

  const getButtonText = tier => {
    if (tier === currentTier()) return 'Current Plan';
    if (tier === 'free') return 'Free';
    if (tier === 'enterprise') return 'Contact Sales';
    return 'Upgrade';
  };

  const isButtonDisabled = tier => {
    return tier === currentTier() || tier === 'free' || tier === 'enterprise';
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
            <span class='ml-1 text-xs font-semibold text-green-600'>Save 20%</span>
          </button>
        </div>
      </div>

      {/* Plans grid */}
      <Show when={!plans.loading} fallback={<PricingTableSkeleton />}>
        <div class='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4'>
          <For each={plans()?.plans ?? []}>
            {plan => (
              <div
                class={`relative flex flex-col rounded-xl border-2 p-6 ${
                  plan.tier === currentTier() ? 'border-blue-500 bg-blue-50/50'
                  : plan.tier === 'pro' ? 'border-blue-200 bg-white'
                  : 'border-gray-200 bg-white'
                }`}
              >
                {/* Popular badge */}
                <Show when={plan.tier === 'pro'}>
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
                      <span class='ml-1 text-gray-500'>/month</span>
                    </div>
                    <Show when={billingInterval() === 'yearly' && plan.price.yearly > 0}>
                      <p class='mt-1 text-sm text-gray-500'>${plan.price.yearly} billed annually</p>
                    </Show>
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
                  class={`w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                    plan.tier === currentTier() ? 'cursor-not-allowed bg-gray-100 text-gray-500'
                    : plan.tier === 'pro' ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : plan.tier === 'enterprise' ? 'bg-gray-900 text-white hover:bg-gray-800'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  onClick={() => handleUpgrade(plan.tier)}
                  disabled={isButtonDisabled(plan.tier)}
                >
                  {getButtonText(plan.tier)}
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
