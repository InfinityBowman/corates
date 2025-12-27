/**
 * SubscriptionCard Component
 * Displays current subscription status and details
 */

import { Show } from 'solid-js'
import {
  FiCreditCard,
  FiCalendar,
  FiAlertCircle,
  FiCheck,
} from 'solid-icons/fi'

export default function SubscriptionCard(props) {
  const subscription = () => props.subscription
  const tier = () => subscription()?.tier ?? 'free'
  const tierInfo = () =>
    subscription()?.tierInfo ?? { name: 'Free', description: '' }
  const status = () => subscription()?.status ?? 'active'
  const willCancel = () => subscription()?.cancelAtPeriodEnd ?? false
  const periodEndDate = () => {
    const end = subscription()?.currentPeriodEnd
    if (!end) return null
    return new Date(end).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const statusConfig = {
    active: { color: 'green', label: 'Active', icon: FiCheck },
    trialing: { color: 'blue', label: 'Trial', icon: FiCheck },
    past_due: { color: 'red', label: 'Past Due', icon: FiAlertCircle },
    canceled: { color: 'gray', label: 'Canceled', icon: FiAlertCircle },
    incomplete: { color: 'yellow', label: 'Incomplete', icon: FiAlertCircle },
  }

  const currentStatus = () => statusConfig[status()] ?? statusConfig.active

  return (
    <div class="overflow-hidden rounded-xl border border-gray-200 bg-white">
      {/* Header */}
      <div class="border-b border-gray-200 bg-gray-50 px-6 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <FiCreditCard class="h-5 w-5 text-gray-600" />
            <h2 class="text-lg font-medium text-gray-900">Current Plan</h2>
          </div>
          <span
            class={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-${currentStatus().color}-100 text-${currentStatus().color}-800`}
          >
            {currentStatus().label}
          </span>
        </div>
      </div>

      {/* Body */}
      <div class="p-6">
        <div class="flex items-start justify-between">
          <div>
            <h3 class="text-2xl font-bold text-gray-900">{tierInfo().name}</h3>
            <p class="mt-1 text-sm text-gray-500">{tierInfo().description}</p>
          </div>
          <Show when={tier() !== 'free'}>
            <div class="text-right">
              <Show when={periodEndDate()}>
                <div class="flex items-center text-sm text-gray-500">
                  <FiCalendar class="mr-1 h-4 w-4" />
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
          <div class="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
            <div class="flex items-center">
              <FiAlertCircle class="mr-2 h-5 w-5 text-red-600" />
              <div>
                <p class="text-sm font-medium text-red-800">Payment Failed</p>
                <p class="text-sm text-red-600">
                  Please update your payment method to continue your
                  subscription.
                </p>
              </div>
            </div>
          </div>
        </Show>

        {/* Warning for cancellation */}
        <Show when={willCancel() && status() === 'active'}>
          <div class="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
            <div class="flex items-center">
              <FiAlertCircle class="mr-2 h-5 w-5 text-yellow-500" />
              <div>
                <p class="text-sm font-medium text-yellow-800">
                  Subscription Ending
                </p>
                <p class="text-sm text-yellow-600">
                  Your subscription will end on {periodEndDate()}. You can
                  reactivate anytime.
                </p>
              </div>
            </div>
          </div>
        </Show>

        {/* Actions */}
        <div class="mt-6 flex flex-wrap gap-3">
          <Show when={tier() !== 'free'}>
            <button
              type="button"
              class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              onClick={() => props.onManage?.()}
              disabled={props.loading}
            >
              Manage Subscription
            </button>
          </Show>
          <Show when={tier() === 'free' || willCancel()}>
            <button
              type="button"
              class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              onClick={() => props.onUpgrade?.()}
              disabled={props.loading}
            >
              {willCancel() ? 'Reactivate' : 'Upgrade Plan'}
            </button>
          </Show>
        </div>
      </div>
    </div>
  )
}
