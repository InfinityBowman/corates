/**
 * Org Billing Summary component
 * Displays current billing state for an organization
 */

import { Show } from 'solid-js';
import { FiCreditCard } from 'solid-icons/fi';

export default function OrgBillingSummary(props) {
  const billing = () => props.billing;
  const currentPlan = () => billing()?.plan?.name || 'Free';
  const accessMode = () => billing()?.accessMode || 'readOnly';
  const billingSource = () => billing()?.source || 'free';

  return (
    <Show when={billing()}>
      <div class='rounded-lg border border-gray-200 bg-white p-6'>
        <div class='mb-4 flex items-center justify-between'>
          <h2 class='text-lg font-semibold text-gray-900'>Billing Summary</h2>
        </div>
        <div class='grid grid-cols-1 gap-4 md:grid-cols-3'>
          <div>
            <p class='text-sm text-gray-500'>Effective Plan</p>
            <p class='mt-1 text-lg font-medium text-gray-900'>{currentPlan()}</p>
          </div>
          <div>
            <p class='text-sm text-gray-500'>Access Mode</p>
            <p class='mt-1 text-lg font-medium text-gray-900'>
              {accessMode() === 'full' ? (
                <span class='inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800'>
                  Full Access
                </span>
              ) : (
                <span class='inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800'>
                  Read Only
                </span>
              )}
            </p>
          </div>
          <div>
            <p class='text-sm text-gray-500'>Source</p>
            <p class='mt-1 text-lg font-medium text-gray-900 capitalize'>{billingSource()}</p>
          </div>
        </div>
      </div>
    </Show>
  );
}
