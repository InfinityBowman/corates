import { useState, useEffect, useCallback } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { CheckCircleIcon, XCircleIcon, CreditCardIcon, TrendingUpIcon } from 'lucide-react';
import { Alert, AlertAction, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/hooks/useSubscription';
import { useMembers } from '@/hooks/useMembers';
import { redirectToPortal } from '@/api/billing';
import { queryKeys } from '@/lib/queryKeys';
import { getUsage, syncAfterSuccess } from '@/server/functions/billing.functions';
import { Skeleton } from '@/components/ui/skeleton';
import { showToast } from '@/lib/toast';
import { SubscriptionCard } from '@/components/billing/SubscriptionCard';
import { UsageCard } from '@/components/billing/UsageCard';
import { InvoicesList } from '@/components/billing/InvoicesList';
import { PaymentIssueBanner } from '@/components/billing/PaymentIssueBanner';
import { SettingsPage, SettingsSection } from './primitives';

function PlanSkeleton() {
  return (
    <SettingsSection title='Plan' icon={CreditCardIcon}>
      <div className='flex flex-col gap-3 p-4'>
        <Skeleton className='h-5 w-32' />
        <Skeleton className='h-4 w-48' />
        <Skeleton className='h-8 w-40' />
      </div>
    </SettingsSection>
  );
}

function UsageSkeleton() {
  return (
    <SettingsSection title='Usage' icon={TrendingUpIcon}>
      <div className='flex flex-col gap-4 p-4'>
        <Skeleton className='h-4 w-full' />
        <Skeleton className='h-4 w-full' />
      </div>
    </SettingsSection>
  );
}

export function BillingSettings() {
  const { subscription, isLoading: loading, refetch, quotas } = useSubscription();
  useMembers();
  const [portalLoading, setPortalLoading] = useState(false);

  const usageQuery = useQuery({
    queryKey: queryKeys.billing.usage,
    queryFn: () => getUsage(),
    staleTime: 1000 * 60 * 2,
    retry: 1,
  });

  const [checkoutOutcome, setCheckoutOutcome] = useState<'success' | null>(null);

  // Handle checkout redirect params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      setCheckoutOutcome('success');
      // Beat the webhook race: pull canonical subscription state from Stripe
      // before reading it from the DB. Failure is non-fatal -- the webhook will
      // reconcile eventually.
      syncAfterSuccess()
        .catch(() => {})
        .finally(() => {
          refetch();
          usageQuery.refetch();
        });
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete('success');
      window.history.replaceState({}, '', url.pathname + url.search);
    } else if (params.get('canceled') === 'true') {
      showToast.warning('Checkout canceled', 'No changes were made to your subscription.');
      const url = new URL(window.location.href);
      url.searchParams.delete('canceled');
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleManageSubscription = useCallback(async () => {
    setPortalLoading(true);
    try {
      await redirectToPortal();
    } catch (error) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(error, { toastTitle: 'Portal Error' });
      setPortalLoading(false);
    }
  }, []);

  const usage = usageQuery.data ?? { projects: 0, collaborators: 0 };
  const subscriptionStatus = subscription?.status || 'active';

  return (
    <SettingsPage
      title='Billing'
      description='Your plan, what it covers, and past invoices.'
      action={
        <Button variant='outline' asChild>
          <Link to='/settings/plans'>Compare plans</Link>
        </Button>
      }
    >
      <PaymentIssueBanner
        status={subscriptionStatus}
        onUpdatePayment={handleManageSubscription}
        loading={portalLoading}
      />

      {checkoutOutcome === 'success' && (
        <Alert variant='success'>
          <CheckCircleIcon />
          <div>
            <AlertTitle>Payment successful!</AlertTitle>
            <AlertDescription>Your subscription has been activated.</AlertDescription>
          </div>
          <AlertAction>
            <Button
              variant='ghost'
              size='icon-sm'
              onClick={() => setCheckoutOutcome(null)}
              className='text-success hover:text-success/80'
              aria-label='Dismiss'
            >
              <XCircleIcon className='size-5' />
            </Button>
          </AlertAction>
        </Alert>
      )}

      {loading ?
        <PlanSkeleton />
      : <SubscriptionCard
          subscription={subscription}
          onManage={handleManageSubscription}
          manageLoading={portalLoading}
        />
      }

      {loading ?
        <UsageSkeleton />
      : <UsageCard quotas={quotas as Record<string, number> | null} usage={usage} />}

      <InvoicesList />

      <p className='text-muted-foreground text-[13px]'>
        Something wrong with a charge?{' '}
        <a href='/contact' className='text-foreground underline underline-offset-4'>
          Contact support
        </a>{' '}
        and we&apos;ll reply within a day.
      </p>
    </SettingsPage>
  );
}
