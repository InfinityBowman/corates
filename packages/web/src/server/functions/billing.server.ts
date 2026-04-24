import { env } from 'cloudflare:workers';
import type Stripe from 'stripe';
import type { Database } from '@corates/db/client';
import type { OrgId, OrgAccessGrantId } from '@corates/shared/ids';
import {
  resolveOrgAccess,
  getOrgResourceUsage,
  validatePlanChange,
} from '@corates/workers/billing-resolver';
import { createStripeClient, isStripeConfigured } from '@corates/workers/stripe';
import { createAuth } from '@corates/workers/auth-config';
import {
  createSingleProjectCheckout as createSPCheckoutCmd,
  syncStripeSubscription,
} from '@corates/workers/commands/billing';
import { createGrant, getGrantByOrgIdAndType } from '@corates/db/org-access-grants';
import { GRANT_CONFIG } from '@corates/workers/constants';
import { projects, subscription, user as userTable } from '@corates/db/schema';
import { and, count, desc, eq, or } from 'drizzle-orm';
import { getPlan, getGrantPlan, DEFAULT_PLAN, type GrantType } from '@corates/shared/plans';
import { createDomainError, AUTH_ERRORS, VALIDATION_ERRORS } from '@corates/shared';
import { resolveOrgId, resolveOrgIdWithRole } from '@/server/billing-context';
import {
  BILLING_CHECKOUT_RATE_LIMIT,
  BILLING_PORTAL_RATE_LIMIT,
  checkRateLimit,
} from '@/server/rateLimit';
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

  return validatePlanChange(db, orgId, targetPlan);
}

// --- Helpers ---

function requireOwnerOrg(orgId: OrgId | null, role: string | null): asserts orgId is OrgId {
  if (!orgId) {
    throw Response.json(createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'no_org_found' }), {
      status: 403,
    });
  }
  if (role !== 'owner') {
    throw Response.json(
      createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'org_owner_required' }),
      { status: 403 },
    );
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
  const limit = checkRateLimit(request, env, BILLING_CHECKOUT_RATE_LIMIT);
  if (limit.blocked) throw limit.blocked;

  const { orgId, role } = await resolveOrgIdWithRole({
    db,
    session: session.session,
    userId: session.user.id,
  });
  requireOwnerOrg(orgId, role);

  if (tier === DEFAULT_PLAN) {
    throw Response.json(
      createDomainError(VALIDATION_ERRORS.INVALID_INPUT, { field: 'tier', value: tier }),
      { status: 400 },
    );
  }

  const currentBilling = await resolveOrgAccess(db, orgId);
  if (currentBilling.source === 'subscription' && currentBilling.effectivePlanId === tier) {
    throw Response.json(
      createDomainError(
        VALIDATION_ERRORS.INVALID_INPUT,
        { reason: 'already_on_plan', currentPlan: tier },
        `You are already subscribed to the ${tier} plan. To change your billing interval, use the billing portal.`,
      ),
      { status: 400 },
    );
  }

  const validationResult = await validatePlanChange(db, orgId, tier);
  if (!validationResult.valid) {
    throw Response.json(
      createDomainError(
        VALIDATION_ERRORS.INVALID_INPUT,
        {
          reason: 'downgrade_exceeds_quotas',
          violations: validationResult.violations,
          usage: validationResult.usage,
          targetPlan: validationResult.targetPlan,
        },
        validationResult.violations.map((v: { message: string }) => v.message).join(' '),
      ),
      { status: 400 },
    );
  }

  console.info('checkout_initiated', { orgId, userId: session.user.id, plan: tier, interval });

  const auth = createAuth(env);
  const api = auth.api as unknown as UpgradeApi;
  return api.upgradeSubscription({
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

  if (!orgId) {
    throw Response.json(createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'no_org_found' }), {
      status: 403,
    });
  }

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

  const stripe = createStripeClient(env);
  const stripeInvoices = await stripe.invoices.list({
    customer: orgSubscription.stripeCustomerId,
    limit: 10,
  });

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
  const limit = checkRateLimit(request, env, BILLING_PORTAL_RATE_LIMIT);
  if (limit.blocked) throw limit.blocked;

  const { orgId, role } = await resolveOrgIdWithRole({
    db,
    session: session.session,
    userId: session.user.id,
  });
  requireOwnerOrg(orgId, role);

  const auth = createAuth(env);
  const billingApi = auth.api as unknown as PortalApi;
  return billingApi.createBillingPortal({
    headers: request.headers,
    body: {
      referenceId: orgId as string,
      returnUrl: `${env.APP_URL || 'https://corates.org'}/settings/billing`,
    },
  });
}

// --- Single-project checkout ---

export async function createSPCheckout(db: Database, session: Session, request: Request) {
  const limit = checkRateLimit(request, env, BILLING_CHECKOUT_RATE_LIMIT);
  if (limit.blocked) throw limit.blocked;

  const { orgId, role } = await resolveOrgIdWithRole({
    db,
    session: session.session,
    userId: session.user.id,
  });
  requireOwnerOrg(orgId, role);

  console.info('single_project_checkout_initiated', { orgId, userId: session.user.id });

  const userRecord = await db
    .select({ stripeCustomerId: userTable.stripeCustomerId })
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .get();

  return createSPCheckoutCmd(
    env,
    {
      id: session.user.id,
      stripeCustomerId: userRecord?.stripeCustomerId || null,
    },
    { orgId: orgId as string },
  );
}

// --- Trial ---

export async function beginTrial(db: Database, session: Session) {
  const { orgId, role } = await resolveOrgIdWithRole({
    db,
    session: session.session,
    userId: session.user.id,
  });
  requireOwnerOrg(orgId, role);

  const existingTrial = await getGrantByOrgIdAndType(db, orgId as OrgId, 'trial');
  if (existingTrial) {
    throw Response.json(
      createDomainError(
        VALIDATION_ERRORS.INVALID_INPUT,
        { field: 'trial', value: 'already_exists' },
        'Trial grant already exists for this organization. Each organization can only have one trial grant.',
      ),
      { status: 400 },
    );
  }

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + GRANT_CONFIG.TRIAL_DAYS);

  const grantId = crypto.randomUUID() as OrgAccessGrantId;
  await createGrant(db, {
    id: grantId,
    orgId: orgId as OrgId,
    type: 'trial',
    startsAt: now,
    expiresAt,
  });

  return {
    success: true as const,
    grantId,
    expiresAt: Math.floor(expiresAt.getTime() / 1000),
  };
}

// --- Sync after checkout ---

export async function syncAfterCheckout(db: Database, session: Session) {
  const stripeCustomerId = (session.user as Record<string, unknown>).stripeCustomerId as
    | string
    | null
    | undefined;
  if (!stripeCustomerId) {
    return { status: 'none', stripeSubscriptionId: null };
  }

  return syncStripeSubscription(env, db, stripeCustomerId);
}
