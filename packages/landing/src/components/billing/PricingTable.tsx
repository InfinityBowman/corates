/**
 * PricingTable - Subscription plan cards with billing interval toggle
 */

import { useState, useMemo, useCallback } from 'react';
import {
  CheckIcon,
  StarIcon,
  ZapIcon,
  AlertCircleIcon,
  ArrowDownIcon,
  LoaderIcon,
} from 'lucide-react';
import { showToast } from '@/components/ui/toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import FlipNumber from '@/components/FlipNumber';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  redirectToCheckout,
  redirectToSingleProjectCheckout,
  startTrial,
  validatePlanChange,
} from '@/api/billing';
import { useSubscription } from '@/hooks/useSubscription';
import { getBillingPlanCatalog } from '@corates/shared/plans';

const TIER_ORDER: Record<string, number> = {
  free: 0,
  trial: 1,
  single_project: 2,
  starter_team: 3,
  team: 4,
  unlimited_team: 5,
};

function isDowngrade(fromTier: string, toTier: string) {
  return (TIER_ORDER[toTier] ?? 0) < (TIER_ORDER[fromTier] ?? 0);
}

const formatUsd = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(amount);

function getAnnualSavings(plan: any) {
  if (!plan.price?.monthly || !plan.price?.yearly) return null;
  const savings = plan.price.monthly * 12 - plan.price.yearly;
  return savings > 0 ? savings : null;
}

interface PricingTableProps {
  currentTier?: string;
}

