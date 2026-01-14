import { eq, and, desc, isNull, ne, count } from 'drizzle-orm';
import { subscription, orgAccessGrants, projects, member } from '@/db/schema';
import { getActiveGrantsByOrgId } from '@/db/orgAccessGrants';
import { getPlan, DEFAULT_PLAN, getGrantPlan, isUnlimitedQuota } from '@corates/shared/plans';
import { isSubscriptionActive } from './subscriptionStatus';
import type { GrantType, Quotas } from '@corates/shared/plans';
import type { Database } from '../db/client';
import type { OrgBilling } from '../types';

interface SubscriptionRecord {
  id: string;
  referenceId: string;
  status: string;
  plan: string;
  periodEnd: Date | number | null;
  cancelAtPeriodEnd: boolean | null;
}

interface GrantRecord {
  id: string;
  type: GrantType;
  expiresAt: Date | number | null;
  orgId: string;
  revokedAt: Date | null;
}

/**
 * Check if subscription is active for billing purposes.
 * Includes trialing and past_due statuses within their grace periods.
 */
function isSubscriptionActiveForBilling(
  sub: SubscriptionRecord | null,
  now: Date | number,
): boolean {
  return isSubscriptionActive(sub, now, { includeTrial: true, includePastDue: true });
}

async function getActiveSubscription(
  db: Database,
  orgId: string,
  now: number,
): Promise<SubscriptionRecord | null> {
  const subscriptions = await db
    .select()
    .from(subscription)
    .where(eq(subscription.referenceId, orgId))
    .orderBy(desc(subscription.periodEnd))
    .all();

  if (subscriptions.length === 0) {
    return null;
  }

  const activeSubscriptions = subscriptions.filter(sub =>
    isSubscriptionActiveForBilling(sub as SubscriptionRecord, now),
  );

  if (activeSubscriptions.length === 0) {
    return (subscriptions[0] as SubscriptionRecord) || null;
  }

  if (activeSubscriptions.length > 1) {
    console.warn(
      `[BillingResolver] Multiple active subscriptions found for org ${orgId}. Using latest periodEnd.`,
    );
    return activeSubscriptions[0] as SubscriptionRecord;
  }

  return activeSubscriptions[0] as SubscriptionRecord;
}

export async function resolveOrgAccess(
  db: Database,
  orgId: string,
  now: Date | number = new Date(),
): Promise<OrgBilling> {
  const nowDate = now instanceof Date ? now : new Date(now * 1000);
  const nowTimestamp = Math.floor(nowDate.getTime() / 1000);

  const activeSubscription = await getActiveSubscription(db, orgId, nowTimestamp);

  if (activeSubscription && isSubscriptionActiveForBilling(activeSubscription, nowTimestamp)) {
    const plan = getPlan(activeSubscription.plan);
    return {
      effectivePlanId: activeSubscription.plan,
      source: 'subscription',
      accessMode: 'full',
      entitlements: plan.entitlements,
      quotas: plan.quotas,
      subscription: {
        id: activeSubscription.id,
        status: activeSubscription.status,
        periodEnd: activeSubscription.periodEnd,
        cancelAtPeriodEnd: activeSubscription.cancelAtPeriodEnd,
      },
      grant: null,
    };
  }

  const activeGrants = await getActiveGrantsByOrgId(db, orgId, nowDate);

  if (activeGrants.length > 0) {
    let selectedGrant: GrantRecord | null = null;
    let selectedType: string | null = null;

    for (const grant of activeGrants) {
      const grantRecord = grant as GrantRecord;
      if (grantRecord.type === 'trial') {
        if (!selectedGrant || selectedType !== 'trial') {
          selectedGrant = grantRecord;
          selectedType = 'trial';
        } else {
          const currentExpires =
            selectedGrant.expiresAt instanceof Date ?
              Math.floor(selectedGrant.expiresAt.getTime() / 1000)
            : (selectedGrant.expiresAt as number);
          const grantExpires =
            grantRecord.expiresAt instanceof Date ?
              Math.floor(grantRecord.expiresAt.getTime() / 1000)
            : (grantRecord.expiresAt as number);
          if (grantExpires > currentExpires) {
            selectedGrant = grantRecord;
          }
        }
      } else if (grantRecord.type === 'single_project') {
        if (!selectedGrant || selectedType === 'single_project') {
          if (!selectedGrant || selectedType !== 'trial') {
            if (!selectedGrant) {
              selectedGrant = grantRecord;
              selectedType = 'single_project';
            } else {
              const currentExpires =
                selectedGrant.expiresAt instanceof Date ?
                  Math.floor(selectedGrant.expiresAt.getTime() / 1000)
                : (selectedGrant.expiresAt as number);
              const grantExpires =
                grantRecord.expiresAt instanceof Date ?
                  Math.floor(grantRecord.expiresAt.getTime() / 1000)
                : (grantRecord.expiresAt as number);
              if (grantExpires > currentExpires) {
                selectedGrant = grantRecord;
              }
            }
          }
        }
      }
    }

    if (selectedGrant) {
      const grantPlan = getGrantPlan(selectedGrant.type);
      return {
        effectivePlanId: selectedGrant.type,
        source: 'grant',
        accessMode: 'full',
        entitlements: grantPlan.entitlements,
        quotas: grantPlan.quotas,
        subscription: null,
        grant: {
          id: selectedGrant.id,
          type: selectedGrant.type,
          expiresAt: selectedGrant.expiresAt,
        },
      };
    }
  }

  const allGrants = await db
    .select()
    .from(orgAccessGrants)
    .where(and(eq(orgAccessGrants.orgId, orgId), isNull(orgAccessGrants.revokedAt)))
    .orderBy(desc(orgAccessGrants.expiresAt))
    .all();

  const expiredGrants = allGrants.filter(grant => {
    const grantRecord = grant as GrantRecord;
    const expiresAt =
      grantRecord.expiresAt instanceof Date ?
        Math.floor(grantRecord.expiresAt.getTime() / 1000)
      : (grantRecord.expiresAt as number);
    return expiresAt <= nowTimestamp;
  });

  if (expiredGrants.length > 0) {
    const expiredGrant = expiredGrants[0] as GrantRecord;
    const grantPlan = getGrantPlan(expiredGrant.type);
    return {
      effectivePlanId: expiredGrant.type,
      source: 'grant',
      accessMode: 'readOnly',
      entitlements: grantPlan.entitlements,
      quotas: grantPlan.quotas,
      subscription: null,
      grant: {
        id: expiredGrant.id,
        type: expiredGrant.type,
        expiresAt: expiredGrant.expiresAt,
      },
    };
  }

  const freePlan = getPlan(DEFAULT_PLAN);
  return {
    effectivePlanId: DEFAULT_PLAN,
    source: 'free',
    accessMode: 'free',
    entitlements: freePlan.entitlements,
    quotas: freePlan.quotas,
    subscription: null,
    grant: null,
  };
}

