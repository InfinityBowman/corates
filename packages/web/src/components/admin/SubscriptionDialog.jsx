/**
 * Subscription Dialog component
 * Dialog for creating and editing subscriptions
 */

import {
  Dialog,
  DialogBackdrop,
  DialogPositioner,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogCloseTrigger,
} from '@/components/ui/dialog';
import { FiX } from 'solid-icons/fi';

/**
 * Subscription Dialog component
 * Dialog for creating and editing subscriptions
 * @param {object} props - Component props
 * @param {boolean} props.open - Whether the dialog is open
 * @param {function(boolean): void} props.onOpenChange - Function to open or close the dialog
 * @param {boolean} [props.isEdit] - Whether the dialog is in edit mode
 * @param {string} props.plan - The plan of the subscription (e.g., 'starter_team', 'team', 'unlimited_team')
 * @param {string} props.status - The status of the subscription
 * @param {string} [props.periodStart] - The start date and time of the subscription (datetime-local format)
 * @param {string} [props.periodEnd] - The end date and time of the subscription (datetime-local format)
 * @param {boolean} [props.cancelAtPeriodEnd] - Whether to cancel at the end of the period
 * @param {Date|null} [props.canceledAt] - The date and time the subscription was canceled
 * @param {Date|null} [props.endedAt] - The date and time the subscription ended
 * @param {string} [props.stripeCustomerId] - The Stripe customer ID
 * @param {string} [props.stripeSubscriptionId] - The Stripe subscription ID
 * @param {function(string): void} props.onPlanChange - Function to change the plan
 * @param {function(string): void} props.onStatusChange - Function to change the status
 * @param {function(string): void} props.onPeriodStartChange - Function to change the period start
 * @param {function(string): void} props.onPeriodEndChange - Function to change the period end
 * @param {function(boolean): void} props.onCancelAtPeriodEndChange - Function to change cancel at period end flag
 * @param {function(Date|null): void} props.onCanceledAtChange - Function to change canceled at date
 * @param {function(Date|null): void} props.onEndedAtChange - Function to change ended at date
 * @param {function(string): void} props.onStripeCustomerIdChange - Function to change the Stripe customer ID
 * @param {function(string): void} props.onStripeSubscriptionIdChange - Function to change the Stripe subscription ID
 * @param {function(): void} props.onSubmit - Function to submit the subscription form
 * @param {boolean} [props.loading] - Whether the subscription is being created or updated
 * @returns {JSX.Element} - The SubscriptionDialog component
 */
export default function SubscriptionDialog(props) {
  const open = () => props.open;
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

  const formatDateInput = timestamp => {
    if (!timestamp) return '';
    const date =
      timestamp instanceof Date ? timestamp
      : typeof timestamp === 'string' ? new Date(timestamp)
      : new Date(timestamp * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  return (
    <Dialog open={open()} onOpenChange={props.onOpenChange}>
      <DialogBackdrop />
      <DialogPositioner>
        <DialogContent class='max-w-lg'>
          <DialogHeader>
            <DialogTitle>{isEdit() ? 'Edit Subscription' : 'Create Subscription'}</DialogTitle>
            <DialogCloseTrigger>
              <FiX class='h-5 w-5' />
            </DialogCloseTrigger>
          </DialogHeader>
          <DialogBody>
            <div class='space-y-4'>
              <div>
                <label class='text-secondary-foreground mb-1 block text-sm font-medium'>Plan</label>
                <select
                  value={plan()}
                  onInput={e => props.onPlanChange?.(e.target.value)}
                  class='border-border w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none'
                >
                  <option value='starter_team'>Starter Team</option>
                  <option value='team'>Team</option>
                  <option value='unlimited_team'>Unlimited Team</option>
                </select>
              </div>
              <div>
                <label class='text-secondary-foreground mb-1 block text-sm font-medium'>
                  Status
                </label>
                <select
                  value={status()}
                  onInput={e => props.onStatusChange?.(e.target.value)}
                  class='border-border w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none'
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
                <label class='text-secondary-foreground mb-1 block text-sm font-medium'>
                  Period Start (optional)
                </label>
                <input
                  type='datetime-local'
                  value={periodStart()}
                  onInput={e => props.onPeriodStartChange?.(e.target.value)}
                  class='border-border w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none'
                />
              </div>
              <div>
                <label class='text-secondary-foreground mb-1 block text-sm font-medium'>
                  Period End (optional)
                </label>
                <input
                  type='datetime-local'
                  value={periodEnd()}
                  onInput={e => props.onPeriodEndChange?.(e.target.value)}
                  class='border-border w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none'
                />
              </div>
              <div class='flex items-center space-x-2'>
                <input
                  type='checkbox'
                  id='cancelAtPeriodEnd'
                  checked={cancelAtPeriodEnd()}
                  onInput={e => props.onCancelAtPeriodEndChange?.(e.target.checked)}
                  class='border-border h-4 w-4 rounded text-blue-600 focus:ring-2 focus:ring-blue-500'
                />
                <label
                  for='cancelAtPeriodEnd'
                  class='text-secondary-foreground text-sm font-medium'
                >
                  Cancel at period end
                </label>
              </div>
              <div>
                <label class='text-secondary-foreground mb-1 block text-sm font-medium'>
                  Canceled At (optional)
                </label>
                <input
                  type='datetime-local'
                  value={canceledAt() ? formatDateInput(canceledAt()) : ''}
                  onInput={e =>
                    props.onCanceledAtChange?.(e.target.value ? new Date(e.target.value) : null)
                  }
                  class='border-border w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none'
                />
              </div>
              <div>
                <label class='text-secondary-foreground mb-1 block text-sm font-medium'>
                  Ended At (optional)
                </label>
                <input
                  type='datetime-local'
                  value={endedAt() ? formatDateInput(endedAt()) : ''}
                  onInput={e =>
                    props.onEndedAtChange?.(e.target.value ? new Date(e.target.value) : null)
                  }
                  class='border-border w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none'
                />
              </div>
              <div>
                <label class='text-secondary-foreground mb-1 block text-sm font-medium'>
                  Stripe Customer ID (optional)
                </label>
                <input
                  type='text'
                  value={stripeCustomerId()}
                  onInput={e => props.onStripeCustomerIdChange?.(e.target.value)}
                  placeholder='cus_...'
                  class='border-border w-full rounded-lg border px-3 py-2 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none'
                />
              </div>
              <div>
                <label class='text-secondary-foreground mb-1 block text-sm font-medium'>
                  Stripe Subscription ID (optional)
                </label>
                <input
                  type='text'
                  value={stripeSubscriptionId()}
                  onInput={e => props.onStripeSubscriptionIdChange?.(e.target.value)}
                  placeholder='sub_...'
                  class='border-border w-full rounded-lg border px-3 py-2 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none'
                />
              </div>
              <div class='border-border flex justify-end space-x-3 border-t pt-4'>
                <button
                  onClick={() => props.onOpenChange?.(false)}
                  class='bg-secondary text-secondary-foreground hover:bg-secondary rounded-lg px-4 py-2 text-sm font-medium'
                >
                  Cancel
                </button>
                <button
                  onClick={() => props.onSubmit?.()}
                  disabled={loading()}
                  class='rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50'
                >
                  {loading() ?
                    isEdit() ?
                      'Updating...'
                    : 'Creating...'
                  : isEdit() ?
                    'Update'
                  : 'Create'}
                </button>
              </div>
            </div>
          </DialogBody>
        </DialogContent>
      </DialogPositioner>
    </Dialog>
  );
}