export function PricingTable({ currentTier: currentTierProp }: PricingTableProps) {
  const catalog = useMemo(() => getBillingPlanCatalog(), []);
  const trialPlan = useMemo(() => catalog.plans.find((p: any) => p.tier === 'trial'), [catalog]);
  const singleProjectPlan = useMemo(
    () => catalog.plans.find((p: any) => p.tier === 'single_project'),
    [catalog],
  );
  const subscriptionPlans = useMemo(
    () => catalog.plans.filter((p: any) => p.cta === 'subscribe'),
    [catalog],
  );

  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<any>(null);
  const [pendingDowngrade, setPendingDowngrade] = useState<any>(null);

  const { subscription, refetch } = useSubscription();
  const isTrialing = subscription?.status === 'trialing';
  const currentTier = currentTierProp ?? 'free';
  const canStartTrial = currentTier === 'free';

  const proceedWithPlanChange = useCallback(
    async (plan: any) => {
      setLoadingTier(plan.tier);
      try {
        const validation = await validatePlanChange(plan.tier);
        if (!validation.valid) {
          setValidationError(validation);
          setLoadingTier(null);
          return;
        }
        await redirectToCheckout(plan.tier, billingInterval);
      } catch (error) {
        const { handleError } = await import('@/lib/error-utils');
        await handleError(error, { toastTitle: 'Checkout Error' });
        setLoadingTier(null);
      }
    },
    [billingInterval],
  );

  const handleAction = useCallback(
    async (plan: any) => {
      if (!plan || plan.tier === currentTier) return;
      setLoadingTier(plan.tier);
      try {
        if (plan.cta === 'start_trial') {
          await startTrial();
          showToast.success('Trial started', 'Your 14-day trial is now active.');
          await refetch();
          setLoadingTier(null);
          return;
        }
        if (plan.cta === 'buy_single_project') {
          await redirectToSingleProjectCheckout();
          return;
        }
        if (plan.cta === 'subscribe') {
          if (isDowngrade(currentTier, plan.tier)) {
            setPendingDowngrade(plan);
            setLoadingTier(null);
            return;
          }
          await proceedWithPlanChange(plan);
          return;
        }
      } catch (error) {
        const { handleError } = await import('@/lib/error-utils');
        await handleError(error, { toastTitle: 'Checkout Error' });
        setLoadingTier(null);
      }
    },
    [currentTier, refetch, proceedWithPlanChange],
  );

  const getButtonText = useCallback(
    (plan: any) => {
      if (plan.tier === currentTier) return 'Current Plan';
      if (plan.cta === 'start_trial') return 'Start Free Trial';
      if (plan.cta === 'buy_single_project') return 'Buy Now';
      if (isTrialing) return 'Upgrade Now';
      return 'Get Started';
    },
    [currentTier, isTrialing],
  );

  const isButtonDisabled = useCallback(
    (plan: any) => {
      if (!plan || plan.tier === currentTier) return true;
      if (loadingTier !== null) return true;
      if (plan.cta === 'none') return true;
      if (plan.cta === 'start_trial' && currentTier !== 'free') return true;
      return false;
    },
    [currentTier, loadingTier],
  );

  const handleStartTrial = useCallback(async () => {
    setLoadingTier('trial');
    try {
      await startTrial();
      showToast.success('Trial started', 'Your 14-day trial is now active.');
      await refetch();
    } catch (error) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(error, { toastTitle: 'Trial Error' });
    } finally {
      setLoadingTier(null);
    }
  }, [refetch]);

  const handleBuySingleProject = useCallback(async () => {
    setLoadingTier('single_project');
    try {
      await redirectToSingleProjectCheckout();
    } catch (error) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(error, { toastTitle: 'Checkout Error' });
      setLoadingTier(null);
    }
  }, []);

  return (
    <div className='pb-6'>
      {/* Trial CTA */}
      {canStartTrial && trialPlan && (
        <div className='mb-10 rounded-2xl border-2 border-blue-200 bg-linear-to-r from-blue-50 to-indigo-50 p-6'>
          <div className='flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left'>
            <div className='flex size-12 shrink-0 items-center justify-center rounded-full bg-blue-100'>
              <ZapIcon className='size-6 text-blue-600' />
            </div>
            <div className='flex-1'>
              <h3 className='text-foreground text-lg font-bold'>Start your 14-day free trial</h3>
              <p className='text-muted-foreground mt-1 text-sm'>
                {trialPlan.features[0]}. {trialPlan.features[1]}. No credit card required.
              </p>
            </div>
            <button
              type='button'
              className='bg-primary hover:bg-primary/90 shrink-0 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-50'
              onClick={handleStartTrial}
              disabled={loadingTier !== null}
            >
              {loadingTier === 'trial' ?
                <span className='flex items-center gap-2'>
                  <LoaderIcon className='size-4 animate-spin' />
                  Starting...
                </span>
              : 'Start Free Trial'}
            </button>
          </div>
        </div>
      )}

      {/* Billing toggle */}
      <div className='mb-10 flex flex-col items-center gap-4'>
        <div className='flex items-center gap-2 rounded-full bg-success/10 px-4 py-2 text-sm font-medium text-success'>
          <StarIcon className='size-4' />
          Save 2 months with annual billing
        </div>
        <div className='bg-muted relative inline-flex rounded-xl p-1.5'>
          <div
            className='bg-card absolute top-1.5 h-[calc(100%-12px)] w-[calc(50%-6px)] rounded-lg shadow-sm transition-transform duration-200 ease-out'
            style={{
              transform: billingInterval === 'yearly' ? 'translateX(100%)' : 'translateX(0)',
            }}
          />
          <button
            type='button'
            className={`relative z-10 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors duration-200 ${billingInterval === 'monthly' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setBillingInterval('monthly')}
          >
            Monthly
          </button>
          <button
            type='button'
            className={`relative z-10 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors duration-200 ${billingInterval === 'yearly' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setBillingInterval('yearly')}
          >
            Annual
          </button>
        </div>
      </div>

      {/* Trial upgrade prompt */}
      {isTrialing && (
        <Alert variant='info' className='mb-6'>
          <ZapIcon />
          <div>
            <AlertTitle>Enjoying your trial?</AlertTitle>
            <AlertDescription>
              Upgrade now to keep your projects and avoid any interruption when your trial ends.
            </AlertDescription>
          </div>
        </Alert>
      )}

      {/* Plans grid */}
      <div className='grid grid-cols-1 gap-6 md:grid-cols-3'>
        {subscriptionPlans.map((plan: any) => {
          const isCurrent = plan.tier === currentTier;
          const isPopular = plan.isPopular;
          const savings = getAnnualSavings(plan);

          return (
            <div
              key={plan.tier}
              className={`relative flex flex-col rounded-2xl border-2 p-6 transition-all duration-300 ${
                isCurrent ? 'border-primary bg-card shadow-lg'
                : isPopular ? 'border-primary/70 bg-card shadow-xl hover:shadow-2xl'
                : 'border-border bg-card hover:border-border/80 hover:shadow-lg'
              }`}
            >
              {isPopular && !isCurrent && (
                <div className='absolute -top-4 left-1/2 -translate-x-1/2'>
                  <Badge variant='default' className='px-4 py-1.5 font-bold text-white shadow-lg'>
                    <ZapIcon className='size-3.5' />
                    Most Popular
                  </Badge>
                </div>
              )}
              {isCurrent && (
                <div className='absolute -top-4 left-1/2 -translate-x-1/2'>
                  <Badge variant='default' className='px-4 py-1.5 font-bold text-white shadow-lg'>
                    <CheckIcon className='size-3.5' />
                    Current Plan
                  </Badge>
                </div>
              )}

              <div className='mb-4 pt-2'>
                <h3 className='text-foreground text-xl font-bold'>{plan.name}</h3>
                <p className='text-muted-foreground mt-1 text-sm'>{plan.description}</p>
              </div>

              <div className='mb-6'>
                {plan.oneTime ?
                  <>
                    <div className='flex items-baseline gap-1'>
                      <span className='text-foreground text-4xl font-bold'>
                        {formatUsd(plan.oneTime.amount)}
                      </span>
                      <span className='text-muted-foreground'>one-time</span>
                    </div>
                    <p className='text-muted-foreground mt-1 text-sm'>
                      Valid for {plan.oneTime.durationMonths} months
                    </p>
                  </>
                : plan.price ?
                  <>
                    <div className='flex items-baseline gap-1'>
                      <FlipNumber
                        value={
                          billingInterval === 'monthly' ?
                            plan.price.monthly
                          : plan.price.yearly / 12
                        }
                        prefix='$'
                        decimals={billingInterval === 'yearly' ? 2 : 0}
                        className='text-foreground text-4xl font-bold'
                      />
                      <span className='text-muted-foreground'>/month</span>
                    </div>
                    <div
                      className='mt-1 grid transition-[grid-template-rows] duration-300 ease-out'
                      style={{
                        gridTemplateRows: billingInterval === 'yearly' ? '1fr' : '0fr',
                      }}
                    >
                      <div className='overflow-hidden'>
                        {plan.price.yearly > 0 && (
                          <p className='text-muted-foreground text-sm'>
                            {formatUsd(plan.price.yearly)} billed annually
                          </p>
                        )}
                        {savings && (
                          <p className='text-sm font-medium text-success'>
                            Save {formatUsd(savings)} per year
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                : <div className='text-foreground text-3xl font-bold'>Free</div>}
              </div>

              {plan.cta !== 'none' && (
                <button
                  type='button'
                  className={`mb-6 w-full rounded-xl px-4 py-3 text-sm font-semibold transition-all focus:ring-2 focus:ring-offset-2 focus:outline-none ${
                    isCurrent ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : isPopular ? 'bg-primary hover:bg-primary/90 focus:ring-primary text-white'
                    : 'bg-foreground text-background hover:bg-foreground/90 focus:ring-foreground'
                  }`}
                  onClick={() => handleAction(plan)}
                  disabled={isButtonDisabled(plan)}
                >
                  {loadingTier === plan.tier ?
                    <span className='flex items-center justify-center gap-2'>
                      <LoaderIcon className='size-4 animate-spin' />
                      Processing...
                    </span>
                  : getButtonText(plan)}
                </button>
              )}

              <div className='flex-1'>
                <p className='text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase'>
                  What&apos;s included
                </p>
                <ul className='flex flex-col gap-3'>
                  {plan.features.map((feature: string, i: number) => (
                    <li key={i} className='flex items-start gap-3'>
                      <div className='mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success/10'>
                        <CheckIcon className='size-3 text-success' />
                      </div>
                      <span className='text-muted-foreground text-sm'>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      {/* Single Project */}
      {singleProjectPlan && (
        <div className='border-border bg-card mt-12 rounded-2xl border-2 p-6'>
          <div className='flex flex-col gap-6 md:flex-row md:items-center md:justify-between'>
            <div className='flex-1'>
              <div className='mb-2 flex items-center gap-2'>
                <h3 className='text-foreground text-lg font-bold'>{singleProjectPlan.name}</h3>
                <Badge variant='secondary'>One-time purchase</Badge>
              </div>
              <p className='text-muted-foreground text-sm'>{singleProjectPlan.description}</p>
              <ul className='mt-3 flex flex-wrap gap-x-4 gap-y-1'>
                {singleProjectPlan.features.map((feature: string, i: number) => (
                  <li key={i} className='text-muted-foreground flex items-center gap-1.5 text-sm'>
                    <CheckIcon className='size-3.5 text-success' />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
            <div className='flex shrink-0 items-center gap-4'>
              <div className='text-right'>
                <div className='text-foreground text-2xl font-bold'>
                  {formatUsd(singleProjectPlan.oneTime!.amount)}
                </div>
                <p className='text-muted-foreground text-xs'>
                  {singleProjectPlan.oneTime!.durationMonths} months access
                </p>
              </div>
              <button
                type='button'
                className='bg-foreground text-background hover:bg-foreground/90 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50'
                onClick={handleBuySingleProject}
                disabled={loadingTier !== null || currentTier === 'single_project'}
              >
                {loadingTier === 'single_project' ?
                  <span className='flex items-center gap-2'>
                    <LoaderIcon className='size-4 animate-spin' />
                    Processing...
                  </span>
                : currentTier === 'single_project' ?
                  'Current Plan'
                : 'Buy Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Validation Error Dialog */}
      <Dialog
        open={validationError !== null}
        onOpenChange={open => !open && setValidationError(null)}
      >
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <div className='flex items-start gap-3'>
              <div className='flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10'>
                <AlertCircleIcon className='size-5 text-destructive' />
              </div>
              <div>
                <DialogTitle>Cannot Change Plan</DialogTitle>
                <DialogDescription className='mt-1'>
                  Your current usage exceeds the limits of the selected plan.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {validationError && (
            <div className='mb-6 flex flex-col gap-3'>
              {validationError.violations?.map((v: any, i: number) => (
                <Alert key={i} variant='destructive'>
                  <AlertTitle>{v.message}</AlertTitle>
                  <AlertDescription>
                    Current: {v.current} / Limit: {v.limit}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}
          <button
            type='button'
            onClick={() => setValidationError(null)}
            className='bg-muted text-foreground hover:bg-muted/80 rounded-lg px-4 py-2 text-sm font-medium transition-colors'
          >
            Got it
          </button>
        </DialogContent>
      </Dialog>

      {/* Downgrade Confirmation Dialog */}
      <Dialog
        open={pendingDowngrade !== null}
        onOpenChange={open => !open && setPendingDowngrade(null)}
      >
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <div className='flex items-start gap-3'>
              <div className='flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100'>
                <ArrowDownIcon className='size-5 text-amber-600' />
              </div>
              <div>
                <DialogTitle>Confirm Downgrade</DialogTitle>
                <DialogDescription className='mt-1'>
                  Are you sure you want to downgrade your plan?
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {pendingDowngrade && (
            <Alert variant='warning' className='mb-6'>
              <AlertDescription>
                <p>
                  You&apos;re switching from <span className='font-semibold'>{currentTier}</span> to{' '}
                  <span className='font-semibold'>{pendingDowngrade.name}</span>.
                </p>
                <p className='mt-2'>
                  Your new plan will take effect at the end of your current billing period.
                </p>
              </AlertDescription>
            </Alert>
          )}
          <div className='flex justify-end gap-3'>
            <button
              type='button'
              onClick={() => setPendingDowngrade(null)}
              className='bg-muted text-foreground hover:bg-muted/80 rounded-lg px-4 py-2 text-sm font-medium transition-colors'
            >
              Cancel
            </button>
            <button
              type='button'
              className='rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700'
              onClick={async () => {
                const plan = pendingDowngrade;
                setPendingDowngrade(null);
                if (plan) await proceedWithPlanChange(plan);
              }}
            >
              Confirm Downgrade
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
