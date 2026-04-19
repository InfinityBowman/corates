/**
 * Admin org billing details
 *
 * GET /api/admin/orgs/:orgId/billing — full billing snapshot for one org:
 * effective plan/source/accessMode (resolved via `resolveOrgAccess`), all
 * subscription rows, and all access grants (revoked or not).
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { organization, subscription } from '@corates/db/schema';
import { desc, eq } from 'drizzle-orm';
import {
  createDomainError,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
  getPlan,
  getGrantPlan,
  type GrantType,
} from '@corates/shared';
import type { OrgId } from '@corates/shared/ids';
import { resolveOrgAccess } from '@corates/workers/billing-resolver';
import { getGrantsByOrgId } from '@corates/db/org-access-grants';
import { adminMiddleware } from '@/server/middleware/admin';

type HandlerArgs = { request: Request; params: { orgId: OrgId } };

export const handleGet = async ({ params }: HandlerArgs) => {
  const { orgId } = params;
  const db = createDb(env.DB);

  try {
    const org = await db.select().from(organization).where(eq(organization.id, orgId)).get();
    if (!org) {
      return Response.json(
        createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
          field: 'orgId',
          value: orgId,
        }),
        { status: 400 },
      );
    }

    const orgBilling = await resolveOrgAccess(db, orgId);

    const allSubscriptions = await db
      .select()
      .from(subscription)
      .where(eq(subscription.referenceId, orgId))
      .orderBy(desc(subscription.createdAt))
      .all();

    const allGrants = await getGrantsByOrgId(db, orgId);

    const effectivePlan =
      orgBilling.source === 'grant' ?
        getGrantPlan(orgBilling.effectivePlanId as GrantType)
      : getPlan(orgBilling.effectivePlanId);

    return Response.json(
      {
        orgId,
        orgName: org.name,
        orgSlug: org.slug,
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
        subscriptions: allSubscriptions,
        grants: allGrants,
      },
      { status: 200 },
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching org billing:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'fetch_org_billing',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/admin/orgs/$orgId/billing')({
  server: {
    middleware: [adminMiddleware],
    handlers: { GET: handleGet },
  },
});
