/**
 * BillingSettings - Subscription, usage, and invoices dashboard
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircleIcon,
  ArrowRightIcon,
  XCircleIcon,
} from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { useMembers } from '@/hooks/useMembers';
import { redirectToPortal } from '@/api/billing.js';
import { apiFetch } from '@/lib/apiFetch.js';
import { queryKeys } from '@/lib/queryKeys.js';
import { SubscriptionCard } from '@/components/billing/SubscriptionCard';
import { UsageCard } from '@/components/billing/UsageCard';
import { InvoicesList } from '@/components/billing/InvoicesList';
import { PaymentIssueBanner } from '@/components/billing/PaymentIssueBanner';

function SubscriptionSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-xl border border-border bg-card">
      <div className="h-28 bg-gradient-to-r from-muted to-muted/80" />
      <div className="p-6">
        <div className="mb-4 space-y-3">
          <div className="bg-muted h-4 w-1/2 rounded" />
          <div className="bg-muted h-4 w-1/3 rounded" />
        </div>
        <div className="flex gap-3">
          <div className="bg-muted h-10 flex-1 rounded-lg" />
          <div className="bg-muted h-10 w-28 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

function UsageSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-border bg-card p-6">
      <div className="bg-muted mb-5 h-6 w-20 rounded" />
      <div className="space-y-5">
        <div className="space-y-2">
          <div className="flex justify-between">
            <div className="bg-muted h-4 w-24 rounded" />
            <div className="bg-muted h-4 w-12 rounded" />
          </div>
          <div className="bg-muted h-2 w-full rounded-full" />
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
    queryFn: () => apiFetch.get('/api/billing/usage', { toastMessage: false }),
    staleTime: 1000 * 60 * 2,
    retry: 1,
  });

  const [checkoutOutcome, setCheckoutOutcome] = useState<'success' | 'canceled' | null>(null);

  // Handle checkout redirect params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      setCheckoutOutcome('success');
      refetch();
      usageQuery.refetch();
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
      const { handleError } = await import('@/lib/error-utils.js');
      await handleError(error, { toastTitle: 'Portal Error' });
      setPortalLoading(false);
    }
  }, []);

  const usage = useMemo(() => usageQuery.data ?? { projects: 0, collaborators: 0 }, [usageQuery.data]);
  const subscriptionStatus = subscription?.status || 'active';

  return (
    <div className="min-h-full bg-primary/5 py-6">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-foreground text-3xl font-bold">Billing</h1>
              <p className="text-muted-foreground mt-1">
                Manage your subscription, view usage, and download invoices.
              </p>
            </div>
            <Link
              to="/settings/plans"
              className="border-border bg-card text-foreground hover:bg-muted inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium shadow-sm transition-all hover:shadow"
            >
              View All Plans
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <PaymentIssueBanner
          status={subscriptionStatus}
          onUpdatePayment={handleManageSubscription}
          loading={portalLoading}
        />

        {checkoutOutcome === 'success' && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-emerald-800">Payment successful!</p>
              <p className="text-sm text-emerald-600">Your subscription has been activated.</p>
            </div>
            <button
              type="button"
              onClick={() => setCheckoutOutcome(null)}
              className="ml-auto text-emerald-600 hover:text-emerald-800"
              aria-label="Dismiss"
            >
              <XCircleIcon className="h-5 w-5" />
            </button>
          </div>
        )}

        {checkoutOutcome === 'canceled' && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
              <XCircleIcon className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-amber-800">Checkout canceled</p>
              <p className="text-sm text-amber-600">No changes were made to your subscription.</p>
            </div>
            <button
              type="button"
              onClick={() => setCheckoutOutcome(null)}
              className="ml-auto text-amber-600 hover:text-amber-800"
              aria-label="Dismiss"
            >
              <XCircleIcon className="h-5 w-5" />
            </button>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {loading ? (
              <SubscriptionSkeleton />
            ) : (
              <SubscriptionCard
                subscription={subscription}
                onManage={handleManageSubscription}
                manageLoading={portalLoading}
              />
            )}
            <InvoicesList />
          </div>

          <div className="space-y-6">
            {loading ? (
              <UsageSkeleton />
            ) : (
              <UsageCard quotas={quotas as Record<string, number> | null} usage={usage} />
            )}

            <div className="border-border bg-card rounded-lg border p-4">
              <p className="text-muted-foreground text-sm">
                Need help with billing?{' '}
                <a
                  href="/contact"
                  className="text-primary hover:text-primary/80 font-medium"
                >
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
