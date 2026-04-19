import type { Database } from '@corates/db/client';
import { resolveOrgAccess } from '@corates/workers/billing-resolver';
import { createDomainError, isDomainError, AUTH_ERRORS, SYSTEM_ERRORS } from '@corates/shared';
import type { OrgId } from '@corates/shared/ids';

export interface WriteAccessResult {
  ok: true;
  orgBilling: Awaited<ReturnType<typeof resolveOrgAccess>>;
}

export type OrgWriteAccessGuardResult = WriteAccessResult | { ok: false; response: Response };

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
      response: Response.json(
        createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'org_context_required' }),
        { status: 403 },
      ),
    };
  }

  let orgBilling;
  try {
    orgBilling = await resolveOrgAccess(db, orgId);
  } catch (err) {
    if (isDomainError(err)) {
      return { ok: false, response: Response.json(err, { status: err.statusCode }) };
    }
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

  if (orgBilling.accessMode === 'readOnly') {
    return {
      ok: false,
      response: Response.json(
        createDomainError(
          AUTH_ERRORS.FORBIDDEN,
          { reason: 'read_only_access', source: orgBilling.source },
          'This organization has read-only access. Please renew your subscription or purchase a plan to make changes.',
        ),
        { status: 403 },
      ),
    };
  }

  return { ok: true, orgBilling };
}
