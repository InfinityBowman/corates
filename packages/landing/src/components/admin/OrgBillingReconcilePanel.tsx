/**
 * Org Billing Reconcile Panel
 * Shows billing reconciliation results and stuck states for an organization
 */

import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  LoaderIcon,
  RefreshCwIcon,
  AlertCircleIcon,
} from 'lucide-react';
import { useAdminOrgBillingReconcile } from '@/hooks/useAdminQueries';

interface StuckState {
  type: string;
  severity: string;
  description: string;
  ageMinutes?: number;
  threshold?: number;
  subscriptionId?: string;
  stripeSubscriptionId?: string;
  stripeEventId?: string;
  localStatus?: string;
  stripeStatus?: string;
}

interface ReconcileSummary {
  stuckStateCount?: number;
  failedWebhooks?: number;
  ignoredWebhooks?: number;
}

interface StripeComparison {
  error?: string;
  noActiveSubscription?: boolean;
  match?: boolean;
  localStatus?: string;
  stripeStatus?: string;
}

interface ReconcileData {
  stuckStates?: StuckState[];
  summary?: ReconcileSummary;
  stripeComparison?: StripeComparison;
}

interface OrgBillingReconcilePanelProps {
  orgId: string;
}

const getSeverityIcon = (severity: string) => {
  switch (severity) {
    case 'critical':
      return AlertTriangleIcon;
    case 'high':
    case 'medium':
      return AlertCircleIcon;
    default:
      return CheckCircleIcon;
  }
};

