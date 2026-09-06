/**
 * PricingTable - Plan cards with billing interval toggle
 *
 * Supports two modes:
 * - 'authenticated' (default): For logged-in users. Shows current plan badges,
 *   loading states, validation/downgrade dialogs, and calls billing APIs directly.
 * - 'marketing': For public pricing pages. Renders Link CTAs to signup URLs,
 *   no auth state, no API calls.
 */

import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { CheckIcon, ZapIcon, AlertCircleIcon, ArrowDownIcon } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import FlipNumber from '@/components/FlipNumber';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { redirectToCheckout, redirectToPortal } from '@/api/billing';
import { checkPlanChange } from '@/server/functions/billing.functions';
import { getBillingPlanCatalog } from '@corates/shared/plans';
import type { BillingCatalogPlan } from '@corates/shared/plans';
import { formatUsd } from './utils';

interface PlanValidationResult {
  valid: boolean;
  violations?: { message: string; used: number; limit: number }[];
}

const TIER_ORDER: Record<string, number> = {
  free: 0,
  team: 1,
  lab: 2,
  enterprise: 3,
};

function isDowngrade(fromTier: string, toTier: string) {
  return (TIER_ORDER[toTier] ?? 0) < (TIER_ORDER[fromTier] ?? 0);
}

type BillingInterval = 'monthly' | 'yearly';

interface PricingTableProps {
  currentTier?: string;
  mode?: 'marketing' | 'authenticated';
  getSignUpUrl?: (tier: string, interval?: string) => string;
}

const catalog = getBillingPlanCatalog();

