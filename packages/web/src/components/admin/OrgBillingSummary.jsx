/**
 * Org Billing Summary component
 * Displays current billing state for an organization
 */

import { Show, For } from 'solid-js';

/**
 * Org Billing Summary component
 * Displays current billing state for an organization including plan, entitlements, and quotas
 * @param {object} props - Component props
 * @param {object|null} [props.billing] - The billing state object
 * @param {object} [props.billing.plan] - The current plan object
 * @param {string} [props.billing.plan.name] - The name of the current plan
 * @param {object} [props.billing.plan.entitlements] - The entitlements of the current plan
 * @param {object} [props.billing.plan.quotas] - The quotas of the current plan
 * @param {string} [props.billing.effectivePlanId] - The ID of the effective plan
 * @param {'full'|'readOnly'} [props.billing.accessMode] - The access mode
 * @param {'free'|'subscription'|'grant'} [props.billing.source] - The source of the billing
 * @param {object|null} [props.billing.subscription] - The active subscription object
 * @param {object|null} [props.billing.grant] - The active grant object
 * @returns {JSX.Element} - The OrgBillingSummary component
 */
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
      <div class='border-border bg-card rounded-lg border p-6 shadow-sm'>
        <div class='mb-4 flex items-center justify-between'>
          <h2 class='text-foreground text-lg font-semibold'>Billing Summary</h2>
        </div>
        <div class='grid grid-cols-1 gap-4 md:grid-cols-3'>
          <div>
            <p class='text-muted-foreground text-sm'>Effective Plan</p>
            <p class='text-foreground mt-1 text-lg font-medium'>{currentPlan()}</p>
            <p class='text-muted-foreground/70 mt-1 font-mono text-xs'>{effectivePlanId()}</p>
          </div>
          <div>
            <p class='text-muted-foreground text-sm'>Access Mode</p>
            <p class='text-foreground mt-1 text-lg font-medium'>
              {accessMode() === 'full' ?
                <span class='inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800'>
                  Full Access
                </span>
              : <span class='inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800'>
                  Read Only
                </span>
              }
            </p>
          </div>
          <div>
            <p class='text-muted-foreground text-sm'>Source</p>
            <p class='text-foreground mt-1 text-lg font-medium capitalize'>{billingSource()}</p>
          </div>
        </div>

        {/* Reason */}
        <div class='bg-muted mt-4 rounded-lg p-3'>
          <p class='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
            Effective Because
          </p>
          <p class='text-secondary-foreground mt-1 text-sm'>{getSourceReason()}</p>
        </div>

        {/* Entitlements and Quotas */}
        <div class='mt-6 grid grid-cols-1 gap-6 md:grid-cols-2'>
          <div>
            <h3 class='text-foreground mb-3 text-sm font-semibold'>Entitlements</h3>
            <dl class='space-y-2'>
              <Show
                when={Object.keys(entitlements()).length > 0}
                fallback={<p class='text-muted-foreground text-sm'>No entitlements</p>}
              >
                <For each={Object.entries(entitlements())}>
                  {([key, value]) => (
                    <div class='border-border-subtle flex justify-between border-b pb-2'>
                      <dt class='text-muted-foreground text-sm capitalize'>
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </dt>
                      <dd class='text-foreground text-sm font-medium'>
                        {typeof value === 'boolean' ?
                          value ?
                            'Yes'
                          : 'No'
                        : String(value)}
                      </dd>
                    </div>
                  )}
                </For>
              </Show>
            </dl>
          </div>
          <div>
            <h3 class='text-foreground mb-3 text-sm font-semibold'>Quotas</h3>
            <dl class='space-y-2'>
              <Show
                when={Object.keys(quotas()).length > 0}
                fallback={<p class='text-muted-foreground text-sm'>No quotas</p>}
              >
                <For each={Object.entries(quotas())}>
                  {([key, value]) => (
                    <div class='border-border-subtle flex justify-between border-b pb-2'>
                      <dt class='text-muted-foreground text-sm capitalize'>
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </dt>
                      <dd class='text-foreground text-sm font-medium'>
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
