/**
 * Billing plan catalog
 *
 * This is the source of truth for what the pricing/billing UI displays:
 * - tiers shown
 * - marketing names/descriptions
 * - feature bullets
 * - pricing display
 *
 * Entitlements/quotas remain in `plans.ts`.
 * Subscription pricing remains in `pricing.ts`.
 *
 * Source of truth: `packages/docs/guides/pricing-model.md`
 */

import type { PlanId } from './types.js';
import { getPlanPricing } from './pricing.js';
import { getPlan } from './plans.js';

export type BillingCatalogTier = PlanId;
export type BillingCatalogCTA = 'free' | 'subscribe' | 'contact';

export interface BillingCatalogPlan {
  tier: BillingCatalogTier;
  name: string;
  description: string;
  price: ReturnType<typeof getPlanPricing> | null;
  /** Shown under a quoted price when there is no self-serve price. */
  priceNote?: string;
  isPopular?: boolean;
  cta: BillingCatalogCTA;
  features: string[];
}

export interface BillingCatalogResponse {
  plans: BillingCatalogPlan[];
}

function quotaLabel(value: number): string {
  if (value === -1) return 'Unlimited';
  return value.toString();
}

/**
 * Returns the billing catalog in display order.
 */
export function getBillingPlanCatalog(): BillingCatalogResponse {
  const free = getPlan('free');
  const team = getPlan('team');
  const lab = getPlan('lab');

  return {
    plans: [
      {
        tier: 'free',
        name: free.name,
        description: 'For solo appraisals and a first shared project',
        price: getPlanPricing('free'),
        cta: 'free',
        features: [
          `${quotaLabel(free.quotas['projects.max'])} project`,
          `Up to ${quotaLabel(free.quotas['collaborators.org.max'])} collaborators`,
          'Unlimited studies per project',
          'Unlimited solo appraisals in your browser',
          'Completed appraisals stay readable and exportable',
        ],
      },
      {
        tier: 'team',
        name: team.name,
        description: 'For small teams running a few reviews',
        price: getPlanPricing('team'),
        isPopular: true,
        cta: 'subscribe',
        features: [
          'Everything in Free',
          `Up to ${quotaLabel(team.quotas['projects.max'])} projects`,
          `${quotaLabel(team.quotas['collaborators.org.max'])} collaborators`,
          'PDF markup and consensus workflows',
          'Exports and figures',
          'Email support',
        ],
      },
      {
        tier: 'lab',
        name: lab.name,
        description: 'For active labs and review groups',
        price: getPlanPricing('lab'),
        cta: 'subscribe',
        features: [
          'Everything in Team',
          `Up to ${quotaLabel(lab.quotas['projects.max'])} projects`,
          `${quotaLabel(lab.quotas['collaborators.org.max'])} collaborators`,
          'Priority support',
        ],
      },
      {
        tier: 'enterprise',
        name: 'Enterprise',
        description: 'For consultancies and institutions',
        price: null,
        priceNote: 'Annual billing only',
        cta: 'contact',
        features: [
          'Everything in Lab',
          'Unlimited projects',
          'Consultancies: priority support and invoice billing',
          'Institutions: site-wide access for every lab and course',
        ],
      },
    ],
  };
}

/**
 * Tiers that have a checkout flow (derived from catalog)
 * Used for validating plan params from landing page URLs
 */
export const CHECKOUT_ELIGIBLE_TIERS: BillingCatalogTier[] = getBillingPlanCatalog()
  .plans.filter(p => p.cta === 'subscribe')
  .map(p => p.tier);
