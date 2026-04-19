/**
 * Admin: create org access grant
 *
 * POST /api/admin/orgs/:orgId/grants — manually create a `trial` or
 * `single_project` grant. Trial grants are unique per org; the second one
 * returns 400.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { organization } from '@corates/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { createDomainError, SYSTEM_ERRORS, VALIDATION_ERRORS } from '@corates/shared';
import type { OrgId, OrgAccessGrantId } from '@corates/shared/ids';
import { createGrant, getGrantByOrgIdAndType } from '@corates/db/org-access-grants';
import { adminMiddleware } from '@/server/middleware/admin';

const CreateGrantBodySchema = z.object({
  type: z.enum(['trial', 'single_project']),
  startsAt: z.coerce.date(),
  expiresAt: z.coerce.date(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

type HandlerArgs = { request: Request; params: { orgId: OrgId } };

export const handlePost = async ({ request, params }: HandlerArgs) => {
  const { orgId } = params;
  const db = createDb(env.DB);

  let body: z.infer<typeof CreateGrantBodySchema>;
  try {
    const raw = await request.json();
    body = CreateGrantBodySchema.parse(raw);
  } catch (err) {
    return Response.json(
      createDomainError(VALIDATION_ERRORS.INVALID_INPUT, {
        field: 'body',
        value: (err as Error).message,
      }),
      { status: 400 },
    );
  }

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

    if (body.type === 'trial') {
      const existingTrial = await getGrantByOrgIdAndType(db, orgId, 'trial');
      if (existingTrial) {
        return Response.json(
          createDomainError(
            VALIDATION_ERRORS.INVALID_INPUT,
            { field: 'type', value: 'trial' },
            'Trial grant already exists for this organization. Each organization can only have one trial grant.',
          ),
          { status: 400 },
        );
      }
    }

    if (body.expiresAt <= body.startsAt) {
      return Response.json(
        createDomainError(VALIDATION_ERRORS.INVALID_INPUT, {
          field: 'expiresAt',
          value: 'expiresAt must be after startsAt',
        }),
        { status: 400 },
      );
    }

    const grantId = crypto.randomUUID() as OrgAccessGrantId;
    const created = await createGrant(db, {
      id: grantId,
      orgId,
      type: body.type,
      startsAt: body.startsAt,
      expiresAt: body.expiresAt,
      metadata: body.metadata || null,
    });

    return Response.json({ success: true, grant: created }, { status: 201 });
  } catch (err) {
    const error = err as Error;
    console.error('Error creating grant:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'create_grant',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/admin/orgs/$orgId/grants')({
  server: {
    middleware: [adminMiddleware],
    handlers: { POST: handlePost },
  },
});
