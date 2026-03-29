/**
 * Subscription List component
 * Displays and manages subscriptions for an organization
 */

import { useState } from 'react';
import { Trash2Icon, PencilIcon, CopyIcon, CheckIcon } from 'lucide-react';
import { showToast } from '@/components/ui/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

interface Subscription {
  id: string;
  plan: string;
  status: string;
  periodStart?: string | number | Date;
  periodEnd?: string | number | Date;
  cancelAtPeriodEnd?: boolean;
  createdAt?: string | number | Date;
  updatedAt?: string | number | Date | null;
  canceledAt?: string | number | Date | null;
  endedAt?: string | number | Date | null;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

interface SubscriptionListProps {
  subscriptions?: Subscription[];
  effectiveSubscriptionId?: string;
  loading?: boolean;
  isLoading?: boolean;
  onCancel: (_subscriptionId: string) => void;
  onEdit: (_subscription: Subscription) => void;
}

const formatDate = (timestamp: string | number | Date | null | undefined): string => {
  if (!timestamp) return '-';
  const date =
    timestamp instanceof Date ? timestamp
    : typeof timestamp === 'string' ? new Date(timestamp)
    : new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export function SubscriptionList({
  subscriptions: subscriptionsProp,
  effectiveSubscriptionId,
  loading,
  isLoading,
  onCancel,
  onEdit,
}: SubscriptionListProps) {
  const subscriptions = subscriptionsProp || [];
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyId = async (id: string, type: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(`${type}-${id}`);
      showToast.success('Copied', `${type} ID copied to clipboard`);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (_error) {
      showToast.error('Error', 'Failed to copy to clipboard');
    }
  };

  const isEffective = (subscription: Subscription): boolean => {
    return !!effectiveSubscriptionId && subscription.id === effectiveSubscriptionId;
  };

  return (
    <div className='border-border bg-card rounded-lg border'>
      <div className='border-border border-b px-6 py-4'>
        <h2 className='text-foreground text-lg font-semibold'>Subscriptions</h2>
      </div>
      {isLoading ?
        <div className='flex items-center justify-center py-12'>
          <Spinner size='lg' />
        </div>
      : <div className='p-6'>
          {subscriptions.length > 0 ?
            <div className='flex flex-col gap-4'>
              {subscriptions.map(subscription => (
                <div
                  key={subscription.id}
                  className={`rounded-lg border p-4 ${
                    isEffective(subscription) ?
                      'border-primary/30 bg-primary/5'
                    : 'border-border bg-card'
                  }`}
                >
                  <div className='flex items-start justify-between'>
                    <div className='flex-1'>
                      <div className='flex items-center gap-2'>
                        <p className='text-foreground font-medium'>{subscription.plan}</p>
                        <Badge
                          variant={
                            subscription.status === 'active' || subscription.status === 'trialing' ?
                              'success'
                            : 'secondary'
                          }
                        >
                          {subscription.status}
                        </Badge>
                        {isEffective(subscription) && <Badge variant='info'>Effective</Badge>}
                      </div>
                      <div className='text-muted-foreground mt-2 grid grid-cols-1 gap-3 text-sm md:grid-cols-2'>
                        <div className='flex flex-col gap-1'>
                          <p>Period Start: {formatDate(subscription.periodStart)}</p>
                          <p>Period End: {formatDate(subscription.periodEnd)}</p>
                          {subscription.cancelAtPeriodEnd && (
                            <p className='text-warning'>Cancels at period end</p>
                          )}
                        </div>
                        <div className='flex flex-col gap-1'>
                          <p>Created: {formatDate(subscription.createdAt)}</p>
                          {subscription.updatedAt && (
                            <p>Updated: {formatDate(subscription.updatedAt)}</p>
                          )}
                          {subscription.canceledAt && (
                            <p className='text-destructive'>
                              Canceled: {formatDate(subscription.canceledAt)}
                            </p>
                          )}
                          {subscription.endedAt && (
                            <p className='text-destructive'>
                              Ended: {formatDate(subscription.endedAt)}
                            </p>
                          )}
                        </div>
                      </div>
                      {/* Stripe IDs */}
                      {(subscription.stripeCustomerId || subscription.stripeSubscriptionId) && (
                        <div className='mt-3 flex flex-wrap gap-2'>
                          {subscription.stripeCustomerId && (
                            <div className='bg-secondary flex items-center gap-1 rounded px-2 py-1'>
                              <span className='text-muted-foreground text-xs font-medium'>
                                Customer:
                              </span>
                              <code className='text-foreground font-mono text-xs'>
                                {subscription.stripeCustomerId.slice(0, 12)}...
                              </code>
                              <button
                                onClick={() =>
                                  handleCopyId(subscription.stripeCustomerId!, 'customer')
                                }
                                className='text-muted-foreground hover:text-secondary-foreground ml-1'
                                title='Copy customer ID'
                              >
                                {copiedId === `customer-${subscription.stripeCustomerId}` ?
                                  <CheckIcon className='text-success size-3' />
                                : <CopyIcon className='size-3' />}
                              </button>
                            </div>
                          )}
                          {subscription.stripeSubscriptionId && (
                            <div className='bg-secondary flex items-center gap-1 rounded px-2 py-1'>
                              <span className='text-muted-foreground text-xs font-medium'>
                                Subscription:
                              </span>
                              <code className='text-foreground font-mono text-xs'>
                                {subscription.stripeSubscriptionId.slice(0, 12)}...
                              </code>
                              <button
                                onClick={() =>
                                  handleCopyId(subscription.stripeSubscriptionId!, 'subscription')
                                }
                                className='text-muted-foreground hover:text-secondary-foreground ml-1'
                                title='Copy subscription ID'
                              >
                                {copiedId === `subscription-${subscription.stripeSubscriptionId}` ?
                                  <CheckIcon className='text-success size-3' />
                                : <CopyIcon className='size-3' />}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className='ml-4 flex gap-2'>
                      <Button
                        variant='outline'
                        size='icon'
                        onClick={() => onEdit?.(subscription)}
                        disabled={loading}
                        aria-label='Edit subscription'
                      >
                        <PencilIcon />
                      </Button>
                      <Button
                        variant='outline'
                        size='icon'
                        onClick={() => onCancel?.(subscription.id)}
                        disabled={loading}
                        className='border-destructive/30 text-destructive hover:bg-destructive/10'
                        aria-label='Cancel subscription'
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          : <p className='text-muted-foreground text-sm'>No subscriptions</p>}
        </div>
      }
    </div>
  );
}