const getSeverityColor = (severity: string): string => {
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

export function OrgBillingReconcilePanel({ orgId }: OrgBillingReconcilePanelProps) {
  const [incompleteThreshold, setIncompleteThreshold] = useState(30);
  const [checkoutNoSubThreshold, setCheckoutNoSubThreshold] = useState(15);
  const [processingLagThreshold, setProcessingLagThreshold] = useState(5);
  const [checkStripe, setCheckStripe] = useState(false);

  const reconcileQuery = useAdminOrgBillingReconcile(orgId, {
    checkStripe,
    incompleteThreshold,
    checkoutNoSubThreshold,
    processingLagThreshold,
  });

  const reconcileData = reconcileQuery.data as ReconcileData | undefined;
  const stuckStates = reconcileData?.stuckStates ?? [];
  const summary = reconcileData?.summary ?? {};

  return (
    <div className='border-border bg-card rounded-lg border'>
      <div className='border-border border-b px-6 py-4'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <RefreshCwIcon className='text-muted-foreground/70 size-5' />
            <h2 className='text-foreground text-lg font-semibold'>Billing Reconciliation</h2>
          </div>
          <button
            type='button'
            onClick={() => reconcileQuery.refetch()}
            className='border-border bg-card text-secondary-foreground hover:bg-muted rounded-md border px-4 py-2 text-sm font-medium'
            disabled={reconcileQuery.isFetching}
          >
            {reconcileQuery.isFetching ?
              <LoaderIcon className='size-4 animate-spin' />
            : 'Refresh'}
          </button>
        </div>
      </div>

      <div className='p-6'>
        {reconcileQuery.isLoading ?
          <div className='flex items-center justify-center py-8'>
            <LoaderIcon className='size-6 animate-spin text-blue-600' />
          </div>
        : reconcileData ?
          <>
            {/* Controls */}
            <div className='border-border bg-muted mb-6 rounded-lg border p-4'>
              <div className='grid grid-cols-1 gap-4 md:grid-cols-4'>
                <div>
                  <label className='text-secondary-foreground block text-sm font-medium'>
                    Incomplete Threshold (min)
                  </label>
                  <input
                    type='number'
                    value={incompleteThreshold}
                    onChange={e => setIncompleteThreshold(parseInt(e.target.value, 10) || 30)}
                    min='1'
                    className='border-border mt-1 block w-full rounded-md text-sm'
                  />
                </div>
                <div>
                  <label className='text-secondary-foreground block text-sm font-medium'>
                    Checkout No Sub Threshold (min)
                  </label>
                  <input
                    type='number'
                    value={checkoutNoSubThreshold}
                    onChange={e => setCheckoutNoSubThreshold(parseInt(e.target.value, 10) || 15)}
                    min='1'
                    className='border-border mt-1 block w-full rounded-md text-sm'
                  />
                </div>
                <div>
                  <label className='text-secondary-foreground block text-sm font-medium'>
                    Processing Lag Threshold (min)
                  </label>
                  <input
                    type='number'
                    value={processingLagThreshold}
                    onChange={e => setProcessingLagThreshold(parseInt(e.target.value, 10) || 10)}
                    min='1'
                    className='border-border mt-1 block w-full rounded-md text-sm'
                  />
                </div>
                <div>
                  <label className='text-secondary-foreground block text-sm font-medium'>
                    Options
                  </label>
                  <div className='mt-2 flex items-center'>
                    <input
                      type='checkbox'
                      id='checkStripe'
                      checked={checkStripe}
                      onChange={e => setCheckStripe(e.target.checked)}
                      className='border-border size-4 rounded text-blue-600 focus:ring-blue-500'
                    />
                    <label htmlFor='checkStripe' className='text-secondary-foreground ml-2 text-sm'>
                      Check Stripe API
                    </label>
                  </div>
                  {checkStripe && (
                    <p className='mt-1 text-xs text-yellow-600'>
                      Note: This makes API calls to Stripe
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className='mb-6 grid grid-cols-2 gap-4 md:grid-cols-5'>
              <div className='border-border bg-card rounded-lg border p-4'>
                <p className='text-muted-foreground text-sm'>Total Stuck</p>
                <p className='text-foreground text-2xl font-bold'>{summary.stuckStateCount ?? 0}</p>
              </div>
              <div className='rounded-lg border border-red-300 bg-red-50 p-4'>
                <p className='text-muted-foreground text-sm'>Critical</p>
                <p className='text-2xl font-bold text-red-800'>
                  {stuckStates.filter(s => s.severity === 'critical').length}
                </p>
              </div>
              <div className='rounded-lg border border-orange-300 bg-orange-50 p-4'>
                <p className='text-muted-foreground text-sm'>High</p>
                <p className='text-2xl font-bold text-orange-800'>
                  {stuckStates.filter(s => s.severity === 'high').length}
                </p>
              </div>
              <div className='border-border bg-card rounded-lg border p-4'>
                <p className='text-muted-foreground text-sm'>Failed Webhooks</p>
                <p className='text-foreground text-2xl font-bold'>{summary.failedWebhooks ?? 0}</p>
              </div>
              <div className='border-border bg-card rounded-lg border p-4'>
                <p className='text-muted-foreground text-sm'>Ignored Webhooks</p>
                <p className='text-foreground text-2xl font-bold'>{summary.ignoredWebhooks ?? 0}</p>
              </div>
            </div>

            {/* Stuck States */}
            {stuckStates.length > 0 ?
              <div className='flex flex-col gap-4'>
                {stuckStates.map((state, idx) => {
                  const Icon = getSeverityIcon(state.severity);
                  return (
                    <div
                      key={idx}
                      className={`rounded-lg border-2 p-4 ${getSeverityColor(state.severity)}`}
                    >
                      <div className='flex items-start gap-3'>
                        <Icon className='mt-0.5 size-5 shrink-0' />
                        <div className='flex-1'>
                          <div className='flex items-center gap-2'>
                            <h3 className='font-semibold'>{state.type.replace(/_/g, ' ')}</h3>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${getSeverityColor(state.severity)}`}
                            >
                              {state.severity}
                            </span>
                          </div>
                          <p className='mt-2 text-sm'>{state.description}</p>
                          {state.ageMinutes != null && (
                            <p className='mt-1 text-xs opacity-75'>
                              Age: {state.ageMinutes} minutes (threshold: {state.threshold})
                            </p>
                          )}
                          {state.subscriptionId && (
                            <p className='mt-1 text-xs opacity-75'>
                              Subscription: <code>{state.subscriptionId}</code>
                            </p>
                          )}
                          {state.stripeSubscriptionId && (
                            <div className='mt-1 flex items-center gap-2 text-xs opacity-75'>
                              <span>Stripe Subscription:</span>
                              <code>{state.stripeSubscriptionId}</code>
                              <a
                                href={`https://dashboard.stripe.com/subscriptions/${state.stripeSubscriptionId}`}
                                target='_blank'
                                rel='noopener noreferrer'
                                className='text-blue-600 hover:text-blue-800'
                              >
                                View in Stripe
                              </a>
                            </div>
                          )}
                          {state.stripeEventId && (
                            <div className='mt-1 flex items-center gap-2 text-xs opacity-75'>
                              <span>Event:</span>
                              <code>{state.stripeEventId}</code>
                              <Link
                                to={'/admin/billing/ledger' as string}
                                search={
                                  {
                                    type: 'checkout.session.completed',
                                  } as Record<string, string>
                                }
                                className='text-blue-600 hover:text-blue-800'
                              >
                                View in Ledger
                              </Link>
                            </div>
                          )}
                          {state.localStatus && state.stripeStatus && (
                            <p className='mt-1 text-xs opacity-75'>
                              Status mismatch: Local={state.localStatus}, Stripe=
                              {state.stripeStatus}
                            </p>
                          )}
                          {state.type === 'checkout_no_subscription' && (
                            <div className='bg-card/50 mt-4 rounded p-3'>
                              <p className='mb-2 text-xs font-semibold'>Recommended Checks:</p>
                              <ul className='flex list-inside list-disc flex-col gap-1 text-xs'>
                                <li>Verify Better Auth Stripe plugin configuration</li>
                                <li>Check authorizeReference function returns true for this org</li>
                                <li>Verify referenceId/orgId mapping matches checkout metadata</li>
                                <li>Check Stripe dashboard for subscription creation attempts</li>
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            : <div className='rounded-lg border border-green-200 bg-green-50 p-8 text-center'>
                <CheckCircleIcon className='mx-auto mb-4 size-12 text-green-600' />
                <p className='text-lg font-medium text-green-900'>No stuck states found</p>
                <p className='text-sm text-green-700'>
                  All billing states are healthy for this organization
                </p>
              </div>
            }

            {/* Stripe Comparison */}
            {reconcileData.stripeComparison && (
              <div className='border-border bg-muted mt-6 rounded-lg border p-4'>
                <h3 className='text-foreground mb-3 font-semibold'>Stripe API Comparison</h3>
                {reconcileData.stripeComparison.error ?
                  <p className='text-sm text-red-600'>
                    Error: {reconcileData.stripeComparison.error}
                  </p>
                : reconcileData.stripeComparison.noActiveSubscription ?
                  <p className='text-muted-foreground text-sm'>No active subscription to compare</p>
                : <div className='flex flex-col gap-2 text-sm'>
                    <div className='flex items-center gap-2'>
                      <span className='font-medium'>Status Match:</span>
                      {reconcileData.stripeComparison.match ?
                        <CheckCircleIcon className='size-4 text-green-600' />
                      : <AlertTriangleIcon className='size-4 text-red-600' />}
                    </div>
                    <div>
                      <span className='font-medium'>Local:</span>{' '}
                      <code>{reconcileData.stripeComparison.localStatus}</code>
                    </div>
                    <div>
                      <span className='font-medium'>Stripe:</span>{' '}
                      <code>{reconcileData.stripeComparison.stripeStatus}</code>
                    </div>
                  </div>
                }
              </div>
            )}
          </>
        : null}
      </div>
    </div>
  );
}
