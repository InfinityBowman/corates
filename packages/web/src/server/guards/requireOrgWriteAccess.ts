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

export interface WriteAccessResult {
  ok: true;
  orgBilling: Awaited<ReturnType<typeof resolveOrgAccess>>;
}

export type OrgWriteAccessGuardResult =
  | WriteAccessResult
  | { ok: false; error: DomainErrorException };

export async function requireOrgWriteAccess(
  method: string,
  db: Database,
  orgId: OrgId,
): Promise<OrgWriteAccessGuardResult> {
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    const orgBilling = await resolveOrgAccess(db, orgId);
    return { ok: true, orgBilling };
  }

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

  if (orgBilling.accessMode === 'readOnly') {
    return {
      ok: false,
      error: new DomainErrorException(
        createDomainError(
          AUTH_ERRORS.FORBIDDEN,
          { reason: 'read_only_access', source: orgBilling.source },
          'This organization has read-only access. Please renew your subscription or purchase a plan to make changes.',
        ),
      ),
    };
  }

  return { ok: true, orgBilling };
}
