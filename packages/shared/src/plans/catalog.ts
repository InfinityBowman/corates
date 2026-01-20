/**
 * Billing plan catalog
 *
 * This is the source of truth for what the pricing/billing UI displays:
 * - tiers shown
 * - marketing names/descriptions
 * - feature bullets
 * - pricing display (subscription vs one-time)
 *
 * Entitlements/quotas remain in `plans.ts`.
 * Subscription pricing remains in `pricing.ts`.
 *
 * Source of truth: `packages/docs/plans/pricing-model.md`
 */

import type { PlanId } from './types.js';
import type { GrantType } from './plans.js';
import { getPlanPricing } from './pricing.js';
import { getPlan, getGrantPlan } from './plans.js';

export type BillingCatalogTier = PlanId | GrantType;
export type BillingCatalogCTA = 'subscribe' | 'buy_single_project' | 'start_trial' | 'none';

export interface BillingCatalogOneTimePricing {
  amount: number;
  durationMonths: number;
}

export interface BillingCatalogPlan {
  tier: BillingCatalogTier;
  name: string;
  description: string;
  price: ReturnType<typeof getPlanPricing> | null;
  oneTime?: BillingCatalogOneTimePricing;
  isPopular?: boolean;
  cta: BillingCatalogCTA;
  trialDays?: number;
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
  const starter = getPlan('starter_team');
  const team = getPlan('team');
  const unlimited = getPlan('unlimited_team');

  const trial = getGrantPlan('trial');
  const singleProject = getGrantPlan('single_project');

  return {
    plans: [
      {
        tier: 'trial',
        name: 'Trial',
        description: 'Full access for 14 days (1 project)',
        price: null,
        isPopular: false,
        // Trial is started by selecting the Trial plan card while on Free tier
        cta: 'start_trial',
        trialDays: 14,
        features: [
          `${quotaLabel(trial.quotas['projects.max'])} project (14 days)`,
          `Up to ${quotaLabel(trial.quotas['collaborators.org.max'])} collaborators`,
          'PDF markup and consensus workflows',
          'Exports and figures',
        ],
      },
      {
        tier: 'single_project',
        name: 'Single Project',
        description: 'One-time purchase for a single project',
        price: null,
        isPopular: false,
        cta: 'buy_single_project',
        oneTime: {
          amount: 39,
          durationMonths: 6,
        },
        features: [
          `${quotaLabel(singleProject.quotas['projects.max'])} project (6 months)`,
          `Up to ${quotaLabel(singleProject.quotas['collaborators.org.max'])} collaborators`,
          'PDF markup and consensus workflows',
          'Exports and figures',
        ],
      },
      {
        tier: 'starter_team',
        name: starter.name,
        description: 'For small teams running a few projects',
        price: getPlanPricing('starter_team'),
        isPopular: true,
        cta: 'subscribe',
        features: [
          `Up to ${quotaLabel(starter.quotas['projects.max'])} projects`,
          `Up to ${quotaLabel(starter.quotas['collaborators.org.max'])} collaborators`,
          'PDF markup and consensus workflows',
          'Exports and figures',
          'Email support',
        ],
      },
      {
        tier: 'team',
        name: team.name,
        description: 'For active labs and review groups',
        price: getPlanPricing('team'),
        isPopular: false,
        cta: 'subscribe',
        features: [
          'Everything in Starter',
          `Up to ${quotaLabel(team.quotas['projects.max'])} projects`,
          `Up to ${quotaLabel(team.quotas['collaborators.org.max'])} collaborators`,
          'Full audit trails',
          'Version history',
          'Priority support',
        ],
      },
      {
        tier: 'unlimited_team',
        name: unlimited.name,
        description: 'For teams that want no limits',
        price: getPlanPricing('unlimited_team'),
        isPopular: false,
        cta: 'subscribe',
        features: [
          'Everything in Team',
          'Unlimited projects',
          'Unlimited collaborators',
          // 'PDF markup and consensus workflows',
          // 'Exports and figures',
          // 'Full audit trails',
          // 'Version history',
          // 'Priority support',
        ],
      },
    ],
  };
}
