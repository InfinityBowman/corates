/**
 * PricingTable Component
 * Premium pricing cards with hover effects and visual hierarchy
 */

import { createSignal, For, Show } from 'solid-js';
import { FiCheck, FiStar, FiZap } from 'solid-icons/fi';
import { showToast } from '@corates/ui';
import { redirectToCheckout, redirectToSingleProjectCheckout, startTrial } from '@/api/billing.js';
import { useSubscription } from '@/primitives/useSubscription.js';
import { getBillingPlanCatalog } from '@corates/shared/plans';

/**
 * PricingTable component
 * Displays subscription tiers with premium styling
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
  // const plans = () => adjust(defaultPlans(), 2, defaultPlans().plans.length - 1);

  // function adjust(arr, from, to) {
  //   const copy = [...arr.plans];
  //   const [item] = copy.splice(from, 1);
  //   copy.splice(to, 0, item);
  //   let trial = copy.splice(1, 1);
  //   return { ...arr, plans: copy };
  // }

  const formatUsd = amount =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    }).format(amount);

  // Calculate annual savings
  const getAnnualSavings = plan => {
    if (!plan.price || !plan.price.monthly || !plan.price.yearly) return null;
    const monthlyTotal = plan.price.monthly * 12;
    const savings = monthlyTotal - plan.price.yearly;
    return savings > 0 ? savings : null;
  };

  const handleAction = async plan => {
    if (!plan || plan.tier === currentTier()) return;

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
    if (plan.tier === currentTier()) return 'Current Plan';
    if (plan.cta === 'start_trial') return 'Start Free Trial';
    if (plan.cta === 'buy_single_project') return 'Buy Now';
    if (plan.cta === 'subscribe') return 'Get Started';
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
      <div class='mb-10 flex flex-col items-center gap-4'>
        <Show when={billingInterval() === 'yearly'}>
          <div class='-mt-13 flex items-center gap-2 rounded-full bg-green-50 px-4 py-2 text-sm font-medium text-green-700'>
            <FiStar class='h-4 w-4' />
            Save 2 months with annual billing
          </div>
        </Show>
        <div class='inline-flex rounded-xl bg-gray-100 p-1.5'>
          <button
            type='button'
            class={`rounded-lg px-5 py-2.5 text-sm font-semibold transition-all ${
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
            class={`rounded-lg px-5 py-2.5 text-sm font-semibold transition-all ${
              billingInterval() === 'yearly' ?
                'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setBillingInterval('yearly')}
          >
            Annual
          </button>
        </div>
      </div>

      {/* Plans grid */}
      <div class='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'>
        <For each={plans()?.plans ?? []}>
          {plan => {
            const isPopular = () => plan.isPopular;
            const isCurrent = () => plan.tier === currentTier();
            const savings = () => getAnnualSavings(plan);

            return (
              <div
                class={`relative flex flex-col rounded-2xl border-2 p-6 transition-all duration-300 ${
                  isCurrent() ? 'border-blue-500 bg-white shadow-lg shadow-blue-100'
                  : isPopular() ?
                    'border-blue-400 bg-white shadow-xl shadow-blue-100/50 hover:shadow-2xl hover:shadow-blue-200/50'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-lg'
                }`}
              >
                {/* Popular badge */}
                <Show when={isPopular() && !isCurrent()}>
                  <div class='absolute -top-4 left-1/2 -translate-x-1/2'>
                    <span class='inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow-lg'>
                      <FiZap class='h-3.5 w-3.5' />
                      Most Popular
                    </span>
                  </div>
                </Show>

                {/* Current plan badge */}
                <Show when={isCurrent()}>
                  <div class='absolute -top-4 left-1/2 -translate-x-1/2'>
                    <span class='inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow-lg'>
                      <FiCheck class='h-3.5 w-3.5' />
                      Current Plan
                    </span>
                  </div>
                </Show>

                {/* Plan header */}
                <div class='mb-4 pt-2'>
                  <h3 class='text-xl font-bold text-gray-900'>{plan.name}</h3>
                  <p class='mt-1 text-sm text-gray-500'>{plan.description}</p>
                </div>

                {/* Price */}
                <div class='mb-6'>
                  <Show
                    when={plan.oneTime}
                    fallback={
                      <Show
                        when={plan.price}
                        fallback={<div class='text-3xl font-bold text-gray-900'>Free</div>}
                      >
                        <Show
                          when={plan.price[billingInterval()] !== null}
                          fallback={<div class='text-3xl font-bold text-gray-900'>Custom</div>}
                        >
                          <div class='flex items-baseline gap-1'>
                            <span class='text-4xl font-bold text-gray-900'>
                              {billingInterval() === 'monthly' ?
                                formatUsd(plan.price.monthly)
                              : formatUsd(plan.price.yearly / 12)}
                            </span>
                            <span class='text-gray-500'>/month</span>
                          </div>
                          <Show when={billingInterval() === 'yearly' && plan.price.yearly > 0}>
                            <p class='mt-1 text-sm text-gray-500'>
                              {formatUsd(plan.price.yearly)} billed annually
                            </p>
                          </Show>
                          <Show when={billingInterval() === 'yearly' && savings()}>
                            <p class='mt-1 text-sm font-medium text-green-600'>
                              Save {formatUsd(savings())} per year
                            </p>
                          </Show>
                        </Show>
                      </Show>
                    }
                  >
                    <div class='flex items-baseline gap-1'>
                      <span class='text-4xl font-bold text-gray-900'>
                        {formatUsd(plan.oneTime.amount)}
                      </span>
                      <span class='text-gray-500'>one-time</span>
                    </div>
                    <p class='mt-1 text-sm text-gray-500'>
                      Valid for {plan.oneTime.durationMonths} months
                    </p>
                  </Show>
                </div>

                {/* CTA Button - hidden for unavailable plans */}
                <Show when={plan.cta !== 'none'}>
                  <button
                    type='button'
                    class={`mb-6 w-full rounded-xl px-4 py-3 text-sm font-semibold transition-all focus:ring-2 focus:ring-offset-2 focus:outline-none ${
                      isCurrent() ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                      : isPopular() ?
                        'bg-blue-600 text-white shadow-lg shadow-blue-200 hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-300 focus:ring-blue-500'
                      : 'bg-gray-900 text-white hover:bg-gray-800 focus:ring-gray-500'
                    }`}
                    onClick={() => handleAction(plan)}
                    disabled={isButtonDisabled(plan)}
                  >
                    <Show when={loadingTier() === plan.tier} fallback={getButtonText(plan)}>
                      <span class='flex items-center justify-center gap-2'>
                        <svg class='h-4 w-4 animate-spin' fill='none' viewBox='0 0 24 24'>
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
                </Show>

                {/* Features */}
                <div class='flex-1'>
                  <p class='mb-3 text-xs font-semibold tracking-wide text-gray-400 uppercase'>
                    What's included
                  </p>
                  <ul class='space-y-3'>
                    <For each={plan.features}>
                      {feature => (
                        <li class='flex items-start gap-3'>
                          <div class='mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100'>
                            <FiCheck class='h-3 w-3 text-green-600' />
                          </div>
                          <span class='text-sm text-gray-600'>{feature}</span>
                        </li>
                      )}
                    </For>
                  </ul>
                </div>
              </div>
            );
          }}
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
