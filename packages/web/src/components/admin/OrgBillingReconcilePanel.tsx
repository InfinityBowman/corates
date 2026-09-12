import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { AlertTriangleIcon, CheckCircleIcon, RefreshCwIcon, AlertCircleIcon } from 'lucide-react';
import { useAdminOrgBillingReconcile } from '@/hooks/useAdminQueries';
import { AdminPanel, AdminStat } from '@/components/admin/ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

const getSeverityIcon = (severity: string | undefined) => {
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

const getSeverityVariant = (severity: string | undefined) => {
  switch (severity) {
    case 'critical':
      return 'destructive' as const;
    case 'high':
    case 'medium':
      return 'warning' as const;
    default:
      return 'default' as const;
  }
};

function ThresholdField({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value: number;
  fallback: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className='flex flex-col gap-1.5'>
      <Label className='text-xs'>{label}</Label>
      <Input
        type='number'
        value={value}
        onChange={e => onChange(parseInt(e.target.value, 10) || fallback)}
        min={1}
      />
    </div>
  );
}

export function OrgBillingReconcilePanel({
  orgId,
  onHide,
}: {
  orgId: string;
  onHide?: () => void;
}) {
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

  const reconcileData = reconcileQuery.data;
  const stuckStates = reconcileData?.stuckStates ?? [];
  const summary = reconcileData?.summary;
  const isLoading = reconcileQuery.isLoading;

  return (
    <AdminPanel
      title='Billing Reconciliation'
      padded
      action={
        <>
          {onHide && (
            <Button variant='ghost' size='sm' onClick={onHide}>
              Hide
            </Button>
          )}
          <Button
            variant='outline'
            size='sm'
            onClick={() => reconcileQuery.refetch()}
            disabled={reconcileQuery.isFetching}
          >
            <RefreshCwIcon
              className={reconcileQuery.isFetching ? 'animate-spin' : ''}
              data-icon='inline-start'
            />
            Refresh
          </Button>
        </>
      }
    >
      <div className='border-border bg-muted/40 mb-5 grid grid-cols-1 gap-4 rounded-lg border p-4 md:grid-cols-4'>
        <ThresholdField
          label='Incomplete threshold (min)'
          value={incompleteThreshold}
          fallback={30}
          onChange={setIncompleteThreshold}
        />
        <ThresholdField
          label='Checkout no sub threshold (min)'
          value={checkoutNoSubThreshold}
          fallback={15}
          onChange={setCheckoutNoSubThreshold}
        />
        <ThresholdField
          label='Processing lag threshold (min)'
          value={processingLagThreshold}
          fallback={5}
          onChange={setProcessingLagThreshold}
        />
        <div className='flex flex-col gap-1.5'>
          <Label className='text-xs'>Options</Label>
          <div className='flex h-8 items-center gap-2'>
            <Checkbox
              id='checkStripe'
              checked={checkStripe}
              onCheckedChange={checked => setCheckStripe(checked === true)}
            />
            <Label htmlFor='checkStripe' className='text-[13px] font-normal'>
              Call the Stripe API
            </Label>
          </div>
        </div>
      </div>

      <div className='mb-5 grid grid-cols-2 gap-3 md:grid-cols-5'>
        <AdminStat label='Total stuck' value={summary?.stuckStateCount ?? 0} loading={isLoading} />
        <AdminStat
          label='Critical'
          value={stuckStates.filter(s => s.severity === 'critical').length}
          tone='destructive'
          loading={isLoading}
        />
        <AdminStat
          label='High'
          value={stuckStates.filter(s => s.severity === 'high').length}
          tone='warning'
          loading={isLoading}
        />
        <AdminStat
          label='Failed webhooks'
          value={summary?.failedWebhooks ?? 0}
          loading={isLoading}
        />
        <AdminStat
          label='Ignored webhooks'
          value={summary?.ignoredWebhooks ?? 0}
          loading={isLoading}
        />
      </div>

      {!isLoading &&
        (stuckStates.length > 0 ?
          <div className='flex flex-col gap-3'>
            {stuckStates.map((state, idx) => {
              const Icon = getSeverityIcon(state.severity);
              const variant = getSeverityVariant(state.severity);
              return (
                <Alert key={idx} variant={variant}>
                  <Icon />
                  <div className='flex-1'>
                    <div className='flex items-center gap-2'>
                      <AlertTitle>{state.type.replace(/_/g, ' ')}</AlertTitle>
                      <Badge variant={variant}>{state.severity}</Badge>
                    </div>
                    <AlertDescription className='mt-1'>{state.description}</AlertDescription>
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
                        <span>Stripe subscription:</span>
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
                          search={{ type: 'checkout.session.completed' } as Record<string, string>}
                          className='text-primary hover:text-primary/80'
                        >
                          View in ledger
                        </Link>
                      </div>
                    )}
                    {state.localStatus && state.stripeStatus && (
                      <p className='mt-1 text-xs opacity-75'>
                        Status mismatch: local={state.localStatus}, Stripe={state.stripeStatus}
                      </p>
                    )}
                  </div>
                </Alert>
              );
            })}
          </div>
        : <p className='text-muted-foreground py-2 text-[13px]'>
            No stuck states. Billing is healthy for this organization.
          </p>)}

      {reconcileData?.stripeComparison && (
        <div className='border-border bg-muted/40 mt-5 rounded-lg border p-4'>
          <h3 className='text-foreground mb-2 text-[13px] font-medium'>Stripe API comparison</h3>
          {reconcileData.stripeComparison.error ?
            <p className='text-destructive text-[13px]'>
              Error: {reconcileData.stripeComparison.error}
            </p>
          : reconcileData.stripeComparison.noActiveSubscription ?
            <p className='text-muted-foreground text-[13px]'>No active subscription to compare</p>
          : <div className='flex flex-col gap-1 text-[13px]'>
              <div className='flex items-center gap-2'>
                <span className='font-medium'>Status match:</span>
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
    </AdminPanel>
  );
}
