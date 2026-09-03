/**
 * PlansSettings - Plan comparison page with FAQ
 */

import { useState, useEffect, useCallback } from 'react';
import { AlertCircleIcon, RefreshCwIcon } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useSubscription } from '@/hooks/useSubscription';
import { showToast } from '@/lib/toast';
import { PricingTable } from '@/components/billing/PricingTable';
import { PlanFAQ } from '@/components/billing/PlanFAQ';
import {
  hasPendingPlan,
  getPendingPlan,
  clearPendingPlan,
  handlePendingPlanRedirect,
  BILLING_MESSAGES,
} from '@/lib/plan-redirect-utils';

export function PlansSettings() {
  const { subscription, refetch, isLoading } = useSubscription();
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
    if (isLoading || !hasPendingPlan()) return;
    if (getPendingPlan().plan === tier) {
      clearPendingPlan();
      showToast.info(
        BILLING_MESSAGES.ALREADY_ON_PLAN.title,
        BILLING_MESSAGES.ALREADY_ON_PLAN.message,
      );
      setPageState('ready');
      return;
    }
    processPendingPlan();
  }, [isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

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
          <Button onClick={processPendingPlan}>
            <RefreshCwIcon className='size-4' />
            Try again
          </Button>
          <Button
            variant='outline'
            onClick={() => {
              clearPendingPlan();
              setPageState('ready');
            }}
          >
            Choose a plan
          </Button>
        </div>
      </div>
    );
  }

  if (pageState !== 'ready') {
    return (
      <div className='flex min-h-[60vh] flex-col items-center justify-center'>
        <Spinner size='lg' />
        <p className='text-foreground mt-4 text-lg font-medium'>Redirecting to checkout...</p>
        <p className='text-muted-foreground mt-1 text-sm'>This takes a few seconds.</p>
      </div>
    );
  }

  return (
    <div className='min-h-full py-6'>
      <div className='mx-auto max-w-6xl px-4 sm:px-6 lg:px-8'>
        <div className='mb-8 text-center'>
          <h1 className='text-foreground text-4xl font-bold'>Choose a plan</h1>
          <p className='text-muted-foreground mx-auto mt-4 max-w-2xl text-lg'>
            Start with a 14-day free trial, then pick the plan that fits your team. Appraising a
            single study stays free.
          </p>
        </div>

        <PricingTable currentTier={tier} />

        <PlanFAQ context='settings' />

        {/* Bottom CTA */}
        <div className='from-primary to-primary/90 mt-16 rounded-2xl bg-gradient-to-r px-8 py-12 text-center'>
          <h2 className='text-2xl font-bold text-white'>Still have questions?</h2>
          <p className='mx-auto mt-2 max-w-xl text-blue-100'>
            Tell us what your team needs and we will help you pick a plan.
          </p>
          <a
            href='/contact'
            className='bg-card text-primary mt-6 inline-flex items-center rounded-xl px-6 py-3 font-semibold shadow-lg transition-all hover:shadow-xl'
          >
            Contact support
          </a>
        </div>
      </div>
    </div>
  );
}
