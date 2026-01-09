/**
 * SubscriptionCard Component
 * Premium subscription status card with trial/status indicators
 */

import { Show, Switch, Match, For } from 'solid-js';
import { A } from '@solidjs/router';
import {
  FiCreditCard,
  FiCalendar,
  FiAlertCircle,
  FiClock,
  FiArrowRight,
  FiZap,
} from 'solid-icons/fi';
import { useMembers } from '@/primitives/useMembers.js';

/**
 * Status badge with appropriate styling
 */
function StatusBadge(props) {
  const statusStyles = {
    active: 'bg-green-50 text-green-700 border-green-200',
    trialing: 'bg-blue-50 text-blue-700 border-blue-200',
    past_due: 'bg-red-50 text-red-700 border-red-200',
    canceled: 'bg-gray-50 text-gray-700 border-gray-200',
    incomplete: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    unpaid: 'bg-red-50 text-red-700 border-red-200',
  };

  const statusLabels = {
    active: 'Active',
    trialing: 'Trial',
    past_due: 'Past Due',
    canceled: 'Canceled',
    incomplete: 'Incomplete',
    unpaid: 'Unpaid',
  };

  return (
    <span
      class={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[props.status] || statusStyles.active}`}
    >
      {statusLabels[props.status] || 'Active'}
    </span>
  );
}

/**
 * Calculate days remaining for trial or period
 */
function getDaysRemaining(endTimestamp) {
  if (!endTimestamp) return null;
  const end = new Date(endTimestamp * 1000);
  const now = new Date();
  const diff = end - now;
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Format timestamp to readable date
 */
function formatDate(timestamp) {
  if (!timestamp) return null;
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Subscription card component
 * @param {Object} props
 * @param {Object} props.subscription - Subscription data
 * @param {Function} props.onManage - Handler for manage subscription
 * @param {boolean} props.manageLoading - Loading state for manage button
 */
export default function SubscriptionCard(props) {
  const subscription = () => props.subscription || {};
  const tierInfo = () => subscription().tierInfo || { name: 'Free', description: 'Free tier' };
  const status = () => subscription().status || 'active';
  const isTrial = () => status() === 'trialing';
  const isFree = () => subscription().tier === 'free';
  const willCancel = () => subscription().cancelAtPeriodEnd;

  const daysRemaining = () => getDaysRemaining(subscription().currentPeriodEnd);
  const periodEndDate = () => formatDate(subscription().currentPeriodEnd);

  const { memberCount, members } = useMembers();

  return (
    <div class='overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm'>
      {/* Header with gradient accent */}
      <div class='relative bg-linear-to-r from-blue-600 to-blue-500 px-6 py-5'>
        <div class='flex items-start justify-between'>
          <div>
            <div class='flex items-center gap-3'>
              <h2 class='text-xl font-bold text-white'>{tierInfo().name}</h2>
              <StatusBadge status={status()} />
            </div>
          </div>
        </div>

        {/* Trial countdown */}
        <Show when={isTrial() && daysRemaining() !== null}>
          <div
            class={`mt-4 flex items-center gap-2 rounded-lg px-3 py-2 backdrop-blur-sm ${
              daysRemaining() <= 3 ? 'bg-amber-500/20' : 'bg-white/10'
            }`}
          >
            <FiClock
              class={`h-4 w-4 ${daysRemaining() <= 3 ? 'text-amber-200' : 'text-blue-200'}`}
            />
            <span class='text-sm font-medium text-white'>
              {daysRemaining()} days remaining in trial
              {daysRemaining() <= 3 && ' - upgrade soon!'}
            </span>
          </div>
        </Show>
      </div>

      {/* Content */}
      <div class='p-6'>
        {/* Alerts */}
        <Show when={status() === 'past_due'}>
          <div class='mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4'>
            <FiAlertCircle class='mt-0.5 h-5 w-5 shrink-0 text-red-500' />
            <div>
              <p class='font-medium text-red-800'>Payment failed</p>
              <p class='mt-1 text-sm text-red-600'>
                Please update your payment method to continue using premium features.
              </p>
            </div>
          </div>
        </Show>

        <Show when={status() === 'incomplete'}>
          <div class='mb-4 flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4'>
            <FiAlertCircle class='mt-0.5 h-5 w-5 shrink-0 text-yellow-500' />
            <div>
              <p class='font-medium text-yellow-800'>Payment required</p>
              <p class='mt-1 text-sm text-yellow-600'>
                Complete your payment to activate your subscription.
              </p>
            </div>
          </div>
        </Show>

        <Show when={status() === 'unpaid'}>
          <div class='mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4'>
            <FiAlertCircle class='mt-0.5 h-5 w-5 shrink-0 text-red-500' />
            <div>
              <p class='font-medium text-red-800'>Subscription unpaid</p>
              <p class='mt-1 text-sm text-red-600'>
                Your subscription is unpaid. Please update your payment method.
              </p>
            </div>
          </div>
        </Show>

        <Show when={willCancel()}>
          <div class='mb-4 flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4'>
            <FiAlertCircle class='mt-0.5 h-5 w-5 shrink-0 text-yellow-500' />
            <div>
              <p class='font-medium text-yellow-800'>Subscription ending</p>
              <p class='mt-1 text-sm text-yellow-600'>
                Your subscription will end on {periodEndDate()}. You'll be downgraded to the Free
                plan.
              </p>
            </div>
          </div>
        </Show>

        {/* Trial expiry warning - show when 3 days or less remaining */}
        <Show when={isTrial() && daysRemaining() !== null && daysRemaining() <= 3}>
          <div class='mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4'>
            <FiClock class='mt-0.5 h-5 w-5 shrink-0 text-amber-500' />
            <div>
              <p class='font-medium text-amber-800'>Trial ending soon</p>
              <p class='mt-1 text-sm text-amber-600'>
                Your trial ends in {daysRemaining()} day{daysRemaining() !== 1 ? 's' : ''}. Upgrade
                now to keep your projects and data.
              </p>
              <A
                href='/settings/plans'
                class='mt-2 inline-flex items-center gap-1 text-sm font-medium text-amber-700 hover:text-amber-800'
              >
                View upgrade options
                <FiArrowRight class='h-4 w-4' />
              </A>
            </div>
          </div>
        </Show>

        {/* Subscription details */}
        <Show when={!isFree()}>
          <div class='mb-6 space-y-3'>
            <Show when={subscription().currentPeriodEnd && !willCancel()}>
              <div class='flex items-center justify-between text-sm'>
                <span class='flex items-center gap-2 text-gray-500'>
                  <FiCalendar class='h-4 w-4' />
                  {isTrial() ? 'Trial ends' : 'Next billing date'}
                </span>
                <span class='font-medium text-gray-900'>{periodEndDate()}</span>
              </div>
            </Show>

            <Show when={memberCount() > 0}>
              <div class='flex items-center justify-between text-sm'>
                <span class='text-gray-500'>Team members</span>
                <span class='font-medium text-gray-900'>{memberCount()}</span>
              </div>
              <div class='flex flex-col gap-2'>
                <For each={members()}>
                  {member => <span class='text-gray-500'>{member.user?.name}</span>}
                </For>
              </div>
            </Show>
          </div>
        </Show>

        {/* Actions */}
        <div class='flex flex-wrap gap-3'>
          <Switch>
            <Match when={isFree()}>
              <A
                href='/settings/plans'
                class='inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md'
              >
                <FiZap class='h-4 w-4' />
                Upgrade Now
              </A>
            </Match>
            <Match when={!isFree()}>
              <button
                type='button'
                class='inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50'
                onClick={() => props.onManage?.()}
                disabled={props.manageLoading}
              >
                <Show
                  when={!props.manageLoading}
                  fallback={
                    <>
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
                      Loading...
                    </>
                  }
                >
                  <FiCreditCard class='h-4 w-4' />
                  Manage Billing
                </Show>
              </button>
              <A
                href='/settings/plans'
                class='inline-flex items-center gap-1 rounded-lg px-4 py-2.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50'
              >
                Change Plan
                <FiArrowRight class='h-4 w-4' />
              </A>
            </Match>
          </Switch>
        </div>
      </div>
    </div>
  );
}
