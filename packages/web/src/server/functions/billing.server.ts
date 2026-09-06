import { captureError, info, warn } from '@corates/workers/logger';
import { env } from 'cloudflare:workers';
import type Stripe from 'stripe';
import type { Database } from '@corates/db/client';
import type { OrgId } from '@corates/shared/ids';
import {
  resolveOrgAccess,
  getOrgResourceUsage,
  validatePlanChange,
} from '@corates/workers/billing-resolver';
import { createStripeClient, isStripeConfigured } from '@corates/shared/stripe';
import { createAuth } from '@corates/workers/auth-config';
import { syncStripeSubscription } from '@corates/workers/commands/billing';
import { projects, subscription } from '@corates/db/schema';
import { and, count, desc, eq, or } from 'drizzle-orm';
import {
  getPlan,
  getGrantPlan,
  getStripeProductConfig,
  CHECKOUT_ELIGIBLE_TIERS,
  type GrantType,
  type PlanId,
} from '@corates/shared/plans';
import { throwDomainError, AUTH_ERRORS, VALIDATION_ERRORS } from '@corates/shared';
import { resolveOrgId, resolveOrgIdWithRole } from '@/server/billing-context';

import type { Session } from '@/server/middleware/auth';

export async function fetchUsage(db: Database, session: Session) {
  const orgId = await resolveOrgId({
    db,
    session: session.session,
    userId: session.user.id,
  });

  requireOrg(orgId, 'usage', session.user.id);

  const usage = await getOrgResourceUsage(db, orgId);
  return { projects: usage.projects, collaborators: usage.collaborators };
}

export async function fetchSubscription(db: Database, session: Session) {
  const orgId = await resolveOrgId({
    db,
    session: session.session,
    userId: session.user.id,
  });

  requireOrg(orgId, 'subscription', session.user.id);

  const orgBilling = await resolveOrgAccess(db, orgId);

  const [projectCountResult] = await db
    .select({ count: count() })
    .from(projects)
    .where(eq(projects.orgId, orgId));

  const effectivePlan =
    orgBilling.source === 'grant' ?
      getGrantPlan(orgBilling.effectivePlanId as GrantType)
    : getPlan(orgBilling.effectivePlanId);

  const currentPeriodEnd =
    orgBilling.subscription?.periodEnd ?
      orgBilling.subscription.periodEnd instanceof Date ?
        Math.floor(orgBilling.subscription.periodEnd.getTime() / 1000)
      : orgBilling.subscription.periodEnd
    : null;

  return {
    tier: orgBilling.effectivePlanId,
    status:
      orgBilling.subscription?.status || (orgBilling.source === 'free' ? 'inactive' : 'active'),
    tierInfo: {
      name: effectivePlan.name,
      description: `Plan: ${effectivePlan.name}`,
    },
    stripeSubscriptionId: orgBilling.subscription?.id || null,
    currentPeriodEnd,
    cancelAtPeriodEnd: orgBilling.subscription?.cancelAtPeriodEnd || false,
    accessMode: orgBilling.accessMode,
    source: orgBilling.source,
    projectCount: projectCountResult?.count || 0,
  };
}

interface OrgMember {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
}

interface ListMembersApi {
  listMembers: (req: {
    headers: Headers;
    query: { organizationId: string };
  }) => Promise<{ members?: OrgMember[] }>;
}

export async function fetchMembers(db: Database, session: Session, headers: Headers) {
  const orgId = await resolveOrgId({
    db,
    session: session.session,
    userId: session.user.id,
  });

  requireOrg(orgId, 'members', session.user.id);

  const auth = createAuth(env);
  const api = auth.api as unknown as ListMembersApi;
  const result = await api.listMembers({
    headers,
    query: { organizationId: orgId },
  });

  const members = result.members || [];
  return { members, count: members.length };
}

