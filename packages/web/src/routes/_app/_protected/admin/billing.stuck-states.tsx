import { useState, useMemo } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { CheckCircleIcon, RefreshCwIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAdminBillingStuckStates } from '@/hooks/useAdminQueries';
import { AdminEmpty, AdminPage, AdminPanel } from '@/components/admin/ui';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/lib/formatDate';

interface StuckOrg {
  type: string;
  orgId: string;
  description?: string;
  ageMinutes?: number;
  subscriptionId?: string;
  stripeSubscriptionId?: string;
  stripeEventId?: string;
  failedCount?: number;
}

const TYPE_LABELS: Record<string, string> = {
  incomplete_subscription: 'Incomplete subscription',
  checkout_no_subscription: 'Checkout without subscription',
  repeated_failures: 'Repeated failures',
  past_due_expired: 'Past due expired',
};

const INVESTIGATION_STEPS: Record<string, string[]> = {
  checkout_no_subscription: [
    'Verify Better Auth Stripe plugin configuration',
    'Check authorizeReference function for this org',
    'Verify referenceId/orgId mapping matches',
    'Check Stripe dashboard for subscription creation',
  ],
  incomplete_subscription: [
    'Check Stripe dashboard for payment failures',
    'Verify customer payment method is valid',
    'Check webhook delivery logs for errors',
  ],
  repeated_failures: [
    'Review recent webhook error messages in ledger',
    'Check for API changes or configuration issues',
    'Verify webhook endpoint is accessible',
  ],
};

const DEFAULT_STEPS = ['Review billing state and recent events'];

export const Route = createFileRoute('/_app/_protected/admin/billing/stuck-states')({
  component: AdminBillingStuckStatesPage,
});

function AdminBillingStuckStatesPage() {
  const [incompleteThreshold, setIncompleteThreshold] = useState(30);

  const stuckStatesQuery = useAdminBillingStuckStates({
    incompleteThreshold,
    limit: 50,
  });

  const data = stuckStatesQuery.data as
    { stuckOrgs: StuckOrg[]; checkedAt?: string | number } | undefined;
  const stuckOrgs = useMemo(() => data?.stuckOrgs || [], [data?.stuckOrgs]);

  const groupedByType = useMemo(() => {
    const groups: Record<string, StuckOrg[]> = {};
    for (const org of stuckOrgs) {
      (groups[org.type] ??= []).push(org);
    }
    return groups;
  }, [stuckOrgs]);

  return (
    <AdminPage
      title='Stuck States'
      description='Organizations whose billing needs attention'
      meta={
        // Always rendered so the header keeps its height once the check lands.
        <span className='text-muted-foreground text-xs'>
          {data?.checkedAt ? `Last checked ${formatDateTime(data.checkedAt)}` : 'Checking...'}
        </span>
      }
      actions={
        <>
          <div className='flex items-center gap-2'>
            <Label htmlFor='threshold' className='text-muted-foreground text-[13px]'>
              Threshold (min)
            </Label>
            <Input
              id='threshold'
              type='number'
              value={incompleteThreshold}
              onChange={e => setIncompleteThreshold(parseInt(e.target.value, 10) || 30)}
              min='1'
              className='w-20 text-[13px]'
            />
          </div>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => stuckStatesQuery.refetch()}
            disabled={stuckStatesQuery.isFetching}
          >
            <RefreshCwIcon
              className={stuckStatesQuery.isFetching ? 'animate-spin' : ''}
              data-icon='inline-start'
            />
            Refresh
          </Button>
        </>
      }
    >
      {stuckStatesQuery.isLoading ?
        <AdminPanel padded>
          <Skeleton className='h-40 w-full' />
        </AdminPanel>
      : stuckOrgs.length === 0 ?
        <AdminPanel>
          <AdminEmpty
            icon={CheckCircleIcon}
            title='No stuck states'
            description='Every organization has a healthy billing state.'
            className='min-h-64'
          />
        </AdminPanel>
      : Object.entries(groupedByType).map(([type, orgs]) => (
          <AdminPanel
            key={type}
            title={
              <span className='flex items-center gap-2'>
                {TYPE_LABELS[type] ?? type}
                <Badge variant='warning'>{orgs.length}</Badge>
              </span>
            }
            bodyClassName='divide-border divide-y'
          >
            {orgs.map(org => (
              <div key={org.orgId} className='px-4 py-3'>
                <div className='flex items-start justify-between gap-4'>
                  <div className='min-w-0'>
                    <Link
                      to={'/admin/orgs/$orgId' as string}
                      params={{ orgId: org.orgId } as Record<string, string>}
                      className='text-foreground hover:text-primary text-[13px] font-medium transition-colors'
                    >
                      <code className='font-mono'>{org.orgId}</code>
                    </Link>
                    {org.ageMinutes != null && (
                      <span className='text-muted-foreground ml-2 text-xs tabular-nums'>
                        {org.ageMinutes} min
                      </span>
                    )}
                    {org.description && (
                      <p className='text-muted-foreground mt-1 text-[13px]'>{org.description}</p>
                    )}
                    <div className='text-muted-foreground/70 mt-1 flex flex-col gap-0.5 text-xs'>
                      {org.subscriptionId && <span>Subscription: {org.subscriptionId}</span>}
                      {org.stripeSubscriptionId && <span>Stripe: {org.stripeSubscriptionId}</span>}
                      {org.stripeEventId && <span>Event: {org.stripeEventId}</span>}
                      {org.failedCount != null && (
                        <span className='text-destructive'>{org.failedCount} webhook failures</span>
                      )}
                    </div>
                  </div>
                  <Button asChild variant='outline' size='sm' className='shrink-0'>
                    <Link
                      to={'/admin/orgs/$orgId' as string}
                      params={{ orgId: org.orgId } as Record<string, string>}
                    >
                      View details
                    </Link>
                  </Button>
                </div>
                <div className='bg-muted/50 mt-3 rounded-md px-3 py-2'>
                  <p className='text-muted-foreground mb-1 text-xs font-medium'>
                    Investigation steps
                  </p>
                  <ul className='text-muted-foreground flex list-inside list-disc flex-col gap-0.5 text-xs'>
                    {(INVESTIGATION_STEPS[type] ?? DEFAULT_STEPS).map(step => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </AdminPanel>
        ))
      }
    </AdminPage>
  );
}
