/**
 * PlansSettings - Plan comparison page with FAQ
 */

import { useState, useEffect, useCallback } from 'react';
import { LoaderIcon, AlertCircleIcon, RefreshCwIcon } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { useSubscription } from '@/hooks/useSubscription';
import { PricingTable } from '@/components/billing/PricingTable';
import { PlanFAQ } from '@/components/billing/PlanFAQ';
import {
  hasPendingPlan,
  clearPendingPlan,
  handlePendingPlanRedirect,
  BILLING_MESSAGES,
} from '@/lib/plan-redirect-utils';

export function PlansSettings() {
  const { subscription, refetch } = useSubscription();
  const tier = subscription?.tier;
  const navigate = useNavigate();

  const [pageState, setPageState] = useState<'checking' | 'redirecting' | 'error' | 'ready'>(() =>
    hasPendingPlan() ? 'checking' : 'ready',
  );

  const processPendingPlan = useCallback(async () => {
    setPageState('redirecting');
    const { handled, error } = await handlePendingPlanRedirect({ navigate, refetch });
    if (!handled) {
      setPageState('ready');
      return;
    }
    if (error) setPageState('error');
  }, [navigate, refetch]);

  useEffect(() => {
    if (hasPendingPlan()) processPendingPlan(); // eslint-disable-line react-hooks/set-state-in-effect
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (pageState === 'error') {
    return (
      <div className='flex min-h-[60vh] flex-col items-center justify-center px-4'>
        <div className='bg-destructive/10 flex size-16 items-center justify-center rounded-full'>
          <AlertCircleIcon className='text-destructive size-8' />
        </div>
        <h2 className='text-foreground mt-4 text-xl font-semibold'>
          {BILLING_MESSAGES.CHECKOUT_ERROR.title}
        </h2>
        <p className='text-muted-foreground mt-2 max-w-md text-center'>
          {BILLING_MESSAGES.CHECKOUT_ERROR.message}
        </p>
        <div className='mt-6 flex gap-3'>
          <button
            type='button'
            onClick={processPendingPlan}
            className='bg-primary hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition'
          >
            <RefreshCwIcon className='size-4' />
            Try Again
          </button>
          <button
            type='button'
            onClick={() => {
              clearPendingPlan();
              setPageState('ready');
            }}
            className='border-border bg-card text-foreground hover:bg-muted rounded-lg border px-4 py-2.5 text-sm font-semibold transition'
          >
            Choose a Plan
          </button>
        </div>
      </div>
    );
  }

  if (pageState !== 'ready') {
    return (
      <div className='flex min-h-[60vh] flex-col items-center justify-center'>
        <LoaderIcon className='text-primary size-8 animate-spin' />
        <p className='text-foreground mt-4 text-lg font-medium'>Redirecting to checkout...</p>
        <p className='text-muted-foreground mt-1 text-sm'>
          Please wait while we prepare your order.
        </p>
      </div>
    );
  }

  return (
    <div className='bg-muted/50 min-h-full py-6'>
      <div className='mx-auto max-w-6xl px-4 sm:px-6 lg:px-8'>
        <div className='mb-8 text-center'>
          <h1 className='text-foreground text-4xl font-bold'>
            Choose the right plan for your team
          </h1>
          <p className='text-muted-foreground mx-auto mt-4 max-w-2xl text-lg'>
            Start with a free trial, then pick the plan that fits your workflow. All plans include
            our core features.
          </p>
        </div>

        <PricingTable currentTier={tier} />

        <PlanFAQ context='settings' />

        {/* Bottom CTA */}
        <div className='from-primary to-primary/90 mt-16 rounded-2xl bg-gradient-to-r px-8 py-12 text-center'>
          <h2 className='text-2xl font-bold text-white'>Still have questions?</h2>
          <p className='mx-auto mt-2 max-w-xl text-blue-100'>
            Our team is here to help. Reach out and we&apos;ll get back to you within 24 hours.
          </p>
          <a
            href='/contact'
            className='bg-card text-primary mt-6 inline-flex items-center rounded-xl px-6 py-3 font-semibold shadow-lg transition-all hover:shadow-xl'
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}
