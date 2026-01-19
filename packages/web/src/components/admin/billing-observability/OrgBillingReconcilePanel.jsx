/**
 * Org Billing Reconcile Panel
 * Shows billing reconciliation results and stuck states for an organization
 */

import { createSignal, Show, For } from 'solid-js';
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiLoader,
  FiRefreshCw,
  FiAlertCircle,
} from 'solid-icons/fi';
import { useAdminOrgBillingReconcile } from '@primitives/useAdminQueries.js';
import { A } from '@solidjs/router';

/**
 * OrgBillingReconcilePanel component
 * @param {object} props
 * @param {() => string} props.orgId - Organization ID function
 */
export default function OrgBillingReconcilePanel(props) {
  const orgId = () => props.orgId();

  const [incompleteThreshold, setIncompleteThreshold] = createSignal(30);
  const [checkoutNoSubThreshold, setCheckoutNoSubThreshold] = createSignal(15);
  const [processingLagThreshold, setProcessingLagThreshold] = createSignal(5);
  const [checkStripe, setCheckStripe] = createSignal(false);

  const reconcileQuery = useAdminOrgBillingReconcile(orgId(), () => ({
    checkStripe: checkStripe(),
    incompleteThreshold: incompleteThreshold(),
    checkoutNoSubThreshold: checkoutNoSubThreshold(),
    processingLagThreshold: processingLagThreshold(),
  }));

  const reconcileData = () => reconcileQuery.data;
  const stuckStates = () => reconcileData()?.stuckStates || [];
  const summary = () => reconcileData()?.summary || {};

  const getSeverityIcon = severity => {
    switch (severity) {
      case 'critical':
        return FiAlertTriangle;
      case 'high':
        return FiAlertCircle;
      case 'medium':
        return FiAlertCircle;
      default:
        return FiCheckCircle;
    }
  };

  const getSeverityColor = severity => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-secondary text-foreground border-border';
    }
  };

  return (
    <div class='border-border bg-card rounded-lg border'>
      <div class='border-border border-b px-6 py-4'>
        <div class='flex items-center justify-between'>
          <div class='flex items-center space-x-3'>
            <FiRefreshCw class='text-muted-foreground/70 h-5 w-5' />
            <h2 class='text-foreground text-lg font-semibold'>Billing Reconciliation</h2>
          </div>
          <button
            onClick={() => reconcileQuery.refetch()}
            class='border-border bg-card text-secondary-foreground hover:bg-muted rounded-md border px-4 py-2 text-sm font-medium'
            disabled={reconcileQuery.isFetching}
          >
            {reconcileQuery.isFetching ?
              <FiLoader class='h-4 w-4 animate-spin' />
            : 'Refresh'}
          </button>
        </div>
      </div>

      <div class='p-6'>
        <Show
          when={!reconcileQuery.isLoading}
          fallback={
            <div class='flex items-center justify-center py-8'>
              <FiLoader class='h-6 w-6 animate-spin text-blue-600' />
            </div>
          }
        >
          <Show when={reconcileData()}>
            {/* Controls */}
            <div class='border-border bg-muted mb-6 rounded-lg border p-4'>
              <div class='grid grid-cols-1 gap-4 md:grid-cols-4'>
                <div>
                  <label class='text-secondary-foreground block text-sm font-medium'>
                    Incomplete Threshold (min)
                  </label>
                  <input
                    type='number'
                    value={incompleteThreshold()}
                    onInput={e => setIncompleteThreshold(parseInt(e.target.value, 10))}
                    min='1'
                    class='border-border mt-1 block w-full rounded-md text-sm'
                  />
                </div>
                <div>
                  <label class='text-secondary-foreground block text-sm font-medium'>
                    Checkout No Sub Threshold (min)
                  </label>
                  <input
                    type='number'
                    value={checkoutNoSubThreshold()}
                    onInput={e => setCheckoutNoSubThreshold(parseInt(e.target.value, 10))}
                    min='1'
                    class='border-border mt-1 block w-full rounded-md text-sm'
                  />
                </div>
                <div>
                  <label class='text-secondary-foreground block text-sm font-medium'>
                    Processing Lag Threshold (min)
                  </label>
                  <input
                    type='number'
                    value={processingLagThreshold()}
                    onInput={e => setProcessingLagThreshold(parseInt(e.target.value, 10))}
                    min='1'
                    class='border-border mt-1 block w-full rounded-md text-sm'
                  />
                </div>
                <div>
                  <label class='text-secondary-foreground block text-sm font-medium'>Options</label>
                  <div class='mt-2 flex items-center'>
                    <input
                      type='checkbox'
                      id='checkStripe'
                      checked={checkStripe()}
                      onInput={e => setCheckStripe(e.target.checked)}
                      class='border-border h-4 w-4 rounded text-blue-600 focus:ring-blue-500'
                    />
                    <label for='checkStripe' class='text-secondary-foreground ml-2 text-sm'>
                      Check Stripe API
                    </label>
                  </div>
                  {checkStripe() && (
                    <p class='mt-1 text-xs text-yellow-600'>Note: This makes API calls to Stripe</p>
                  )}
                </div>
              </div>
            </div>

            {/* Summary */}
            <div class='mb-6 grid grid-cols-2 gap-4 md:grid-cols-5'>
              <div class='border-border bg-card rounded-lg border p-4'>
                <p class='text-muted-foreground text-sm'>Total Stuck</p>
                <p class='text-foreground text-2xl font-bold'>{summary().stuckStateCount || 0}</p>
              </div>
              <div class='rounded-lg border border-red-300 bg-red-50 p-4'>
                <p class='text-muted-foreground text-sm'>Critical</p>
                <p class='text-2xl font-bold text-red-800'>
                  {stuckStates().filter(s => s.severity === 'critical').length}
                </p>
              </div>
              <div class='rounded-lg border border-orange-300 bg-orange-50 p-4'>
                <p class='text-muted-foreground text-sm'>High</p>
                <p class='text-2xl font-bold text-orange-800'>
                  {stuckStates().filter(s => s.severity === 'high').length}
                </p>
              </div>
              <div class='border-border bg-card rounded-lg border p-4'>
                <p class='text-muted-foreground text-sm'>Failed Webhooks</p>
                <p class='text-foreground text-2xl font-bold'>{summary().failedWebhooks || 0}</p>
              </div>
              <div class='border-border bg-card rounded-lg border p-4'>
                <p class='text-muted-foreground text-sm'>Ignored Webhooks</p>
                <p class='text-foreground text-2xl font-bold'>{summary().ignoredWebhooks || 0}</p>
              </div>
            </div>

            {/* Stuck States */}
            <Show
              when={stuckStates().length > 0}
              fallback={
                <div class='rounded-lg border border-green-200 bg-green-50 p-8 text-center'>
                  <FiCheckCircle class='mx-auto mb-4 h-12 w-12 text-green-600' />
                  <p class='text-lg font-medium text-green-900'>No stuck states found</p>
                  <p class='text-sm text-green-700'>
                    All billing states are healthy for this organization
                  </p>
                </div>
              }
            >
              <div class='space-y-4'>
                <For each={stuckStates()}>
                  {state => {
                    const Icon = getSeverityIcon(state.severity);
                    return (
                      <div class={`rounded-lg border-2 p-4 ${getSeverityColor(state.severity)}`}>
                        <div class='flex items-start space-x-3'>
                          <Icon class='mt-0.5 h-5 w-5 shrink-0' />
                          <div class='flex-1'>
                            <div class='flex items-center space-x-2'>
                              <h3 class='font-semibold'>{state.type.replace(/_/g, ' ')}</h3>
                              <span
                                class={`rounded-full px-2.5 py-0.5 text-xs font-medium ${getSeverityColor(state.severity)}`}
                              >
                                {state.severity}
                              </span>
                            </div>
                            <p class='mt-2 text-sm'>{state.description}</p>
                            {state.ageMinutes && (
                              <p class='mt-1 text-xs opacity-75'>
                                Age: {state.ageMinutes} minutes (threshold: {state.threshold})
                              </p>
                            )}
                            {state.subscriptionId && (
                              <p class='mt-1 text-xs opacity-75'>
                                Subscription: <code>{state.subscriptionId}</code>
                              </p>
                            )}
                            {state.stripeSubscriptionId && (
                              <div class='mt-1 flex items-center space-x-2 text-xs opacity-75'>
                                <span>Stripe Subscription:</span>
                                <code>{state.stripeSubscriptionId}</code>
                                <a
                                  href={`https://dashboard.stripe.com/subscriptions/${state.stripeSubscriptionId}`}
                                  target='_blank'
                                  rel='noopener noreferrer'
                                  class='text-blue-600 hover:text-blue-800'
                                >
                                  View in Stripe
                                </a>
                              </div>
                            )}
                            {state.stripeEventId && (
                              <div class='mt-1 flex items-center space-x-2 text-xs opacity-75'>
                                <span>Event:</span>
                                <code>{state.stripeEventId}</code>
                                <A
                                  href={`/admin/billing/ledger?type=checkout.session.completed`}
                                  class='text-blue-600 hover:text-blue-800'
                                >
                                  View in Ledger
                                </A>
                              </div>
                            )}
                            {state.localStatus && state.stripeStatus && (
                              <p class='mt-1 text-xs opacity-75'>
                                Status mismatch: Local={state.localStatus}, Stripe=
                                {state.stripeStatus}
                              </p>
                            )}
                            {state.type === 'checkout_no_subscription' && (
                              <div class='bg-card/50 mt-4 rounded p-3'>
                                <p class='mb-2 text-xs font-semibold'>Recommended Checks:</p>
                                <ul class='list-inside list-disc space-y-1 text-xs'>
                                  <li>Verify Better Auth Stripe plugin configuration</li>
                                  <li>
                                    Check authorizeReference function returns true for this org
                                  </li>
                                  <li>
                                    Verify referenceId/orgId mapping matches checkout metadata
                                  </li>
                                  <li>Check Stripe dashboard for subscription creation attempts</li>
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }}
                </For>
              </div>
            </Show>

            {/* Stripe Comparison */}
            <Show when={reconcileData()?.stripeComparison}>
              {comparison => (
                <div class='border-border bg-muted mt-6 rounded-lg border p-4'>
                  <h3 class='text-foreground mb-3 font-semibold'>Stripe API Comparison</h3>
                  {comparison().error ?
                    <p class='text-sm text-red-600'>Error: {comparison().error}</p>
                  : comparison().noActiveSubscription ?
                    <p class='text-muted-foreground text-sm'>No active subscription to compare</p>
                  : <div class='space-y-2 text-sm'>
                      <div class='flex items-center space-x-2'>
                        <span class='font-medium'>Status Match:</span>
                        {comparison().match ?
                          <FiCheckCircle class='h-4 w-4 text-green-600' />
                        : <FiAlertTriangle class='h-4 w-4 text-red-600' />}
                      </div>
                      <div>
                        <span class='font-medium'>Local:</span>{' '}
                        <code>{comparison().localStatus}</code>
                      </div>
                      <div>
                        <span class='font-medium'>Stripe:</span>{' '}
                        <code>{comparison().stripeStatus}</code>
                      </div>
                    </div>
                  }
                </div>
              )}
            </Show>
          </Show>
        </Show>
      </div>
    </div>
  );
}