export async function validateCoupon(code: string) {
  if (!code) {
    return { valid: false as const, error: 'Promo code is required' };
  }

  if (!isStripeConfigured(env)) {
    captureError(new Error('validate_coupon_failed: Stripe not configured'), {
      tags: { component: 'billing', action: 'validate-coupon' },
    });
    return { valid: false as const, error: 'Payment system not available' };
  }

  try {
    const stripe = createStripeClient(env.STRIPE_SECRET_KEY);
    const promoCodes = await stripe.promotionCodes.list({ code, active: true, limit: 1 });

    if (promoCodes.data.length === 0) {
      return { valid: false as const, error: 'Invalid or expired promo code' };
    }

    const promo = promoCodes.data[0];
    const coupon = (promo as unknown as { coupon: Stripe.Coupon }).coupon;

    if (promo.expires_at && promo.expires_at < Math.floor(Date.now() / 1000)) {
      return { valid: false as const, error: 'This promo code has expired' };
    }
    if (promo.max_redemptions && promo.times_redeemed >= promo.max_redemptions) {
      return { valid: false as const, error: 'This promo code is no longer available' };
    }

    info('billing.coupon_validated', { code: promo.code, promoCodeId: promo.id });
    return {
      valid: true as const,
      promoCodeId: promo.id,
      code: promo.code,
      percentOff: coupon.percent_off,
      amountOff: coupon.amount_off,
      currency: coupon.currency,
      duration: coupon.duration,
      durationMonths: coupon.duration_in_months,
      name: coupon.name,
    };
  } catch (err) {
    captureError(err, { tags: { component: 'billing', action: 'validate-coupon' } });
    return { valid: false as const, error: 'Failed to validate promo code' };
  }
}

export async function fetchPlanValidation(db: Database, session: Session, targetPlan: string) {
  const orgId = await resolveOrgId({
    db,
    session: session.session,
    userId: session.user.id,
  });

  requireOrg(orgId, 'plan_validation', session.user.id);

  return validatePlanChange(db, orgId, targetPlan);
}

// --- Helpers ---

function requireOrg(orgId: OrgId | null, action: string, userId: string): asserts orgId is OrgId {
  if (!orgId) {
    warn('billing.denied', { action, userId, reason: 'no_org_found' });
    throwDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'no_org_found' });
  }
}

function requireOwnerOrg(
  orgId: OrgId | null,
  role: string | null,
  action: string,
  userId: string,
): asserts orgId is OrgId {
  if (!orgId) {
    warn('billing.denied', { action, userId, reason: 'no_org_found' });
    throwDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'no_org_found' });
  }
  if (role !== 'owner') {
    warn('billing.denied', { action, userId, orgId, role, reason: 'org_owner_required' });
    throwDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'org_owner_required' });
  }
}

// --- Checkout ---

interface UpgradeApi {
  upgradeSubscription: (req: {
    headers: Headers;
    body: Record<string, unknown>;
  }) => Promise<{ url?: string }>;
}

