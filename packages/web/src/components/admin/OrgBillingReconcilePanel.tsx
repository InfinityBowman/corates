/**
 * Org Billing Reconcile Panel
 * Shows billing reconciliation results and stuck states for an organization
 */

import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { AlertTriangleIcon, CheckCircleIcon, RefreshCwIcon, AlertCircleIcon } from 'lucide-react';
import { useAdminOrgBillingReconcile } from '@/hooks/useAdminQueries';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

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

const getSeverityVariant = (severity: string) => {
  switch (severity) {
    case 'critical':
      return 'destructive' as const;
    case 'high':
      return 'warning' as const;
    case 'medium':
      return 'warning' as const;
    default:
      return 'default' as const;
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
          <Button
            variant='outline'
            onClick={() => reconcileQuery.refetch()}
            disabled={reconcileQuery.isFetching}
          >
            {reconcileQuery.isFetching ?
              <Spinner size='sm' data-icon='inline-start' />
            : null}
            {reconcileQuery.isFetching ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      <div className='p-6'>
        {reconcileQuery.isLoading ?
          <div className='flex items-center justify-center py-8'>
            <Spinner size='md' />
          </div>
        : reconcileData ?
          <>
            {/* Controls */}
            <div className='border-border bg-muted mb-6 rounded-lg border p-4'>
              <div className='grid grid-cols-1 gap-4 md:grid-cols-4'>
                <div className='flex flex-col gap-2'>
                  <Label>Incomplete Threshold (min)</Label>
                  <Input
                    type='number'
                    value={incompleteThreshold}
                    onChange={e => setIncompleteThreshold(parseInt(e.target.value, 10) || 30)}
                    min={1}
                  />
                </div>
                <div className='flex flex-col gap-2'>
                  <Label>Checkout No Sub Threshold (min)</Label>
                  <Input
                    type='number'
                    value={checkoutNoSubThreshold}
                    onChange={e => setCheckoutNoSubThreshold(parseInt(e.target.value, 10) || 15)}
                    min={1}
                  />
                </div>
                <div className='flex flex-col gap-2'>
                  <Label>Processing Lag Threshold (min)</Label>
                  <Input
                    type='number'
                    value={processingLagThreshold}
                    onChange={e => setProcessingLagThreshold(parseInt(e.target.value, 10) || 10)}
                    min={1}
                  />
                </div>
                <div className='flex flex-col gap-2'>
                  <Label>Options</Label>
                  <div className='flex items-center gap-2'>
                    <Checkbox
                      id='checkStripe'
                      checked={checkStripe}
                      onCheckedChange={checked => setCheckStripe(checked === true)}
                    />
                    <Label htmlFor='checkStripe' className='font-normal'>
                      Check Stripe API
                    </Label>
                  </div>
                  {checkStripe && (
                    <p className='text-warning text-xs'>Note: This makes API calls to Stripe</p>
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
              <div className='border-destructive/30 bg-destructive/10 rounded-lg border p-4'>
                <p className='text-muted-foreground text-sm'>Critical</p>
                <p className='text-destructive text-2xl font-bold'>
                  {stuckStates.filter(s => s.severity === 'critical').length}
                </p>
              </div>
              <div className='border-warning-border bg-warning-bg rounded-lg border p-4'>
                <p className='text-muted-foreground text-sm'>High</p>
                <p className='text-warning text-2xl font-bold'>
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
                  const variant = getSeverityVariant(state.severity);
                  return (
                    <Alert key={idx} variant={variant} className='border-2'>
                      <Icon />
                      <div className='flex-1'>
                        <div className='flex items-center gap-2'>
                          <AlertTitle>{state.type.replace(/_/g, ' ')}</AlertTitle>
                          <Badge variant={variant}>{state.severity}</Badge>
                        </div>
                        <AlertDescription className='mt-2'>{state.description}</AlertDescription>
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
                              className='text-primary hover:text-primary/80'
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
                              className='text-primary hover:text-primary/80'
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
                    </Alert>
                  );
                })}
              </div>
            : <Alert variant='success' className='py-8 text-center'>
                <div className='flex w-full flex-col items-center'>
                  <CheckCircleIcon className='text-success mb-4 size-12' />
                  <p className='text-success text-lg font-medium'>No stuck states found</p>
                  <p className='text-success text-sm'>
                    All billing states are healthy for this organization
                  </p>
                </div>
              </Alert>
            }

            {/* Stripe Comparison */}
            {reconcileData.stripeComparison && (
              <div className='border-border bg-muted mt-6 rounded-lg border p-4'>
                <h3 className='text-foreground mb-3 font-semibold'>Stripe API Comparison</h3>
                {reconcileData.stripeComparison.error ?
                  <p className='text-destructive text-sm'>
                    Error: {reconcileData.stripeComparison.error}
                  </p>
                : reconcileData.stripeComparison.noActiveSubscription ?
                  <p className='text-muted-foreground text-sm'>No active subscription to compare</p>
                : <div className='flex flex-col gap-2 text-sm'>
                    <div className='flex items-center gap-2'>
                      <span className='font-medium'>Status Match:</span>
                      {reconcileData.stripeComparison.match ?
                        <CheckCircleIcon className='text-success size-4' />
                      : <AlertTriangleIcon className='text-destructive size-4' />}
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
