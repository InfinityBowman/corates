import type { Database } from '@corates/db/client';
import { resolveOrgAccess } from '@corates/workers/billing-resolver';
import {
  createDomainError,
  DomainErrorException,
  isDomainError,
  AUTH_ERRORS,
  SYSTEM_ERRORS,
} from '@corates/shared';
import type { OrgId } from '@corates/shared/ids';

export type EntitlementGuardResult =
  | { ok: true; orgBilling: Awaited<ReturnType<typeof resolveOrgAccess>> }
  | { ok: false; error: DomainErrorException };

export async function requireEntitlement(
  db: Database,
  orgId: OrgId,
  entitlement: string,
): Promise<EntitlementGuardResult> {
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
    if (isDomainError(err)) {
      return { ok: false, error: new DomainErrorException(err) };
    }
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

  if (!(orgBilling.entitlements as unknown as Record<string, boolean>)[entitlement]) {
    return {
      ok: false,
      error: new DomainErrorException(
        createDomainError(
          AUTH_ERRORS.FORBIDDEN,
          { reason: 'missing_entitlement', entitlement },
          `This feature requires the '${entitlement}' entitlement. Please upgrade your plan.`,
        ),
      ),
    };
  }

  return { ok: true, orgBilling };
}