export async function createCheckout(
  db: Database,
  session: Session,
  request: Request,
  tier: string,
  interval: 'monthly' | 'yearly',
) {
  const { orgId, role } = await resolveOrgIdWithRole({
    db,
    session: session.session,
    userId: session.user.id,
  });
  requireOwnerOrg(orgId, role, 'checkout', session.user.id);

  if (!(CHECKOUT_ELIGIBLE_TIERS as readonly string[]).includes(tier)) {
    warn('billing.checkout_rejected', {
      orgId,
      userId: session.user.id,
      plan: tier,
      interval,
      reason: 'invalid_tier',
    });
    throwDomainError(VALIDATION_ERRORS.INVALID_INPUT, { field: 'tier', value: tier });
  }

  const currentBilling = await resolveOrgAccess(db, orgId);
  if (currentBilling.source === 'subscription' && currentBilling.effectivePlanId === tier) {
    warn('billing.checkout_rejected', {
      orgId,
      userId: session.user.id,
      plan: tier,
      interval,
      reason: 'already_on_plan',
    });
    throwDomainError(
      VALIDATION_ERRORS.INVALID_INPUT,
      { reason: 'already_on_plan', currentPlan: tier },
      `You are already subscribed to the ${tier} plan. To change your billing interval, use the billing portal.`,
    );
  }

  const validationResult = await validatePlanChange(db, orgId, tier);
  if (!validationResult.valid) {
    warn('billing.checkout_rejected', {
      orgId,
      userId: session.user.id,
      plan: tier,
      interval,
      reason: 'downgrade_exceeds_quotas',
      violations: validationResult.violations.map((v: { quotaKey: string }) => v.quotaKey),
    });
    throwDomainError(
      VALIDATION_ERRORS.INVALID_INPUT,
      {
        reason: 'downgrade_exceeds_quotas',
        violations: validationResult.violations,
        usage: validationResult.usage,
        targetPlan: validationResult.targetPlan,
      },
      validationResult.violations.map((v: { message: string }) => v.message).join(' '),
    );
  }

  if (currentBilling.source === 'subscription' && currentBilling.subscription) {
    const row = await db
      .select({
        stripeCustomerId: subscription.stripeCustomerId,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
      })
      .from(subscription)
      .where(eq(subscription.id, currentBilling.subscription.id))
      .get();
    if (row?.stripeCustomerId && row.stripeSubscriptionId) {
      return changeSubscriptionPrice(db, {
        orgId,
        userId: session.user.id,
        tier,
        interval,
        stripeCustomerId: row.stripeCustomerId,
        stripeSubscriptionId: row.stripeSubscriptionId,
      });
    }
  }

  info('billing.checkout_initiated', { orgId, userId: session.user.id, plan: tier, interval });

  const auth = createAuth(env);
  const api = auth.api as unknown as UpgradeApi;
  try {
    return await api.upgradeSubscription({
      headers: request.headers,
      body: {
        plan: tier,
        annual: interval === 'yearly',
        referenceId: orgId,
        successUrl: `${env.APP_URL || 'https://corates.org'}/settings/billing?success=true`,
        cancelUrl: `${env.APP_URL || 'https://corates.org'}/settings/billing?canceled=true`,
        returnUrl: `${env.APP_URL || 'https://corates.org'}/settings/billing?success=true`,
      },
    });
  } catch (err) {
    captureError(err, {
      tags: { component: 'billing', action: 'checkout' },
      extra: { orgId, userId: session.user.id, plan: tier, interval },
    });
    throw err;
  }
}

// Better Auth's own upgrade path sends existing subscribers through Stripe's
// customer portal, whose allowed-products list is dashboard-only configuration
// that has to be kept in step with every price change. Swapping the price on
// the subscription directly has no such dependency.
async function changeSubscriptionPrice(
  db: Database,
  args: {
    orgId: OrgId;
    userId: string;
    tier: string;
    interval: 'monthly' | 'yearly';
    stripeCustomerId: string;
    stripeSubscriptionId: string;
  },
) {
  const { orgId, userId, tier, interval, stripeCustomerId, stripeSubscriptionId } = args;
  const envKey = getStripeProductConfig(tier as PlanId).envKeys[interval];
  const priceId = envKey ? (env as unknown as Record<string, string | undefined>)[envKey] : null;
  if (!priceId) {
    captureError(new Error(`Missing Stripe price id for ${tier} ${interval}`), {
      tags: { component: 'billing', action: 'change-price' },
      extra: { orgId, tier, interval },
    });
    throwDomainError(VALIDATION_ERRORS.INVALID_INPUT, { field: 'tier', value: tier });
  }

  info('billing.price_change_initiated', { orgId, userId, plan: tier, interval });

  const stripe = createStripeClient(env.STRIPE_SECRET_KEY);
  try {
    const current = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    const item = current.items.data[0];
    if (!item) {
      throwDomainError(VALIDATION_ERRORS.INVALID_INPUT, { reason: 'subscription_has_no_items' });
    }
    await stripe.subscriptions.update(stripeSubscriptionId, {
      items: [{ id: item.id, price: priceId }],
      proration_behavior: 'always_invoice',
    });
    await syncStripeSubscription(env, db, stripeCustomerId);
  } catch (err) {
    captureError(err, {
      tags: { component: 'billing', action: 'change-price' },
      extra: { orgId, userId, plan: tier, interval, stripeSubscriptionId },
    });
    throw err;
  }

  info('billing.price_changed', { orgId, userId, plan: tier, interval, stripeSubscriptionId });
  return { url: `${env.APP_URL || 'https://corates.org'}/settings/billing?success=true` };
}

