/**
 * Subscription List component
 * Displays and manages subscriptions for an organization
 */

import { Show, For } from 'solid-js';
import { FiLoader, FiTrash2, FiEdit, FiCopy, FiCheck } from 'solid-icons/fi';
import { createSignal } from 'solid-js';
import { showToast } from '@corates/ui';

/**
 * Subscription List component for admin dashboard
 * Displays and manages subscriptions for an organization
 * @param {object} props - Component props
 * @param {Array<object>} [props.subscriptions] - Array of subscription objects
 * @param {string} [props.effectiveSubscriptionId] - The ID of the effective subscription
 * @param {boolean} [props.loading] - Whether an action is in progress
 * @param {boolean} [props.isLoading] - Whether the list is being loaded
 * @param {function(string): void} props.onCancel - Function to cancel a subscription by ID
 * @param {function(object): void} props.onEdit - Function to edit a subscription
 * @returns {JSX.Element} - The SubscriptionList component
 */
export default function SubscriptionList(props) {
  const subscriptions = () => props.subscriptions || [];
  const effectiveSubscriptionId = () => props.effectiveSubscriptionId;
  const loading = () => props.loading;
  const isLoading = () => props.isLoading;
  const [copiedId, setCopiedId] = createSignal(null);

  const formatDate = timestamp => {
    if (!timestamp) return '-';
    const date =
      timestamp instanceof Date ? timestamp
      : typeof timestamp === 'string' ? new Date(timestamp)
      : new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handleCopyId = async (id, type) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(`${type}-${id}`);
      showToast.success('Copied', `${type} ID copied to clipboard`);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (_error) {
      showToast.error('Error', 'Failed to copy to clipboard');
    }
  };

  const isEffective = subscription => {
    return effectiveSubscriptionId() && subscription.id === effectiveSubscriptionId();
  };

  return (
    <div class='rounded-lg border border-gray-200 bg-white'>
      <div class='border-b border-gray-200 px-6 py-4'>
        <h2 class='text-lg font-semibold text-gray-900'>Subscriptions</h2>
      </div>
      <Show
        when={!isLoading()}
        fallback={
          <div class='flex items-center justify-center py-12'>
            <FiLoader class='h-8 w-8 animate-spin text-blue-600' />
          </div>
        }
      >
        <div class='p-6'>
          <Show
            when={subscriptions().length > 0}
            fallback={<p class='text-sm text-gray-500'>No subscriptions</p>}
          >
            <div class='space-y-4'>
              <For each={subscriptions()}>
                {subscription => (
                  <div
                    class={`rounded-lg border p-4 ${
                      isEffective(subscription) ?
                        'border-blue-300 bg-blue-50'
                      : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div class='flex items-start justify-between'>
                      <div class='flex-1'>
                        <div class='flex items-center space-x-2'>
                          <p class='font-medium text-gray-900'>{subscription.plan}</p>
                          <span
                            class={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              (
                                subscription.status === 'active' ||
                                subscription.status === 'trialing'
                              ) ?
                                'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {subscription.status}
                          </span>
                          {isEffective(subscription) && (
                            <span class='inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800'>
                              Effective
                            </span>
                          )}
                        </div>
                        <div class='mt-2 grid grid-cols-1 gap-3 text-sm text-gray-500 md:grid-cols-2'>
                          <div class='space-y-1'>
                            <p>Period Start: {formatDate(subscription.periodStart)}</p>
                            <p>Period End: {formatDate(subscription.periodEnd)}</p>
                            {subscription.cancelAtPeriodEnd && (
                              <p class='text-orange-600'>Cancels at period end</p>
                            )}
                          </div>
                          <div class='space-y-1'>
                            <p>Created: {formatDate(subscription.createdAt)}</p>
                            {subscription.updatedAt && (
                              <p>Updated: {formatDate(subscription.updatedAt)}</p>
                            )}
                            {subscription.canceledAt && (
                              <p class='text-red-600'>
                                Canceled: {formatDate(subscription.canceledAt)}
                              </p>
                            )}
                            {subscription.endedAt && (
                              <p class='text-red-600'>Ended: {formatDate(subscription.endedAt)}</p>
                            )}
                          </div>
                        </div>
                        {/* Stripe IDs */}
                        {(subscription.stripeCustomerId || subscription.stripeSubscriptionId) && (
                          <div class='mt-3 flex flex-wrap gap-2'>
                            {subscription.stripeCustomerId && (
                              <div class='flex items-center space-x-1 rounded bg-gray-100 px-2 py-1'>
                                <span class='text-xs font-medium text-gray-600'>Customer:</span>
                                <code class='font-mono text-xs text-gray-800'>
                                  {subscription.stripeCustomerId.slice(0, 12)}...
                                </code>
                                <button
                                  onClick={() =>
                                    handleCopyId(subscription.stripeCustomerId, 'customer')
                                  }
                                  class='ml-1 text-gray-500 hover:text-gray-700'
                                  title='Copy customer ID'
                                >
                                  {copiedId() === `customer-${subscription.stripeCustomerId}` ?
                                    <FiCheck class='h-3 w-3 text-green-600' />
                                  : <FiCopy class='h-3 w-3' />}
                                </button>
                              </div>
                            )}
                            {subscription.stripeSubscriptionId && (
                              <div class='flex items-center space-x-1 rounded bg-gray-100 px-2 py-1'>
                                <span class='text-xs font-medium text-gray-600'>Subscription:</span>
                                <code class='font-mono text-xs text-gray-800'>
                                  {subscription.stripeSubscriptionId.slice(0, 12)}...
                                </code>
                                <button
                                  onClick={() =>
                                    handleCopyId(subscription.stripeSubscriptionId, 'subscription')
                                  }
                                  class='ml-1 text-gray-500 hover:text-gray-700'
                                  title='Copy subscription ID'
                                >
                                  {(
                                    copiedId() ===
                                    `subscription-${subscription.stripeSubscriptionId}`
                                  ) ?
                                    <FiCheck class='h-3 w-3 text-green-600' />
                                  : <FiCopy class='h-3 w-3' />}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div class='ml-4 flex space-x-2'>
                        <button
                          onClick={() => props.onEdit?.(subscription)}
                          disabled={loading()}
                          class='rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50'
                          title='Edit subscription'
                        >
                          <FiEdit class='h-4 w-4' />
                        </button>
                        <button
                          onClick={() => props.onCancel?.(subscription.id)}
                          disabled={loading()}
                          class='rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50'
                          title='Cancel subscription'
                        >
                          <FiTrash2 class='h-4 w-4' />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
