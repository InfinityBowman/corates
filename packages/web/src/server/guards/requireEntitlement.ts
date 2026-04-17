import { createDb } from '@corates/db/client';
import { resolveOrgAccess } from '@corates/workers/billing-resolver';
import {
  createDomainError,
  isDomainError,
  AUTH_ERRORS,
  SYSTEM_ERRORS,
} from '@corates/shared';

export type EntitlementGuardResult =
  | { ok: true; orgBilling: Awaited<ReturnType<typeof resolveOrgAccess>> }
  | { ok: false; response: Response };

export async function requireEntitlement(
  env: Env,
  orgId: string,
  entitlement: string,
): Promise<EntitlementGuardResult> {
  if (!orgId) {
    return {
      ok: false,
      response: Response.json(
        createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'org_context_required' }),
        { status: 403 },
      ),
    };
  }

  const db = createDb(env.DB);
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

  if (!(orgBilling.entitlements as unknown as Record<string, boolean>)[entitlement]) {
    return {
      ok: false,
      response: Response.json(
        createDomainError(
          AUTH_ERRORS.FORBIDDEN,
          { reason: 'missing_entitlement', entitlement },
          `This feature requires the '${entitlement}' entitlement. Please upgrade your plan.`,
        ),
        { status: 403 },
      ),
    };
  }

  return { ok: true, orgBilling };
}
