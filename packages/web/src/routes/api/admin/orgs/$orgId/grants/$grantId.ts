/**
 * Admin: update + revoke a single grant
 *
 * PUT /api/admin/orgs/:orgId/grants/:grantId — accepts `expiresAt` (extend)
 * or `revokedAt` (revoke; pass `null` to unrevoke). At least one of the two
 * fields must be present, or 400.
 * DELETE — revokes the grant via `revokeGrant`.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { orgAccessGrants } from '@corates/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { createDomainError, SYSTEM_ERRORS, VALIDATION_ERRORS } from '@corates/shared';
import {
  getGrantById,
  revokeGrant,
  updateGrantExpiresAt,
} from '@corates/db/org-access-grants';
import { requireAdmin } from '@/server/guards/requireAdmin';

const UpdateGrantBodySchema = z.object({
  expiresAt: z.coerce.date().optional(),
  revokedAt: z.coerce.date().optional().nullable(),
});

type HandlerArgs = { request: Request; params: { orgId: string; grantId: string } };

export const handlePut = async ({ request, params }: HandlerArgs) => {
  const guard = await requireAdmin(request, env);
  if (!guard.ok) return guard.response;

  const { orgId, grantId } = params;
  const db = createDb(env.DB);

  let body: z.infer<typeof UpdateGrantBodySchema>;
  try {
    const raw = await request.json();
    body = UpdateGrantBodySchema.parse(raw);
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
    const existing = await getGrantById(db, grantId);
    if (!existing || existing.orgId !== orgId) {
      return Response.json(
        createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
          field: 'grantId',
          value: grantId,
        }),
        { status: 400 },
      );
    }

    if (body.expiresAt !== undefined) {
      const updated = await updateGrantExpiresAt(db, grantId, body.expiresAt);
      return Response.json({ success: true, grant: updated }, { status: 200 });
    }

    if (body.revokedAt !== undefined) {
      if (body.revokedAt === null) {
        const result = await db
          .update(orgAccessGrants)
          .set({ revokedAt: null })
          .where(eq(orgAccessGrants.id, grantId))
          .returning()
          .get();
        return Response.json({ success: true, grant: result }, { status: 200 });
      }
      const revoked = await revokeGrant(db, grantId);
      return Response.json({ success: true, grant: revoked }, { status: 200 });
    }

    return Response.json(
      createDomainError(VALIDATION_ERRORS.INVALID_INPUT, {
        field: 'body',
        value: 'At least one field (expiresAt or revokedAt) must be provided',
      }),
      { status: 400 },
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error updating grant:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'update_grant',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const handleDelete = async ({ request, params }: HandlerArgs) => {
  const guard = await requireAdmin(request, env);
  if (!guard.ok) return guard.response;

  const { orgId, grantId } = params;
  const db = createDb(env.DB);

  try {
    const existing = await getGrantById(db, grantId);
    if (!existing || existing.orgId !== orgId) {
      return Response.json(
        createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
          field: 'grantId',
          value: grantId,
        }),
        { status: 400 },
      );
    }

    await revokeGrant(db, grantId);

    return Response.json({ success: true, message: 'Grant revoked' }, { status: 200 });
  } catch (err) {
    const error = err as Error;
    console.error('Error revoking grant:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'revoke_grant',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/admin/orgs/$orgId/grants/$grantId')({
  server: { handlers: { PUT: handlePut, DELETE: handleDelete } },
});
