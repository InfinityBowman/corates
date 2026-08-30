/** The Plan section of the billing page. */

import { useMemo, type ComponentProps } from 'react';
import { Link } from '@tanstack/react-router';
import { CreditCardIcon, AlertCircleIcon, ClockIcon, ArrowRightIcon, ZapIcon } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useMembers } from '@/hooks/useMembers';
import { SettingsSection, SettingsRow } from '@/components/settings/primitives';

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

const STATUS_VARIANTS: Record<string, ComponentProps<typeof Badge>['variant']> = {
  active: 'success',
  trialing: 'info',
  past_due: 'warning',
  canceled: 'secondary',
  incomplete: 'warning',
  unpaid: 'warning',
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

  const alerts = (
    <>
      {status === 'past_due' && (
        <Alert variant='destructive'>
          <AlertCircleIcon />
          <div>
            <AlertTitle>Payment failed</AlertTitle>
            <AlertDescription>
              Update your payment method to keep your paid features.
            </AlertDescription>
          </div>
        </Alert>
      )}
      {willCancel && (
        <Alert variant='warning'>
          <AlertCircleIcon />
          <div>
            <AlertTitle>Subscription ending</AlertTitle>
            <AlertDescription>
              Your subscription ends on {periodEndDate}, after which you move to the Free plan.
            </AlertDescription>
          </div>
        </Alert>
      )}
      {isTrial && daysRemaining !== null && daysRemaining <= 3 && (
        <Alert variant='warning'>
          <ClockIcon />
          <div>
            <AlertTitle>Trial ending soon</AlertTitle>
            <AlertDescription>
              Your trial ends in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}. Upgrade to
              keep your projects and data.
            </AlertDescription>
            <Link
              to='/settings/plans'
              className='text-warning-foreground mt-2 inline-flex items-center gap-1 text-sm font-medium hover:underline'
            >
              See upgrade options
              <ArrowRightIcon className='size-4' />
            </Link>
          </div>
        </Alert>
      )}
    </>
  );

  const hasAlert =
    status === 'past_due' ||
    willCancel ||
    (isTrial && daysRemaining !== null && daysRemaining <= 3);

  return (
    <SettingsSection
      title='Plan'
      icon={CreditCardIcon}
      action={
        <Badge variant={STATUS_VARIANTS[status] || STATUS_VARIANTS.active}>
          {STATUS_LABELS[status] || 'Active'}
        </Badge>
      }
    >
      {hasAlert && <div className='flex flex-col gap-3 p-4'>{alerts}</div>}

      <SettingsRow
        label={<h3 className='text-base font-semibold'>{tierInfo.name}</h3>}
        description={tierInfo.description}
      >
        {isFree ?
          <Button asChild>
            <Link to='/settings/plans'>
              <ZapIcon className='size-4' />
              Upgrade
            </Link>
          </Button>
        : <Button variant='outline' onClick={onManage} disabled={manageLoading}>
            {manageLoading ?
              <Spinner size='sm' variant='current' />
            : <CreditCardIcon className='size-4' />}
            {manageLoading ? 'Opening...' : 'Manage billing'}
          </Button>
        }
      </SettingsRow>

      {!isFree && sub.currentPeriodEnd && !willCancel && (
        <SettingsRow label={isTrial ? 'Trial ends' : 'Next billing date'}>
          <span className='text-foreground text-sm'>{periodEndDate}</span>
        </SettingsRow>
      )}

      {!isFree && isTrial && daysRemaining !== null && daysRemaining > 3 && (
        <SettingsRow label='Trial remaining'>
          <span className='text-foreground text-sm'>
            {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}
          </span>
        </SettingsRow>
      )}

      {!isFree && memberCount > 0 && (
        <SettingsRow label='Team members'>
          <span className='text-foreground text-sm'>{memberCount}</span>
        </SettingsRow>
      )}
    </SettingsSection>
  );
}