export function PricingTable({
  currentTier: currentTierProp,
  mode = 'authenticated',
  getSignUpUrl,
}: PricingTableProps) {
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('yearly');
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<PlanValidationResult | null>(null);
  const [pendingDowngrade, setPendingDowngrade] = useState<BillingCatalogPlan | null>(null);

  const isMarketing = mode === 'marketing';
  const currentTier = currentTierProp ?? 'free';

  const buildSignUpUrl = (plan: BillingCatalogPlan) => {
    if (!getSignUpUrl) return '/signup';
    return plan.cta === 'subscribe' ? getSignUpUrl(plan.tier, billingInterval) : '/signup';
  };

  const proceedWithPlanChange = async (plan: BillingCatalogPlan) => {
    setLoadingTier(plan.tier);
    try {
      const validation = await checkPlanChange({ data: { targetPlan: plan.tier } });
      if (!validation.valid) {
        setValidationError(validation as PlanValidationResult);
        setLoadingTier(null);
        return;
      }
      await redirectToCheckout(plan.tier, billingInterval);
    } catch (error) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(error, { toastTitle: 'Checkout Error' });
      setLoadingTier(null);
    }
  };

  const handleAction = async (plan: BillingCatalogPlan) => {
    if (plan.tier === currentTier) return;
    if (plan.cta === 'free') {
      setLoadingTier(plan.tier);
      try {
        await redirectToPortal();
      } catch (error) {
        const { handleError } = await import('@/lib/error-utils');
        await handleError(error, { toastTitle: 'Billing Portal Error' });
        setLoadingTier(null);
      }
      return;
    }
    if (plan.cta !== 'subscribe') return;
    if (isDowngrade(currentTier, plan.tier)) {
      setPendingDowngrade(plan);
      return;
    }
    await proceedWithPlanChange(plan);
  };

  const getButtonText = (plan: BillingCatalogPlan) => {
    if (!isMarketing && plan.tier === currentTier) return 'Current Plan';
    if (plan.cta === 'contact') return 'Contact us';
    // Moving to Free means cancelling, which Stripe's portal handles.
    if (plan.cta === 'free' && !isMarketing) return 'Manage in billing portal';
    return 'Get Started';
  };

  const isButtonDisabled = (plan: BillingCatalogPlan) => {
    if (isMarketing) return false;
    if (plan.tier === currentTier) return true;
    return loadingTier !== null;
  };

  const renderBillingToggle = () => (
    <div className='mb-6 flex justify-center'>
      <div className='bg-muted relative inline-flex rounded-xl p-1.5'>
        <div
          className='bg-card absolute top-1.5 h-[calc(100%-12px)] w-[calc(50%-6px)] rounded-lg shadow-sm transition-transform duration-200 ease-out'
          style={{
            transform: billingInterval === 'monthly' ? 'translateX(100%)' : 'translateX(0)',
          }}
        />
        <button
          type='button'
          className={`relative z-10 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors duration-200 ${billingInterval === 'yearly' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => setBillingInterval('yearly')}
        >
          Annual
        </button>
        <button
          type='button'
          className={`relative z-10 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors duration-200 ${billingInterval === 'monthly' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => setBillingInterval('monthly')}
        >
          Monthly
        </button>
      </div>
    </div>
  );

  const renderPrice = (plan: BillingCatalogPlan) => {
    if (plan.cta === 'contact') {
      return (
        <>
          <div className='text-foreground text-4xl font-bold'>Custom</div>
          {plan.priceNote && <p className='text-muted-foreground mt-1 text-sm'>{plan.priceNote}</p>}
        </>
      );
    }
    if (!plan.price?.monthly) {
      return (
        <>
          <div className='flex items-baseline gap-1'>
            <span className='text-foreground text-4xl font-bold'>$0</span>
          </div>
          <p className='text-muted-foreground mt-1 text-sm'>Free for everyone</p>
        </>
      );
    }
    return (
      <>
        <div className='flex items-baseline gap-1'>
          <FlipNumber
            value={
              billingInterval === 'monthly' ? plan.price.monthly : (plan.price.yearly ?? 0) / 12
            }
            prefix='$'
            decimals={0}
            className='text-foreground text-4xl font-bold'
          />
          <span className='text-muted-foreground'>/month</span>
        </div>
        {/* min-h keeps the card the same height when the annual line is hidden */}
        <p className='text-muted-foreground mt-1 min-h-5 text-sm'>
          {billingInterval === 'yearly' && `${formatUsd(plan.price.yearly ?? 0)} billed annually`}
        </p>
      </>
    );
  };

  const renderCta = (plan: BillingCatalogPlan) => {
    const isCurrent = !isMarketing && plan.tier === currentTier;
    const muted = !plan.isPopular;
    const className = `mt-6 h-auto w-full rounded-xl px-4 py-2.5 font-semibold ${
      !isCurrent && muted ? 'bg-foreground text-background hover:bg-foreground/90' : ''
    }`;

    if (plan.cta === 'contact') {
      return (
        <Button asChild size='lg' className={className}>
          <Link to='/contact'>{getButtonText(plan)}</Link>
        </Button>
      );
    }

    if (isMarketing) {
      return (
        <Button asChild size='lg' className={className}>
          <Link to={buildSignUpUrl(plan)}>{getButtonText(plan)}</Link>
        </Button>
      );
    }

    return (
      <Button
        size='lg'
        variant={isCurrent ? 'secondary' : 'default'}
        className={className}
        onClick={() => handleAction(plan)}
        disabled={isButtonDisabled(plan)}
      >
        {loadingTier === plan.tier ?
          <span className='flex items-center justify-center gap-2'>
            <Spinner size='sm' variant='current' />
            Processing...
          </span>
        : getButtonText(plan)}
      </Button>
    );
  };

  const renderPlanCard = (plan: BillingCatalogPlan) => {
    const isCurrent = !isMarketing && plan.tier === currentTier;
    const isPopular = plan.isPopular;

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

        <div className='mb-6'>{renderPrice(plan)}</div>

        <div className='flex-1'>
          <p className='text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase'>
            What&apos;s included
          </p>
          <ul className='flex flex-col gap-3'>
            {plan.features.map((feature: string, i: number) => (
              <li key={i} className='flex items-start gap-3'>
                <div className='bg-success-bg mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full'>
                  <CheckIcon className='text-success size-3' />
                </div>
                <span className='text-muted-foreground text-sm'>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {renderCta(plan)}
      </div>
    );
  };

  return (
    <div className='pb-6'>
      {renderBillingToggle()}

      <div className='grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4'>
        {catalog.plans.map(plan => renderPlanCard(plan))}
      </div>

      {!isMarketing && (
        <>
          <Dialog
            open={validationError !== null}
            onOpenChange={open => !open && setValidationError(null)}
          >
            <DialogContent className='max-w-md'>
              <DialogHeader>
                <div className='flex items-start gap-3'>
                  <div className='bg-destructive/10 flex size-10 shrink-0 items-center justify-center rounded-full'>
                    <AlertCircleIcon className='text-destructive size-5' />
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
                  {validationError.violations?.map((v, i) => (
                    <Alert key={i} variant='destructive'>
                      <AlertTitle>{v.message}</AlertTitle>
                      <AlertDescription>
                        Current: {v.used} / Limit: {v.limit}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}
              <Button variant='secondary' onClick={() => setValidationError(null)}>
                Got it
              </Button>
            </DialogContent>
          </Dialog>

          <Dialog
            open={pendingDowngrade !== null}
            onOpenChange={open => !open && setPendingDowngrade(null)}
          >
            <DialogContent className='max-w-md'>
              <DialogHeader>
                <div className='flex items-start gap-3'>
                  <div className='bg-warning-bg flex size-10 shrink-0 items-center justify-center rounded-full'>
                    <ArrowDownIcon className='text-warning size-5' />
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
                      You&apos;re switching from{' '}
                      <span className='font-semibold'>{currentTier}</span> to{' '}
                      <span className='font-semibold'>{pendingDowngrade.name}</span>.
                    </p>
                    <p className='mt-2'>
                      The change applies right away and unused time on your current plan is credited
                      to your next invoice.
                    </p>
                  </AlertDescription>
                </Alert>
              )}
              <div className='flex justify-end gap-3'>
                <Button variant='secondary' onClick={() => setPendingDowngrade(null)}>
                  Cancel
                </Button>
                <Button
                  className='bg-amber-600 text-white hover:bg-amber-700'
                  onClick={async () => {
                    const plan = pendingDowngrade;
                    setPendingDowngrade(null);
                    if (plan) await proceedWithPlanChange(plan);
                  }}
                >
                  Confirm Downgrade
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
