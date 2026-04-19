/**
 * Stripe Checkout session for org subscriptions
 *
 * POST /api/billing/checkout — owner-only. Validates the target plan, blocks
 * "already on plan" and downgrade-violates-quota cases, then delegates to
 * Better Auth's Stripe plugin (`upgradeSubscription`).
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { getSession } from '@corates/workers/auth';
import { createAuth } from '@corates/workers/auth-config';
import { createDb } from '@corates/db/client';
import type { OrgId } from '@corates/shared/ids';
import { resolveOrgAccess, validatePlanChange } from '@corates/workers/billing-resolver';
import { requireOrgOwner } from '@corates/workers/policies';
import { DEFAULT_PLAN } from '@corates/shared/plans';
import {
  createDomainError,
  isDomainError,
  AUTH_ERRORS,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
  type DomainError,
} from '@corates/shared';
import { resolveOrgIdWithRole } from '@/server/billing-context';
import { BILLING_CHECKOUT_RATE_LIMIT, checkRateLimit } from '@/server/rateLimit';

interface CheckoutBody {
  tier?: unknown;
  interval?: unknown;
}

interface UpgradeApi {
  upgradeSubscription: (req: {
    headers: Headers;
    body: Record<string, unknown>;
  }) => Promise<{ url?: string }>;
}

export const handlePost = async ({ request }: { request: Request }) => {
  const limit = checkRateLimit(request, env, BILLING_CHECKOUT_RATE_LIMIT);
  if (limit.blocked) return limit.blocked;

  const session = await getSession(request, env);
  if (!session) {
    const error = createDomainError(AUTH_ERRORS.REQUIRED, { reason: 'no_user' });
    return Response.json(error, { status: 401, headers: limit.headers });
  }

  let body: CheckoutBody = {};
  try {
    body = (await request.json()) as CheckoutBody;
  } catch {
    return Response.json(
      createDomainError(VALIDATION_ERRORS.INVALID_INPUT, { reason: 'invalid_json' }),
      { status: 400, headers: limit.headers },
    );
  }

  const tier = typeof body.tier === 'string' ? body.tier : '';
  const interval =
    body.interval === 'yearly' || body.interval === 'monthly' ? body.interval : 'monthly';

  if (!tier) {
    return Response.json(
      createDomainError(VALIDATION_ERRORS.INVALID_INPUT, { field: 'tier', value: tier }),
      { status: 400, headers: limit.headers },
    );
  }

  const db = createDb(env.DB);

  try {
    const { orgId, role } = await resolveOrgIdWithRole({
      db,
      session: session.session,
      userId: session.user.id,
    });

    requireOrgOwner({ orgId, role });

    if (tier === DEFAULT_PLAN) {
      return Response.json(
        createDomainError(VALIDATION_ERRORS.INVALID_INPUT, { field: 'tier', value: tier }),
        { status: 400, headers: limit.headers },
      );
    }

    const currentBilling = await resolveOrgAccess(db, orgId as OrgId);
    if (currentBilling.source === 'subscription' && currentBilling.effectivePlanId === tier) {
      return Response.json(
        createDomainError(
          VALIDATION_ERRORS.INVALID_INPUT,
          { reason: 'already_on_plan', currentPlan: tier },
          `You are already subscribed to the ${tier} plan. To change your billing interval, use the billing portal.`,
        ),
        { status: 400, headers: limit.headers },
      );
    }

    const validationResult = await validatePlanChange(db, orgId as string, tier);
    if (!validationResult.valid) {
      return Response.json(
        createDomainError(
          VALIDATION_ERRORS.INVALID_INPUT,
          {
            reason: 'downgrade_exceeds_quotas',
            violations: validationResult.violations,
            usage: validationResult.usage,
            targetPlan: validationResult.targetPlan,
          },
          validationResult.violations.map(v => v.message).join(' '),
        ),
        { status: 400, headers: limit.headers },
      );
    }

    console.info('checkout_initiated', { orgId, userId: session.user.id, plan: tier, interval });

    const auth = createAuth(env);
    const api = auth.api as unknown as UpgradeApi;
    const result = await api.upgradeSubscription({
      headers: request.headers,
      body: {
        plan: tier,
        annual: interval === 'yearly',
        referenceId: orgId,
        successUrl: `${env.APP_URL || 'https://corates.org'}/settings/billing?success=true`,
        cancelUrl: `${env.APP_URL || 'https://corates.org'}/settings/billing?canceled=true`,
        returnUrl: `${env.APP_URL || 'https://corates.org'}/settings/billing`,
      },
    });

    return Response.json(result, { status: 200, headers: limit.headers });
  } catch (err) {
    console.error('checkout_failed:', err);
    if (isDomainError(err)) {
      const domain = err as DomainError;
      return Response.json(domain, {
        status: domain.statusCode ?? 403,
        headers: limit.headers,
      });
    }
    const error = err as Error;
    const systemError = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
      operation: 'create_checkout_session',
      originalError: error.message,
    });
    return Response.json(systemError, { status: 500, headers: limit.headers });
  }
};

export const Route = createFileRoute('/api/billing/checkout')({
  server: { handlers: { POST: handlePost } },
});
