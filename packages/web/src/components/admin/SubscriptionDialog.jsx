/**
 * Subscription Dialog component
 * Dialog for creating and editing subscriptions
 */

import { Dialog } from '@corates/ui';

export default function SubscriptionDialog(props) {
  const open = () => props.open;
  const onOpenChange = () => props.onOpenChange;
  const loading = () => props.loading;
  const isEdit = () => props.isEdit || false;
  const plan = () => props.plan;
  const status = () => props.status;
  const periodStart = () => props.periodStart;
  const periodEnd = () => props.periodEnd;
  const cancelAtPeriodEnd = () => props.cancelAtPeriodEnd || false;
  const canceledAt = () => props.canceledAt;
  const endedAt = () => props.endedAt;
  const stripeCustomerId = () => props.stripeCustomerId || '';
  const stripeSubscriptionId = () => props.stripeSubscriptionId || '';
  const onPlanChange = () => props.onPlanChange;
  const onStatusChange = () => props.onStatusChange;
  const onPeriodStartChange = () => props.onPeriodStartChange;
  const onPeriodEndChange = () => props.onPeriodEndChange;
  const onCancelAtPeriodEndChange = () => props.onCancelAtPeriodEndChange;
  const onCanceledAtChange = () => props.onCanceledAtChange;
  const onEndedAtChange = () => props.onEndedAtChange;
  const onStripeCustomerIdChange = () => props.onStripeCustomerIdChange;
  const onStripeSubscriptionIdChange = () => props.onStripeSubscriptionIdChange;
  const onSubmit = () => props.onSubmit;

  const formatDateInput = timestamp => {
    if (!timestamp) return '';
    const date = timestamp instanceof Date ?
        timestamp
      : typeof timestamp === 'string' ?
        new Date(timestamp)
      : new Date(timestamp * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  return (
    <Dialog
      open={open()}
      onOpenChange={onOpenChange()}
      title={isEdit() ? 'Edit Subscription' : 'Create Subscription'}
    >
      <div class='space-y-4'>
        <div>
          <label class='mb-1 block text-sm font-medium text-gray-700'>Plan</label>
          <select
            value={plan()}
            onInput={e => onPlanChange()(e.target.value)}
            class='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none'
          >
            <option value='starter_team'>Starter Team</option>
            <option value='team'>Team</option>
            <option value='unlimited_team'>Unlimited Team</option>
          </select>
        </div>
        <div>
          <label class='mb-1 block text-sm font-medium text-gray-700'>Status</label>
          <select
            value={status()}
            onInput={e => onStatusChange()(e.target.value)}
            class='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none'
          >
            <option value='active'>Active</option>
            <option value='trialing'>Trialing</option>
            <option value='past_due'>Past Due</option>
            <option value='paused'>Paused</option>
            <option value='canceled'>Canceled</option>
            <option value='unpaid'>Unpaid</option>
            <option value='incomplete'>Incomplete</option>
          </select>
        </div>
        <div>
          <label class='mb-1 block text-sm font-medium text-gray-700'>
            Period Start (optional)
          </label>
          <input
            type='datetime-local'
            value={periodStart()}
            onInput={e => onPeriodStartChange()(e.target.value)}
            class='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none'
          />
        </div>
        <div>
          <label class='mb-1 block text-sm font-medium text-gray-700'>Period End (optional)</label>
          <input
            type='datetime-local'
            value={periodEnd()}
            onInput={e => onPeriodEndChange()(e.target.value)}
            class='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none'
          />
        </div>
        <div class='flex items-center space-x-2'>
          <input
            type='checkbox'
            id='cancelAtPeriodEnd'
            checked={cancelAtPeriodEnd()}
            onInput={e => onCancelAtPeriodEndChange()(e.target.checked)}
            class='h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500'
          />
          <label for='cancelAtPeriodEnd' class='text-sm font-medium text-gray-700'>
            Cancel at period end
          </label>
        </div>
        <div>
          <label class='mb-1 block text-sm font-medium text-gray-700'>
            Canceled At (optional)
          </label>
          <input
            type='datetime-local'
            value={canceledAt() ? formatDateInput(canceledAt()) : ''}
            onInput={e => onCanceledAtChange()(e.target.value ? new Date(e.target.value) : null)}
            class='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none'
          />
        </div>
        <div>
          <label class='mb-1 block text-sm font-medium text-gray-700'>Ended At (optional)</label>
          <input
            type='datetime-local'
            value={endedAt() ? formatDateInput(endedAt()) : ''}
            onInput={e => onEndedAtChange()(e.target.value ? new Date(e.target.value) : null)}
            class='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none'
          />
        </div>
        <div>
          <label class='mb-1 block text-sm font-medium text-gray-700'>
            Stripe Customer ID (optional)
          </label>
          <input
            type='text'
            value={stripeCustomerId()}
            onInput={e => onStripeCustomerIdChange()(e.target.value)}
            placeholder='cus_...'
            class='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none'
          />
        </div>
        <div>
          <label class='mb-1 block text-sm font-medium text-gray-700'>
            Stripe Subscription ID (optional)
          </label>
          <input
            type='text'
            value={stripeSubscriptionId()}
            onInput={e => onStripeSubscriptionIdChange()(e.target.value)}
            placeholder='sub_...'
            class='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none'
          />
        </div>
        <div class='flex justify-end space-x-3'>
          <button
            onClick={() => onOpenChange()(false)}
            class='rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200'
          >
            Cancel
          </button>
          <button
            onClick={onSubmit()}
            disabled={loading()}
            class='rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50'
          >
            {loading() ? (isEdit() ? 'Updating...' : 'Creating...') : isEdit() ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
