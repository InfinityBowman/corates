/**
 * Subscription List component
 * Displays and manages subscriptions for an organization
 */

import { Show, For } from 'solid-js';
import { FiLoader, FiTrash2 } from 'solid-icons/fi';

export default function SubscriptionList(props) {
  const subscriptions = () => props.subscriptions || [];
  const loading = () => props.loading;
  const isLoading = () => props.isLoading;
  const onCancel = () => props.onCancel;

  const formatDate = timestamp => {
    if (!timestamp) return '-';
    const date = timestamp instanceof Date ?
        timestamp
      : typeof timestamp === 'string' ?
        new Date(timestamp)
      : new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
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
                  <div class='rounded-lg border border-gray-200 p-4'>
                    <div class='flex items-start justify-between'>
                      <div class='flex-1'>
                        <div class='flex items-center space-x-2'>
                          <p class='font-medium text-gray-900'>{subscription.plan}</p>
                          <span
                            class={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              subscription.status === 'active' || subscription.status === 'trialing' ?
                                'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {subscription.status}
                          </span>
                        </div>
                        <div class='mt-2 grid grid-cols-2 gap-4 text-sm text-gray-500'>
                          <div>
                            <p>Period Start: {formatDate(subscription.periodStart)}</p>
                            <p>Period End: {formatDate(subscription.periodEnd)}</p>
                          </div>
                          <div>
                            <p>Created: {formatDate(subscription.createdAt)}</p>
                            {subscription.stripeSubscriptionId && (
                              <p class='font-mono text-xs'>
                                Stripe: {subscription.stripeSubscriptionId.slice(0, 20)}...
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div class='ml-4'>
                        <button
                          onClick={() => onCancel()(subscription.id)}
                          disabled={loading()}
                          class='rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50'
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
