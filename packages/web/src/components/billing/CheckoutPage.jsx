/**
 * CheckoutPage Component
 * Full-page checkout experience with Stripe Elements
 */

import { createResource, Show } from 'solid-js';
import { useSearchParams, A } from '@solidjs/router';
import { FiArrowLeft, FiCreditCard } from 'solid-icons/fi';
import { getPlans } from '@/api/billing.js';
import { CheckoutForm } from './checkout/index.js';

export default function CheckoutPage() {
  const [searchParams] = useSearchParams();
  const [plans] = createResource(getPlans);

  const tier = () => searchParams.tier ?? 'pro';
  const interval = () => searchParams.interval ?? 'monthly';

  const currentPlan = () => {
    const plansList = plans()?.plans ?? [];
    return plansList.find(p => p.tier === tier()) ?? null;
  };

  const planName = () => currentPlan()?.name ?? tier();
  const planPrice = () => {
    const plan = currentPlan();
    if (!plan) return null;
    return interval() === 'monthly' ? plan.price.monthly : plan.price.yearly;
  };

  const formatPrice = () => {
    const price = planPrice();
    if (price === null) return 'Custom';
    if (interval() === 'yearly') {
      return `$${price} per year ($${Math.round(price / 12)}/month)`;
    }
    return `$${price} per month`;
  };

  return (
    <div class='mx-auto max-w-4xl p-6'>
      {/* Header */}
      <div class='mb-6'>
        <A
          href='/billing'
          class='mb-4 inline-flex items-center text-sm text-gray-500 hover:text-gray-700'
        >
          <FiArrowLeft class='mr-1 h-4 w-4' />
          Back to Billing
        </A>
        <div class='flex items-center space-x-3'>
          <FiCreditCard class='h-6 w-6 text-gray-600' />
          <h1 class='text-2xl font-bold text-gray-900'>Complete Your Subscription</h1>
        </div>
      </div>

      <div class='grid gap-8 lg:grid-cols-3'>
        {/* Checkout Form - Takes 2 columns */}
        <div class='lg:col-span-2'>
          <div class='rounded-xl border border-gray-200 bg-white p-6'>
            <h2 class='mb-6 text-lg font-semibold text-gray-900'>Payment Information</h2>
            <Show when={!plans.loading && currentPlan()} fallback={<CheckoutSkeleton />}>
              <CheckoutForm tier={tier()} interval={interval()} />
            </Show>
          </div>
        </div>

        {/* Order Summary - Takes 1 column */}
        <div class='lg:col-span-1'>
          <div class='sticky top-6 rounded-xl border border-gray-200 bg-white p-6'>
            <h2 class='mb-4 text-lg font-semibold text-gray-900'>Order Summary</h2>

            <Show when={!plans.loading && currentPlan()} fallback={<SummarySkeleton />}>
              <div class='space-y-4'>
                <div class='border-b border-gray-200 pb-4'>
                  <div class='flex items-start justify-between'>
                    <div>
                      <p class='font-medium text-gray-900'>{planName()}</p>
                      <p class='text-sm text-gray-500'>
                        {interval() === 'monthly' ? 'Monthly billing' : 'Annual billing'}
                      </p>
                    </div>
                  </div>
                </div>

                <div class='space-y-2'>
                  <div class='flex justify-between text-sm'>
                    <span class='text-gray-600'>Plan</span>
                    <span class='font-medium text-gray-900'>{planName()}</span>
                  </div>
                  <div class='flex justify-between text-sm'>
                    <span class='text-gray-600'>Billing</span>
                    <span class='font-medium text-gray-900'>
                      {interval() === 'monthly' ? 'Monthly' : 'Yearly'}
                    </span>
                  </div>
                </div>

                <div class='border-t border-gray-200 pt-4'>
                  <div class='flex justify-between'>
                    <span class='text-base font-semibold text-gray-900'>Total</span>
                    <span class='text-base font-semibold text-gray-900'>{formatPrice()}</span>
                  </div>
                </div>

                {/* Features list */}
                <Show when={currentPlan()?.features}>
                  <div class='border-t border-gray-200 pt-4'>
                    <p class='mb-2 text-sm font-medium text-gray-900'>What's included:</p>
                    <ul class='space-y-1 text-sm text-gray-600'>
                      {currentPlan()
                        ?.features.slice(0, 5)
                        .map(feature => (
                          <li class='flex items-start'>
                            <span class='mr-2 text-green-500'>•</span>
                            <span>{feature}</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                </Show>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckoutSkeleton() {
  return (
    <div class='space-y-4'>
      <div class='h-48 animate-pulse rounded-lg bg-gray-200' />
      <div class='h-12 animate-pulse rounded-lg bg-gray-200' />
    </div>
  );
}

function SummarySkeleton() {
  return (
    <div class='space-y-4'>
      <div class='h-20 animate-pulse rounded bg-gray-200' />
      <div class='h-32 animate-pulse rounded bg-gray-200' />
    </div>
  );
}
