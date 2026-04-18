import { createDb } from '@corates/db/client';
import { resolveOrgAccess } from '@corates/workers/billing-resolver';
import { isUnlimitedQuota } from '@corates/shared/plans';
import { createDomainError, AUTH_ERRORS, SYSTEM_ERRORS } from '@corates/shared';

export type QuotaGuardResult =
  | { ok: true; orgBilling: Awaited<ReturnType<typeof resolveOrgAccess>> }
  | { ok: false; response: Response };

export async function requireQuota(
  env: Env,
  orgId: string,
  quotaKey: string,
  getUsage: () => Promise<number>,
  requested: number = 1,
): Promise<QuotaGuardResult> {
  if (!orgId) {
    return {
      ok: false,
      response: Response.json(
        createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'org_context_required' }),
        { status: 403 },
      ),
    };
  }

  let orgBilling;
  try {
    const db = createDb(env.DB);
    orgBilling = await resolveOrgAccess(db, orgId);
  } catch (err) {
    return {
      ok: false,
      response: Response.json(
        createDomainError(SYSTEM_ERRORS.DB_ERROR, {
          operation: 'resolve_org_access',
          originalError: err instanceof Error ? err.message : String(err),
        }),
        { status: 500 },
      ),
    };
  }

  const used = await getUsage();
  const limit = (orgBilling.quotas as unknown as Record<string, number>)[quotaKey];
  if (!isUnlimitedQuota(limit) && used + requested > limit) {
    return {
      ok: false,
      response: Response.json(
        createDomainError(
          AUTH_ERRORS.FORBIDDEN,
          { reason: 'quota_exceeded', quotaKey, used, limit, requested },
          `Quota exceeded: ${quotaKey}. Current usage: ${used}, Limit: ${
            isUnlimitedQuota(limit) ? 'unlimited' : limit
          }, Requested: ${requested}`,
        ),
        { status: 403 },
      ),
    };
  }

  return { ok: true, orgBilling };
}
