import { env } from 'cloudflare:workers';
import type Stripe from 'stripe';
import type { Database } from '@corates/db/client';
import {
  resolveOrgAccess,
  getOrgResourceUsage,
  validatePlanChange as resolvePlanValidation,
} from '@corates/workers/billing-resolver';
import { createStripeClient, isStripeConfigured } from '@corates/workers/stripe';
import { createAuth } from '@corates/workers/auth-config';
import { projects } from '@corates/db/schema';
import { count, eq } from 'drizzle-orm';
import { getPlan, getGrantPlan, type GrantType } from '@corates/shared/plans';
import { createDomainError, AUTH_ERRORS } from '@corates/shared';
import { resolveOrgId } from '@/server/billing-context';
import type { Session } from '@/server/middleware/auth';

export async function fetchUsage(db: Database, session: Session) {
  const orgId = await resolveOrgId({
    db,
    session: session.session,
    userId: session.user.id,
  });

  if (!orgId) {
    throw Response.json(createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'no_org_found' }), {
      status: 403,
    });
  }

  const usage = await getOrgResourceUsage(db, orgId);
  return { projects: usage.projects, collaborators: usage.collaborators };
}

export async function fetchSubscription(db: Database, session: Session) {
  const orgId = await resolveOrgId({
    db,
    session: session.session,
    userId: session.user.id,
  });

  if (!orgId) {
    throw Response.json(createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'no_org_found' }), {
      status: 403,
    });
  }

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

  if (!orgId) {
    throw Response.json(createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'no_org_found' }), {
      status: 403,
    });
  }

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
    console.error('validate_coupon_failed: Stripe not configured');
    return { valid: false as const, error: 'Payment system not available' };
  }

  try {
    const stripe = createStripeClient(env);
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
    console.error('validate_coupon_error:', err);
    return { valid: false as const, error: 'Failed to validate promo code' };
  }
}

export async function fetchPlanValidation(db: Database, session: Session, targetPlan: string) {
  const orgId = await resolveOrgId({
    db,
    session: session.session,
    userId: session.user.id,
  });

  if (!orgId) {
    throw Response.json(createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'no_org_found' }), {
      status: 403,
    });
  }

  return resolvePlanValidation(db, orgId, targetPlan);
}
