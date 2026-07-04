import type { Database } from '@corates/db/client';
import { resolveOrgAccess } from '@corates/workers/billing-resolver';
import { isUnlimitedQuota } from '@corates/shared/plans';
import {
  createDomainError,
  DomainErrorException,
  AUTH_ERRORS,
  SYSTEM_ERRORS,
} from '@corates/shared';
import type { OrgId } from '@corates/shared/ids';

export type QuotaGuardResult =
  | { ok: true; orgBilling: Awaited<ReturnType<typeof resolveOrgAccess>> }
  | { ok: false; error: DomainErrorException };

export async function requireQuota(
  db: Database,
  orgId: OrgId,
  quotaKey: string,
  getUsage: () => Promise<number>,
  requested: number = 1,
): Promise<QuotaGuardResult> {
  if (!orgId) {
    return {
      ok: false,
      error: new DomainErrorException(
        createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'org_context_required' }),
      ),
    };
  }

  let orgBilling;
  try {
    orgBilling = await resolveOrgAccess(db, orgId);
  } catch (err) {
    return {
      ok: false,
      error: new DomainErrorException(
        createDomainError(SYSTEM_ERRORS.DB_ERROR, {
          operation: 'resolve_org_access',
          originalError: err instanceof Error ? err.message : String(err),
        }),
      ),
    };
  }

  const used = await getUsage();
  const limit = (orgBilling.quotas as unknown as Record<string, number>)[quotaKey];
  if (!isUnlimitedQuota(limit) && used + requested > limit) {
    return {
      ok: false,
      error: new DomainErrorException(
        createDomainError(
          AUTH_ERRORS.FORBIDDEN,
          { reason: 'quota_exceeded', quotaKey, used, limit, requested },
          `Quota exceeded: ${quotaKey}. Current usage: ${used}, Limit: ${
            isUnlimitedQuota(limit) ? 'unlimited' : limit
          }, Requested: ${requested}`,
        ),
      ),
    };
  }

  return { ok: true, orgBilling };
}
