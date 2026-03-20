/**
 * SubscriptionCard - Subscription status with trial/alerts
 */

import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import {
  CreditCardIcon,
  CalendarIcon,
  AlertCircleIcon,
  ClockIcon,
  ArrowRightIcon,
  ZapIcon,
  LoaderIcon,
} from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { useMembers } from '@/hooks/useMembers';

function getDaysRemaining(endTimestamp: number | undefined) {
  if (!endTimestamp) return null;
  const end = new Date(endTimestamp * 1000);
  const diff = end.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function formatDate(timestamp: number | undefined) {
  if (!timestamp) return null;
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  trialing: 'bg-blue-50 text-blue-700 border-blue-200',
  past_due: 'bg-red-50 text-red-700 border-red-200',
  canceled: 'bg-gray-50 text-gray-700 border-gray-200',
  incomplete: 'bg-amber-50 text-amber-700 border-amber-200',
  unpaid: 'bg-red-50 text-red-700 border-red-200',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  trialing: 'Trial',
  past_due: 'Past Due',
  canceled: 'Canceled',
  incomplete: 'Incomplete',
  unpaid: 'Unpaid',
};

interface SubscriptionCardProps {
  subscription: any;
  onManage: () => void;
  manageLoading: boolean;
}

export function SubscriptionCard({ subscription, onManage, manageLoading }: SubscriptionCardProps) {
  const sub = subscription || {};
  const tierInfo = sub.tierInfo || { name: 'Free', description: 'Free tier' };
  const status = sub.status || 'active';
  const isTrial = status === 'trialing';
  const isFree = sub.tier === 'free';
  const willCancel = sub.cancelAtPeriodEnd;

  const daysRemaining = useMemo(
    () => getDaysRemaining(sub.currentPeriodEnd),
    [sub.currentPeriodEnd],
  );
  const periodEndDate = useMemo(() => formatDate(sub.currentPeriodEnd), [sub.currentPeriodEnd]);

  const { memberCount } = useMembers();

  return (
    <Card className='py-0'>
      {/* Header */}
      <div className='from-primary to-primary/90 relative bg-gradient-to-r px-6 py-5'>
        <div className='flex items-start justify-between'>
          <div className='flex items-center gap-3'>
            <h2 className='text-xl font-bold text-white'>{tierInfo.name}</h2>
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_STYLES[status] || STATUS_STYLES.active}`}
            >
              {STATUS_LABELS[status] || 'Active'}
            </span>
          </div>
        </div>
        {isTrial && daysRemaining !== null && (
          <div
            className={`mt-4 flex items-center gap-2 rounded-lg px-3 py-2 backdrop-blur-sm ${daysRemaining <= 3 ? 'bg-amber-500/20' : 'bg-white/10'}`}
          >
            <ClockIcon
              className={`size-4 ${daysRemaining <= 3 ? 'text-amber-200' : 'text-blue-200'}`}
            />
            <span className='text-sm font-medium text-white'>
              {daysRemaining} days remaining in trial
              {daysRemaining <= 3 && ' - upgrade soon!'}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <CardContent className='p-6'>
        {/* Alerts */}
        {status === 'past_due' && (
          <Alert variant='destructive' className='mb-4'>
            <AlertCircleIcon />
            <div>
              <AlertTitle>Payment failed</AlertTitle>
              <AlertDescription>
                Please update your payment method to continue using premium features.
              </AlertDescription>
            </div>
          </Alert>
        )}
        {willCancel && (
          <Alert variant='warning' className='mb-4'>
            <AlertCircleIcon />
            <div>
              <AlertTitle>Subscription ending</AlertTitle>
              <AlertDescription>
                Your subscription will end on {periodEndDate}. You&apos;ll be downgraded to the Free
                plan.
              </AlertDescription>
            </div>
          </Alert>
        )}
        {isTrial && daysRemaining !== null && daysRemaining <= 3 && (
          <Alert variant='warning' className='mb-4'>
            <ClockIcon />
            <div>
              <AlertTitle>Trial ending soon</AlertTitle>
              <AlertDescription>
                Your trial ends in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}. Upgrade now
                to keep your projects and data.
              </AlertDescription>
              <Link
                to='/settings/plans'
                className='mt-2 inline-flex items-center gap-1 text-sm font-medium text-amber-700 hover:text-amber-800'
              >
                View upgrade options
                <ArrowRightIcon className='size-4' />
              </Link>
            </div>
          </Alert>
        )}

        {/* Details */}
        {!isFree && (
          <div className='mb-6 flex flex-col gap-3'>
            {sub.currentPeriodEnd && !willCancel && (
              <div className='flex items-center justify-between text-sm'>
                <span className='text-muted-foreground flex items-center gap-2'>
                  <CalendarIcon className='size-4' />
                  {isTrial ? 'Trial ends' : 'Next billing date'}
                </span>
                <span className='text-foreground font-medium'>{periodEndDate}</span>
              </div>
            )}
            {memberCount > 0 && (
              <div className='flex items-center justify-between text-sm'>
                <span className='text-muted-foreground'>Team members</span>
                <span className='text-foreground font-medium'>{memberCount}</span>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className='flex flex-wrap gap-3'>
          {isFree ?
            <Link
              to='/settings/plans'
              className='bg-primary text-primary-foreground hover:bg-primary/90 inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm transition-all hover:shadow-md'
            >
              <ZapIcon className='size-4' />
              Upgrade Now
            </Link>
          : <>
              <button
                type='button'
                className='border-border bg-card text-foreground hover:bg-muted inline-flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors'
                onClick={onManage}
                disabled={manageLoading}
              >
                {manageLoading ?
                  <>
                    <LoaderIcon className='size-4 animate-spin' />
                    Loading...
                  </>
                : <>
                    <CreditCardIcon className='size-4' />
                    Manage Billing
                  </>
                }
              </button>
              <Link
                to='/settings/plans'
                className='text-primary hover:bg-primary/5 inline-flex items-center gap-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors'
              >
                Change Plan
                <ArrowRightIcon className='size-4' />
              </Link>
            </>
          }
        </div>
      </CardContent>
    </Card>
  );
}
