/**
 * Admin: convenience single_project grant
 *
 * POST /api/admin/orgs/:orgId/grant-single-project — creates a 6-month
 * single_project grant. If a non-revoked grant exists, extends it 6 months
 * from `max(now, existing.expiresAt)` and returns 200; otherwise creates
 * fresh and returns 201.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { organization } from '@corates/db/schema';
import { eq } from 'drizzle-orm';
import { createDomainError, SYSTEM_ERRORS, VALIDATION_ERRORS } from '@corates/shared';
import type { OrgId, OrgAccessGrantId } from '@corates/shared/ids';
import {
  createGrant,
  getGrantByOrgIdAndType,
  updateGrantExpiresAt,
} from '@corates/db/org-access-grants';
import { requireAdmin } from '@/server/guards/requireAdmin';

type HandlerArgs = { request: Request; params: { orgId: OrgId } };

export const handlePost = async ({ request, params }: HandlerArgs) => {
  const guard = await requireAdmin(request, env);
  if (!guard.ok) return guard.response;

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

    const existing = await getGrantByOrgIdAndType(db, orgId, 'single_project');
    const now = new Date();

    if (existing && !existing.revokedAt) {
      const existingExpiresAtTimestamp =
        existing.expiresAt instanceof Date ?
          Math.floor(existing.expiresAt.getTime() / 1000)
        : (existing.expiresAt as number);
      const nowTimestamp = Math.floor(now.getTime() / 1000);
      const baseExpiresAt = Math.max(nowTimestamp, existingExpiresAtTimestamp);
      const newExpiresAt = new Date(baseExpiresAt * 1000);
      newExpiresAt.setMonth(newExpiresAt.getMonth() + 6);

      const updated = await updateGrantExpiresAt(db, existing.id, newExpiresAt);
      return Response.json(
        { success: true, grant: updated, action: 'extended' as const },
        { status: 200 },
      );
    }

    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + 6);

    const grantId = crypto.randomUUID() as OrgAccessGrantId;
    const created = await createGrant(db, {
      id: grantId,
      orgId,
      type: 'single_project',
      startsAt: now,
      expiresAt,
      metadata: { createdBy: 'admin' },
    });

    return Response.json(
      { success: true, grant: created, action: 'created' as const },
      { status: 201 },
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error creating single_project grant:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'create_single_project_grant',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/admin/orgs/$orgId/grant-single-project')({
  server: { handlers: { POST: handlePost } },
});
