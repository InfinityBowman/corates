/**
 * Admin org details
 *
 * GET /api/admin/orgs/:orgId — org metadata, member/project counts, and full
 * billing summary (effective plan, source, subscription/grant). Admin only.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { organization, member, projects } from '@corates/db/schema';
import { count, eq } from 'drizzle-orm';
import {
  createDomainError,
  AUTH_ERRORS,
  SYSTEM_ERRORS,
  getPlan,
  getGrantPlan,
  type GrantType,
} from '@corates/shared';
import type { OrgId } from '@corates/shared/ids';
import { resolveOrgAccess } from '@corates/workers/billing-resolver';
import { requireAdmin } from '@/server/guards/requireAdmin';

type HandlerArgs = { request: Request; params: { orgId: OrgId } };

export const handleGet = async ({ request, params }: HandlerArgs) => {
  const guard = await requireAdmin(request, env);
  if (!guard.ok) return guard.response;

  const { orgId } = params;
  const db = createDb(env.DB);

  try {
    const org = await db.select().from(organization).where(eq(organization.id, orgId)).get();
    if (!org) {
      return Response.json(
        createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'org_not_found', orgId }),
        { status: 403 },
      );
    }

    const [memberCountResult] = await db
      .select({ count: count() })
      .from(member)
      .where(eq(member.organizationId, orgId))
      .all();
    const memberCount = memberCountResult?.count || 0;

    const [projectCountResult] = await db
      .select({ count: count() })
      .from(projects)
      .where(eq(projects.orgId, orgId))
      .all();
    const projectCount = projectCountResult?.count || 0;

    const orgBilling = await resolveOrgAccess(db, orgId);
    const effectivePlan =
      orgBilling.source === 'grant' ?
        getGrantPlan(orgBilling.effectivePlanId as GrantType)
      : getPlan(orgBilling.effectivePlanId);

    return Response.json(
      {
        org,
        stats: { memberCount, projectCount },
        billing: {
          effectivePlanId: orgBilling.effectivePlanId,
          source: orgBilling.source,
          accessMode: orgBilling.accessMode,
          plan: {
            name: effectivePlan.name,
            entitlements: effectivePlan.entitlements,
            quotas: effectivePlan.quotas,
          },
          subscription: orgBilling.subscription,
          grant: orgBilling.grant,
        },
      },
      { status: 200 },
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching org details:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'fetch_org_details',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/admin/orgs/$orgId')({
  server: { handlers: { GET: handleGet } },
});
