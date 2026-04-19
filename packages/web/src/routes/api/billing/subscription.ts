/**
 * Org subscription/billing status route
 *
 * GET /api/billing/subscription — effective plan, status, period info, source,
 * and project count for the active org. Used by the BillingSettings UI.
 */
import { createFileRoute } from '@tanstack/react-router';
import type { Database } from '@corates/db/client';
import { resolveOrgAccess } from '@corates/workers/billing-resolver';
import { projects } from '@corates/db/schema';
import { count, eq } from 'drizzle-orm';
import { getPlan, getGrantPlan, type GrantType } from '@corates/shared/plans';
import { createDomainError, AUTH_ERRORS, SYSTEM_ERRORS } from '@corates/shared';
import { resolveOrgId } from '@/server/billing-context';
import { authMiddleware, type Session } from '@/server/middleware/auth';

export const handleGet = async ({
  context: { db, session },
}: {
  request: Request;
  context: { db: Database; session: Session };
}) => {
  try {
    const orgId = await resolveOrgId({
      db,
      session: session.session,
      userId: session.user.id,
    });

    if (!orgId) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'no_org_found' });
      return Response.json(error, { status: 403 });
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

    return Response.json(
      {
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
      },
      { status: 200 },
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching org billing:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_org_billing',
      originalError: error.message,
    });
    return Response.json(dbError, { status: 500 });
  }
};

export const Route = createFileRoute('/api/billing/subscription')({
  server: { middleware: [authMiddleware], handlers: { GET: handleGet } },
});
