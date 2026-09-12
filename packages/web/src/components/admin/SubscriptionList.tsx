import { PencilIcon, XCircleIcon } from 'lucide-react';
import { AdminEmpty, AdminPanel, CopyButton } from '@/components/admin/ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/lib/formatDate';
import type { AdminOrgSubscription } from '@/server/functions/admin-orgs.server';

interface SubscriptionListProps {
  subscriptions?: AdminOrgSubscription[];
  effectiveSubscriptionId?: string;
  loading?: boolean;
  isLoading?: boolean;
  onCancel: (_subscriptionId: string) => void;
  onEdit: (_subscription: AdminOrgSubscription) => void;
}

function StripeId({ label, value }: { label: string; value: string }) {
  return (
    <span className='bg-muted text-muted-foreground inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs'>
      {label}
      <code className='text-foreground font-mono'>{value.slice(0, 14)}...</code>
      <CopyButton text={value} label={label} />
    </span>
  );
}

export function SubscriptionList({
  subscriptions: subscriptionsProp,
  effectiveSubscriptionId,
  loading,
  isLoading,
  onCancel,
  onEdit,
}: SubscriptionListProps) {
  const subscriptions = subscriptionsProp || [];

  return (
    <AdminPanel title='Subscriptions' bodyClassName='divide-border divide-y'>
      {isLoading ?
        <div className='p-4'>
          <Skeleton className='h-24 w-full' />
        </div>
      : subscriptions.length === 0 ?
        <AdminEmpty title='No subscriptions' />
      : subscriptions.map(subscription => {
          const isEffective =
            !!effectiveSubscriptionId && subscription.id === effectiveSubscriptionId;
          return (
            <div key={subscription.id} className='flex items-start justify-between gap-4 px-4 py-3'>
              <div className='min-w-0'>
                <div className='flex flex-wrap items-center gap-2'>
                  <p className='text-foreground text-[13px] font-medium'>{subscription.plan}</p>
                  <Badge
                    variant={
                      subscription.status === 'active' || subscription.status === 'trialing' ?
                        'success'
                      : 'secondary'
                    }
                  >
                    {subscription.status}
                  </Badge>
                  {isEffective && <Badge variant='info'>Effective</Badge>}
                  {subscription.cancelAtPeriodEnd && (
                    <Badge variant='warning'>Cancels at period end</Badge>
                  )}
                </div>
                <p className='text-muted-foreground mt-1 text-xs'>
                  {formatDateTime(subscription.periodStart)} -{' '}
                  {formatDateTime(subscription.periodEnd)}
                  {subscription.canceledAt &&
                    ` - canceled ${formatDateTime(subscription.canceledAt)}`}
                  {subscription.endedAt && ` - ended ${formatDateTime(subscription.endedAt)}`}
                </p>
                {(subscription.stripeCustomerId || subscription.stripeSubscriptionId) && (
                  <div className='mt-2 flex flex-wrap gap-1.5'>
                    {subscription.stripeCustomerId && (
                      <StripeId label='Customer' value={subscription.stripeCustomerId} />
                    )}
                    {subscription.stripeSubscriptionId && (
                      <StripeId
                        label='AdminOrgSubscription'
                        value={subscription.stripeSubscriptionId}
                      />
                    )}
                  </div>
                )}
              </div>
              <div className='flex shrink-0 items-center gap-1'>
                <Button
                  variant='ghost'
                  size='icon-sm'
                  onClick={() => onEdit(subscription)}
                  disabled={loading}
                  className='text-muted-foreground/70 hover:text-foreground'
                  aria-label='Edit subscription'
                >
                  <PencilIcon />
                </Button>
                <Button
                  variant='ghost'
                  size='icon-sm'
                  onClick={() => onCancel(subscription.id)}
                  disabled={loading}
                  className='text-muted-foreground/70 hover:text-destructive'
                  aria-label='Cancel subscription'
                >
                  <XCircleIcon />
                </Button>
              </div>
            </div>
          );
        })
      }
    </AdminPanel>
  );
}
