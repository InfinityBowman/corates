/**
 * SubscriptionCard Component
 * Displays current subscription status and details
 */

import { Show } from 'solid-js';
import { FiCreditCard, FiCalendar, FiAlertCircle, FiCheck } from 'solid-icons/fi';

export default function SubscriptionCard(props) {
  const subscription = () => props.subscription;
  const tier = () => subscription()?.tier ?? 'free';
  const tierInfo = () => subscription()?.tierInfo ?? { name: 'Free', description: '' };
  const status = () => subscription()?.status ?? 'active';
  const willCancel = () => subscription()?.cancelAtPeriodEnd ?? false;
  const periodEndDate = () => {
    const end = subscription()?.currentPeriodEnd;
    if (!end) return null;
    return new Date(end).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const statusConfig = {
    active: { color: 'green', label: 'Active', icon: FiCheck },
    trialing: { color: 'blue', label: 'Trial', icon: FiCheck },
    past_due: { color: 'red', label: 'Past Due', icon: FiAlertCircle },
    canceled: { color: 'gray', label: 'Canceled', icon: FiAlertCircle },
    incomplete: { color: 'yellow', label: 'Incomplete', icon: FiAlertCircle },
  };

  const currentStatus = () => statusConfig[status()] ?? statusConfig.active;

  return (
    <div class='bg-white rounded-xl border border-gray-200 overflow-hidden'>
      {/* Header */}
      <div class='px-6 py-4 border-b border-gray-200 bg-gray-50'>
        <div class='flex items-center justify-between'>
          <div class='flex items-center space-x-2'>
            <FiCreditCard class='w-5 h-5 text-gray-600' />
            <h2 class='text-lg font-medium text-gray-900'>Current Plan</h2>
          </div>
          <span
            class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${currentStatus().color}-100 text-${currentStatus().color}-800`}
          >
            {currentStatus().label}
          </span>
        </div>
      </div>

      {/* Body */}
      <div class='p-6'>
        <div class='flex items-start justify-between'>
          <div>
            <h3 class='text-2xl font-bold text-gray-900'>{tierInfo().name}</h3>
            <p class='text-sm text-gray-500 mt-1'>{tierInfo().description}</p>
          </div>
          <Show when={tier() !== 'free'}>
            <div class='text-right'>
              <Show when={periodEndDate()}>
                <div class='flex items-center text-sm text-gray-500'>
                  <FiCalendar class='w-4 h-4 mr-1' />
                  <span>
                    {willCancel() ? 'Expires' : 'Renews'} {periodEndDate()}
                  </span>
                </div>
              </Show>
            </div>
          </Show>
        </div>

        {/* Warning for past due */}
        <Show when={status() === 'past_due'}>
          <div class='mt-4 p-3 bg-red-50 border border-red-200 rounded-lg'>
            <div class='flex items-center'>
              <FiAlertCircle class='w-5 h-5 text-red-500 mr-2' />
              <div>
                <p class='text-sm font-medium text-red-800'>Payment Failed</p>
                <p class='text-sm text-red-600'>
                  Please update your payment method to continue your subscription.
                </p>
              </div>
            </div>
          </div>
        </Show>

        {/* Warning for cancellation */}
        <Show when={willCancel() && status() === 'active'}>
          <div class='mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg'>
            <div class='flex items-center'>
              <FiAlertCircle class='w-5 h-5 text-yellow-500 mr-2' />
              <div>
                <p class='text-sm font-medium text-yellow-800'>Subscription Ending</p>
                <p class='text-sm text-yellow-600'>
                  Your subscription will end on {periodEndDate()}. You can reactivate anytime.
                </p>
              </div>
            </div>
          </div>
        </Show>

        {/* Actions */}
        <div class='mt-6 flex flex-wrap gap-3'>
          <Show when={tier() !== 'free'}>
            <button
              type='button'
              class='px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors'
              onClick={() => props.onManage?.()}
              disabled={props.loading}
            >
              Manage Subscription
            </button>
          </Show>
          <Show when={tier() === 'free' || willCancel()}>
            <button
              type='button'
              class='px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors'
              onClick={() => props.onUpgrade?.()}
              disabled={props.loading}
            >
              {willCancel() ? 'Reactivate' : 'Upgrade Plan'}
            </button>
          </Show>
        </div>
      </div>
    </div>
  );
}
