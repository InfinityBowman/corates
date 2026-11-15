import { describe, it, expect } from 'vitest';
import { getPlanPricing } from '../plans/pricing.js';
import { STRIPE_PLAN_IDS } from '../plans/stripe.js';

describe('PLAN_PRICING', () => {
  // The pricing FAQ says annual costs "about 17% less", which only holds at 12 months for 10.
  it.each(STRIPE_PLAN_IDS)('prices %s annual at ten months of monthly', planId => {
    const pricing = getPlanPricing(planId);
    expect(pricing?.yearly).toBe((pricing?.monthly ?? 0) * 10);
  });
});
