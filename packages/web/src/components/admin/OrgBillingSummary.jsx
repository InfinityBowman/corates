/**
 * Org Billing Summary component
 * Displays current billing state for an organization
 */

import { Show, For } from 'solid-js';

export default function OrgBillingSummary(props) {
  const billing = () => props.billing;
  const currentPlan = () => billing()?.plan?.name || 'Free';
  const effectivePlanId = () => billing()?.effectivePlanId || 'free';
  const accessMode = () => billing()?.accessMode || 'readOnly';
  const billingSource = () => billing()?.source || 'free';
  const entitlements = () => billing()?.plan?.entitlements || {};
  const quotas = () => billing()?.plan?.quotas || {};
  const effectiveSubscription = () => billing()?.subscription;
  const effectiveGrant = () => billing()?.grant;

  const getSourceReason = () => {
    const source = billingSource();
    if (source === 'subscription' && effectiveSubscription()) {
      return `Active subscription (${effectiveSubscription().plan})`;
    }
    if (source === 'grant' && effectiveGrant()) {
      return `Active grant (${effectiveGrant().type})`;
    }
    if (source === 'free') {
      return 'No active subscription or grant';
    }
    return `Source: ${source}`;
  };

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
            <p class='mt-1 text-xs text-gray-400 font-mono'>{effectivePlanId()}</p>
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

        {/* Reason */}
        <div class='mt-4 rounded-lg bg-gray-50 p-3'>
          <p class='text-xs font-medium text-gray-500 uppercase tracking-wide'>Effective Because</p>
          <p class='mt-1 text-sm text-gray-700'>{getSourceReason()}</p>
        </div>

        {/* Entitlements and Quotas */}
        <div class='mt-6 grid grid-cols-1 gap-6 md:grid-cols-2'>
          <div>
            <h3 class='mb-3 text-sm font-semibold text-gray-900'>Entitlements</h3>
            <dl class='space-y-2'>
              <Show
                when={Object.keys(entitlements()).length > 0}
                fallback={<p class='text-sm text-gray-500'>No entitlements</p>}
              >
                <For each={Object.entries(entitlements())}>
                  {([key, value]) => (
                    <div class='flex justify-between border-b border-gray-100 pb-2'>
                      <dt class='text-sm text-gray-600 capitalize'>{key.replace(/([A-Z])/g, ' $1').trim()}</dt>
                      <dd class='text-sm font-medium text-gray-900'>
                        {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
                      </dd>
                    </div>
                  )}
                </For>
              </Show>
            </dl>
          </div>
          <div>
            <h3 class='mb-3 text-sm font-semibold text-gray-900'>Quotas</h3>
            <dl class='space-y-2'>
              <Show
                when={Object.keys(quotas()).length > 0}
                fallback={<p class='text-sm text-gray-500'>No quotas</p>}
              >
                <For each={Object.entries(quotas())}>
                  {([key, value]) => (
                    <div class='flex justify-between border-b border-gray-100 pb-2'>
                      <dt class='text-sm text-gray-600 capitalize'>{key.replace(/([A-Z])/g, ' $1').trim()}</dt>
                      <dd class='text-sm font-medium text-gray-900'>
                        {value === null || value === undefined ? 'Unlimited' : String(value)}
                      </dd>
                    </div>
                  )}
                </For>
              </Show>
            </dl>
          </div>
        </div>
      </div>
    </Show>
  );
}
