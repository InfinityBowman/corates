/**
 * Admin: convenience trial grant
 *
 * POST /api/admin/orgs/:orgId/grant-trial — creates a 14-day trial grant.
 * Returns 400 if a trial already exists for this org.
 */
import { createFileRoute } from '@tanstack/react-router';
import type { Database } from '@corates/db/client';
import { organization } from '@corates/db/schema';
import { eq } from 'drizzle-orm';
import { createDomainError, SYSTEM_ERRORS, VALIDATION_ERRORS } from '@corates/shared';
import type { OrgId, OrgAccessGrantId } from '@corates/shared/ids';
import { createGrant, getGrantByOrgIdAndType } from '@corates/db/org-access-grants';
import { adminMiddleware } from '@/server/middleware/admin';

type HandlerArgs = { request: Request; params: { orgId: OrgId }; context: { db: Database } };

export const handlePost = async ({ params, context: { db } }: HandlerArgs) => {
  const { orgId } = params;

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

    const existingTrial = await getGrantByOrgIdAndType(db, orgId, 'trial');
    if (existingTrial) {
      return Response.json(
        createDomainError(
          VALIDATION_ERRORS.INVALID_INPUT,
          { field: 'trial', value: 'already_exists' },
          'Trial grant already exists for this organization.',
        ),
        { status: 400 },
      );
    }

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 14);

    const grantId = crypto.randomUUID() as OrgAccessGrantId;
    const created = await createGrant(db, {
      id: grantId,
      orgId,
      type: 'trial',
      startsAt: now,
      expiresAt,
      metadata: { createdBy: 'admin' },
    });

    return Response.json({ success: true, grant: created }, { status: 201 });
  } catch (err) {
    const error = err as Error;
    console.error('Error creating trial grant:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'create_trial_grant',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/admin/orgs/$orgId/grant-trial')({
  server: {
    middleware: [adminMiddleware],
    handlers: { POST: handlePost },
  },
});
