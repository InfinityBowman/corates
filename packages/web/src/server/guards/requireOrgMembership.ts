import { createDb } from '@corates/db/client';
import { member, organization } from '@corates/db/schema';
import { and, eq } from 'drizzle-orm';
import { hasOrgRole } from '@corates/workers/policies';
import { createDomainError, AUTH_ERRORS } from '@corates/shared';
import type { OrgId, UserId } from '@corates/shared/ids';
import { getSession } from '@corates/workers/auth';

export interface OrgContext {
  userId: UserId;
  userEmail: string;
  orgId: OrgId;
  orgRole: string;
  orgName: string;
  orgSlug: string | null;
}

export type OrgGuardResult = { ok: true; context: OrgContext } | { ok: false; response: Response };

export async function requireOrgMembership(
  request: Request,
  env: Env,
  orgId: OrgId,
  minRole?: string,
): Promise<OrgGuardResult> {
  const session = await getSession(request, env);
  if (!session) {
    return {
      ok: false,
      response: Response.json(createDomainError(AUTH_ERRORS.REQUIRED), { status: 401 }),
    };
  }

  if (!orgId) {
    return {
      ok: false,
      response: Response.json(
        createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'org_id_required' }),
        { status: 403 },
      ),
    };
  }

  const db = createDb(env.DB);
  const membership = await db
    .select({
      id: member.id,
      role: member.role,
      orgName: organization.name,
      orgSlug: organization.slug,
    })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(and(eq(member.organizationId, orgId), eq(member.userId, session.user.id as UserId)))
    .get();

  if (!membership) {
    return {
      ok: false,
      response: Response.json(
        createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'not_org_member', orgId }),
        { status: 403 },
      ),
    };
  }

  if (minRole && !hasOrgRole(membership.role, minRole)) {
    return {
      ok: false,
      response: Response.json(
        createDomainError(
          AUTH_ERRORS.FORBIDDEN,
          { reason: 'insufficient_org_role', required: minRole, actual: membership.role },
          `This action requires ${minRole} role or higher`,
        ),
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    context: {
      userId: session.user.id as UserId,
      userEmail: session.user.email,
      orgId,
      orgRole: membership.role,
      orgName: membership.orgName,
      orgSlug: membership.orgSlug,
    },
  };
}
