/** Current plan row for the navbar user menu. */

import { Link } from '@tanstack/react-router';
import { Badge } from '@/components/ui/badge';
import { useSubscription } from '@/hooks/useSubscription';

const PAYMENT_ISSUE_STATUSES = ['past_due', 'incomplete', 'unpaid'];

function getDaysRemaining(endTimestamp: number | null) {
  if (!endTimestamp) return null;
  const diff = endTimestamp * 1000 - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function PlanBadge() {
  const { subscription, tier, tierInfo, status, isLoading, subscriptionFetchFailed } =
    useSubscription();

  if (isLoading || subscriptionFetchFailed) return null;

  const isTrial = status === 'trialing';
  const variant =
    isTrial ? 'info'
    : PAYMENT_ISSUE_STATUSES.includes(status) ? 'warning'
    : 'secondary';
  const daysLeft = isTrial ? getDaysRemaining(subscription.currentPeriodEnd) : null;
  const showUpgrade = tier === 'free' || isTrial;

  return (
    <div className='mt-1.5 flex items-center justify-between gap-2 font-normal'>
      <Link to='/settings/billing' className='flex items-center gap-1.5'>
        <Badge variant={variant}>{tierInfo.name}</Badge>
        {daysLeft !== null && (
          <span className='text-muted-foreground text-xs'>
            {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
          </span>
        )}
      </Link>
      {showUpgrade && (
        <Link to='/settings/plans' className='text-primary text-xs hover:underline'>
          Upgrade
        </Link>
      )}
    </div>
  );
}
