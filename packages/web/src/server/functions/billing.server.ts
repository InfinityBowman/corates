import type { Database } from '@corates/db/client';
import { resolveOrgAccess, getOrgResourceUsage } from '@corates/workers/billing-resolver';
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
