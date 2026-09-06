import { and, count, eq, inArray } from 'drizzle-orm';
import { member, projects } from '@corates/db/schema';
import { resolveOrgAccess, type OrgBilling } from './billingResolver';
import { isUnlimitedQuota } from '@corates/shared/plans';
import { createDomainError, AUTH_ERRORS } from '@corates/shared';
import type { OrgId, UserId } from '@corates/shared/ids';
import type { Database } from '@corates/db/client';

/**
 * Free projects are attributed to org owners so a user cannot multiply the
 * Free quota by creating more orgs. Only orgs that resolve to Free count; a
 * paid or granted org never consumes its owner's free slot.
 */
export async function countFreeProjectsOwnedByUser(db: Database, userId: UserId): Promise<number> {
  const owned = await db
    .select({ orgId: member.organizationId })
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.role, 'owner')))
    .all();

  const freeOrgIds: string[] = [];
  for (const { orgId } of owned) {
    const billing = await resolveOrgAccess(db, orgId as OrgId);
    if (billing.source === 'free') freeOrgIds.push(orgId);
  }

  if (freeOrgIds.length === 0) return 0;

  const [result] = await db
    .select({ count: count() })
    .from(projects)
    .where(inArray(projects.orgId, freeOrgIds));

  return result?.count || 0;
}

type FreeProjectCapResult =
  { allowed: true } | { allowed: false; error: ReturnType<typeof createDomainError> };

export async function checkFreeProjectCap(
  db: Database,
  userId: UserId,
  orgId: OrgId,
  orgBilling?: OrgBilling,
): Promise<FreeProjectCapResult> {
  const billing = orgBilling ?? (await resolveOrgAccess(db, orgId));
  if (billing.source !== 'free') return { allowed: true };

  const limit = billing.quotas['projects.max'];
  if (isUnlimitedQuota(limit)) return { allowed: true };

  const used = await countFreeProjectsOwnedByUser(db, userId);
  if (used < limit) return { allowed: true };

  return {
    allowed: false,
    error: createDomainError(
      AUTH_ERRORS.FORBIDDEN,
      { reason: 'free_project_cap', quotaKey: 'projects.max', used, limit, requested: 1 },
      `Free project cap reached: ${used} of ${limit} across workspaces you own`,
    ),
  };
}
