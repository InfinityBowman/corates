/**
 * Subscription Dialog component
 * Dialog for creating subscriptions
 */

import { Dialog } from '@corates/ui';

export default function SubscriptionDialog(props) {
  const open = () => props.open;
  const onOpenChange = () => props.onOpenChange;
  const loading = () => props.loading;
  const plan = () => props.plan;
  const status = () => props.status;
  const periodStart = () => props.periodStart;
  const periodEnd = () => props.periodEnd;
  const onPlanChange = () => props.onPlanChange;
  const onStatusChange = () => props.onStatusChange;
  const onPeriodStartChange = () => props.onPeriodStartChange;
  const onPeriodEndChange = () => props.onPeriodEndChange;
  const onSubmit = () => props.onSubmit;

  return (
    <Dialog open={open()} onOpenChange={onOpenChange()} title='Create Subscription'>
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
            {loading() ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