// --- Invoices ---

export type Invoice = {
  id: string;
  number: string | null;
  amount: number;
  currency: string;
  status: string | null;
  created: number;
  periodStart: number;
  periodEnd: number;
  pdfUrl: string | null;
  hostedUrl: string | null;
};

export type InvoicesResponse = { invoices: Invoice[] };

export async function fetchInvoices(db: Database, session: Session): Promise<InvoicesResponse> {
  const orgId = await resolveOrgId({
    db,
    session: session.session,
    userId: session.user.id,
  });

  requireOrg(orgId, 'invoices', session.user.id);

  const [orgSubscription] = await db
    .select({
      stripeCustomerId: subscription.stripeCustomerId,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
    })
    .from(subscription)
    .where(
      and(
        eq(subscription.referenceId, orgId),
        or(eq(subscription.status, 'active'), eq(subscription.status, 'trialing')),
      ),
    )
    .orderBy(desc(subscription.createdAt))
    .limit(1);

  if (!orgSubscription?.stripeCustomerId) {
    return { invoices: [] };
  }

  const stripe = createStripeClient(env.STRIPE_SECRET_KEY);
  let stripeInvoices;
  try {
    stripeInvoices = await stripe.invoices.list({
      customer: orgSubscription.stripeCustomerId,
      limit: 10,
    });
  } catch (err) {
    captureError(err, {
      tags: { component: 'billing', action: 'invoices' },
      extra: {
        orgId,
        userId: session.user.id,
        stripeCustomerId: orgSubscription.stripeCustomerId,
      },
    });
    throw err;
  }

  const invoices: Invoice[] = stripeInvoices.data.map(invoice => ({
    id: invoice.id,
    number: invoice.number,
    amount: invoice.amount_paid / 100,
    currency: invoice.currency,
    status: invoice.status as string | null,
    created: invoice.created,
    periodStart: invoice.period_start,
    periodEnd: invoice.period_end,
    pdfUrl: invoice.invoice_pdf ?? null,
    hostedUrl: invoice.hosted_invoice_url ?? null,
  }));

  return { invoices };
}

// --- Portal ---

interface PortalApi {
  createBillingPortal: (req: {
    headers: Headers;
    body: Record<string, unknown>;
  }) => Promise<{ url: string }>;
}

export async function createPortalSession(db: Database, session: Session, request: Request) {
  const { orgId, role } = await resolveOrgIdWithRole({
    db,
    session: session.session,
    userId: session.user.id,
  });
  requireOwnerOrg(orgId, role, 'portal', session.user.id);

  const auth = createAuth(env);
  const billingApi = auth.api as unknown as PortalApi;
  let result;
  try {
    result = await billingApi.createBillingPortal({
      headers: request.headers,
      body: {
        referenceId: orgId as string,
        returnUrl: `${env.APP_URL || 'https://corates.org'}/settings/billing`,
      },
    });
  } catch (err) {
    captureError(err, {
      tags: { component: 'billing', action: 'portal' },
      extra: { orgId, userId: session.user.id },
    });
    throw err;
  }
  info('billing.portal_opened', { orgId, userId: session.user.id });
  return result;
}

// --- Sync after checkout ---

export async function syncAfterCheckout(db: Database, session: Session) {
  const stripeCustomerId = (session.user as Record<string, unknown>).stripeCustomerId as
    string | null | undefined;
  if (!stripeCustomerId) {
    warn('billing.sync_after_checkout_skipped', {
      userId: session.user.id,
      reason: 'no_stripe_customer',
    });
    return { status: 'none', stripeSubscriptionId: null };
  }

  try {
    return await syncStripeSubscription(env, db, stripeCustomerId);
  } catch (err) {
    captureError(err, {
      tags: { component: 'billing', action: 'sync-after-checkout' },
      extra: { userId: session.user.id, stripeCustomerId },
    });
    throw err;
  }
}
