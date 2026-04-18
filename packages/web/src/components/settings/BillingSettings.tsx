/**
 * BillingSettings - Subscription, usage, and invoices dashboard
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { CheckCircleIcon, ArrowRightIcon, XCircleIcon } from 'lucide-react';
import { Alert, AlertAction, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useSubscription } from '@/hooks/useSubscription';
import { useMembers } from '@/hooks/useMembers';
import { redirectToPortal } from '@/api/billing';
import { API_BASE } from '@/config/api';
import { queryKeys } from '@/lib/queryKeys';
import { Skeleton } from '@/components/ui/skeleton';
import { SubscriptionCard } from '@/components/billing/SubscriptionCard';
import { UsageCard } from '@/components/billing/UsageCard';
import { InvoicesList } from '@/components/billing/InvoicesList';
import { PaymentIssueBanner } from '@/components/billing/PaymentIssueBanner';

function SubscriptionSkeleton() {
  return (
    <div className='border-border bg-card overflow-hidden rounded-xl border'>
      <div className='from-muted to-muted/80 h-28 bg-linear-to-r' />
      <div className='p-6'>
        <div className='mb-4 flex flex-col gap-3'>
          <Skeleton className='h-4 w-1/2' />
          <Skeleton className='h-4 w-1/3' />
        </div>
        <div className='flex gap-3'>
          <Skeleton className='h-10 flex-1 rounded-lg' />
          <Skeleton className='h-10 w-28 rounded-lg' />
        </div>
      </div>
    </div>
  );
}

function UsageSkeleton() {
  return (
    <div className='border-border bg-card rounded-xl border p-6'>
      <Skeleton className='mb-5 h-6 w-20' />
      <div className='flex flex-col gap-5'>
        <div className='flex flex-col gap-2'>
          <div className='flex justify-between'>
            <Skeleton className='h-4 w-24' />
            <Skeleton className='h-4 w-12' />
          </div>
          <Skeleton className='h-2 w-full rounded-full' />
        </div>
      </div>
    </div>
  );
}

export function BillingSettings() {
  const { subscription, loading, refetch, quotas } = useSubscription();
  useMembers();
  const [portalLoading, setPortalLoading] = useState(false);

  const usageQuery = useQuery({
    queryKey: queryKeys.billing.usage,
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/billing/usage`, { credentials: 'include' });
      if (!res.ok) throw await res.json();
      return (await res.json()) as { projects: number; collaborators: number };
    },
    staleTime: 1000 * 60 * 2,
    retry: 1,
  });

  const [checkoutOutcome, setCheckoutOutcome] = useState<'success' | 'canceled' | null>(null);

  // Handle checkout redirect params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      setCheckoutOutcome('success');
      // Beat the webhook race: pull canonical subscription state from Stripe
      // before reading it from the DB. Failure is non-fatal — the webhook will
      // reconcile eventually.
      fetch(`${API_BASE}/api/billing/sync-after-success`, {
        method: 'POST',
        credentials: 'include',
      })
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
      setCheckoutOutcome('canceled');
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

  const usage = useMemo(
    () => usageQuery.data ?? { projects: 0, collaborators: 0 },
    [usageQuery.data],
  );
  const subscriptionStatus = subscription?.status || 'active';

  return (
    <div className='bg-primary/5 min-h-full py-6'>
      <div className='mx-auto max-w-6xl px-4 sm:px-6 lg:px-8'>
        <div className='mb-8'>
          <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <h1 className='text-foreground text-3xl font-bold'>Billing</h1>
              <p className='text-muted-foreground mt-1'>
                Manage your subscription, view usage, and download invoices.
              </p>
            </div>
            <Link
              to='/settings/plans'
              className='border-border bg-card text-foreground hover:bg-muted inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium shadow-sm transition-all hover:shadow'
            >
              View All Plans
              <ArrowRightIcon className='size-4' />
            </Link>
          </div>
        </div>

        <PaymentIssueBanner
          status={subscriptionStatus}
          onUpdatePayment={handleManageSubscription}
          loading={portalLoading}
        />

        {checkoutOutcome === 'success' && (
          <Alert variant='success' className='mb-6'>
            <CheckCircleIcon />
            <div>
              <AlertTitle>Payment successful!</AlertTitle>
              <AlertDescription>Your subscription has been activated.</AlertDescription>
            </div>
            <AlertAction>
              <button
                type='button'
                onClick={() => setCheckoutOutcome(null)}
                className='text-success hover:text-success/80'
                aria-label='Dismiss'
              >
                <XCircleIcon className='size-5' />
              </button>
            </AlertAction>
          </Alert>
        )}

        {checkoutOutcome === 'canceled' && (
          <Alert variant='warning' className='mb-6'>
            <XCircleIcon />
            <div>
              <AlertTitle>Checkout canceled</AlertTitle>
              <AlertDescription>No changes were made to your subscription.</AlertDescription>
            </div>
            <AlertAction>
              <button
                type='button'
                onClick={() => setCheckoutOutcome(null)}
                className='text-warning hover:text-warning-foreground'
                aria-label='Dismiss'
              >
                <XCircleIcon className='size-5' />
              </button>
            </AlertAction>
          </Alert>
        )}

        <div className='grid gap-6 lg:grid-cols-3'>
          <div className='flex flex-col gap-6 lg:col-span-2'>
            {loading ?
              <SubscriptionSkeleton />
            : <SubscriptionCard
                subscription={subscription}
                onManage={handleManageSubscription}
                manageLoading={portalLoading}
              />
            }
            <InvoicesList />
          </div>

          <div className='flex flex-col gap-6'>
            {loading ?
              <UsageSkeleton />
            : <UsageCard quotas={quotas as Record<string, number> | null} usage={usage} />}

            <div className='border-border bg-card rounded-lg border p-4'>
              <p className='text-muted-foreground text-sm'>
                Need help with billing?{' '}
                <a href='/contact' className='text-primary hover:text-primary/80 font-medium'>
                  Contact support
                </a>{' '}
                and we&apos;ll get back to you within 24 hours.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
