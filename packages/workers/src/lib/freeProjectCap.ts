import { eq } from 'drizzle-orm';
import { projects } from '@corates/db/schema';
import { resolveOrgAccess, type OrgBilling } from './billingResolver';
import { isUnlimitedQuota } from '@corates/shared/plans';
import { createDomainError, AUTH_ERRORS } from '@corates/shared';
import type { OrgId, UserId } from '@corates/shared/ids';
import type { Database } from '@corates/db/client';

/**
 * Free projects are attributed to their creator so a user cannot multiply the
 * Free quota by creating more workspaces. Creating a project requires owning the
 * workspace, so the creator is always the project owner. Only projects in orgs
 * that resolve to Free count; a paid or granted org never consumes a free slot.
 */
export async function countFreeProjectsOwnedByUser(db: Database, userId: UserId): Promise<number> {
  const owned = await db
    .select({ orgId: projects.orgId })
    .from(projects)
    .where(eq(projects.createdBy, userId))
    .all();

  const freeByOrg = new Map<OrgId, boolean>();
  let total = 0;
  for (const { orgId } of owned) {
    let isFree = freeByOrg.get(orgId);
    if (isFree === undefined) {
      isFree = (await resolveOrgAccess(db, orgId)).source === 'free';
      freeByOrg.set(orgId, isFree);
    }
    if (isFree) total += 1;
  }

  return total;
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
      `Free project cap reached: ${used} of ${limit} projects you own`,
    ),
  };
}