interface OrgResourceUsage {
  projects: number;
  collaborators: number;
}

export async function getOrgResourceUsage(db: Database, orgId: string): Promise<OrgResourceUsage> {
  const [projectResult] = await db
    .select({ count: count() })
    .from(projects)
    .where(eq(projects.orgId, orgId));

  const [memberResult] = await db
    .select({ count: count() })
    .from(member)
    .where(and(eq(member.organizationId, orgId), ne(member.role, 'owner')));

  return {
    projects: projectResult?.count || 0,
    collaborators: memberResult?.count || 0,
  };
}

interface QuotaViolation {
  quotaKey: string;
  used: number;
  limit: number;
  message: string;
}

interface PlanChangeValidation {
  valid: boolean;
  violations: QuotaViolation[];
  usage: OrgResourceUsage;
  targetPlan: {
    id: string;
    name: string;
    quotas: Quotas;
  };
}

export async function validatePlanChange(
  db: Database,
  orgId: string,
  targetPlanId: string,
): Promise<PlanChangeValidation> {
  const targetPlan = getPlan(targetPlanId);
  const usage = await getOrgResourceUsage(db, orgId);

  const violations: QuotaViolation[] = [];

  const projectsLimit = targetPlan.quotas['projects.max'];
  if (!isUnlimitedQuota(projectsLimit) && usage.projects > projectsLimit) {
    violations.push({
      quotaKey: 'projects.max',
      used: usage.projects,
      limit: projectsLimit,
      message: `You have ${usage.projects} projects, but the ${targetPlan.name} plan only allows ${projectsLimit}. Please archive or delete ${usage.projects - projectsLimit} project(s) before downgrading.`,
    });
  }

  const collaboratorsLimit = targetPlan.quotas['collaborators.org.max'];
  if (!isUnlimitedQuota(collaboratorsLimit) && usage.collaborators > collaboratorsLimit) {
    violations.push({
      quotaKey: 'collaborators.org.max',
      used: usage.collaborators,
      limit: collaboratorsLimit,
      message: `You have ${usage.collaborators} team members, but the ${targetPlan.name} plan only allows ${collaboratorsLimit}. Please remove ${usage.collaborators - collaboratorsLimit} team member(s) before downgrading.`,
    });
  }

  return {
    valid: violations.length === 0,
    violations,
    usage,
    targetPlan: {
      id: targetPlanId,
      name: targetPlan.name,
      quotas: targetPlan.quotas,
    },
  };
}
