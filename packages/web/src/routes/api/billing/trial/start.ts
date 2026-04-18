/**
 * Trial grant route
 *
 * POST /api/billing/trial/start — owner-only. Creates a one-shot trial grant for
 * the active org. Each org gets at most one trial.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { getSession } from '@corates/workers/auth';
import { createDb } from '@corates/db/client';
import { createGrant, getGrantByOrgIdAndType } from '@corates/db/org-access-grants';
import { requireOrgOwner } from '@corates/workers/policies';
import { GRANT_CONFIG } from '@corates/workers/constants';
import {
  createDomainError,
  isDomainError,
  AUTH_ERRORS,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
  type DomainError,
} from '@corates/shared';
import { resolveOrgIdWithRole } from '@/server/billing-context';

export const handlePost = async ({ request }: { request: Request }) => {
  const session = await getSession(request, env);
  if (!session) {
    const error = createDomainError(AUTH_ERRORS.REQUIRED, { reason: 'no_user' });
    return Response.json(error, { status: 401 });
  }

  const db = createDb(env.DB);

  try {
    const { orgId, role } = await resolveOrgIdWithRole({
      db,
      session: session.session,
      userId: session.user.id,
    });

    requireOrgOwner({ orgId, role });

    const existingTrial = await getGrantByOrgIdAndType(db, orgId as string, 'trial');
    if (existingTrial) {
      const error = createDomainError(
        VALIDATION_ERRORS.INVALID_INPUT,
        { field: 'trial', value: 'already_exists' },
        'Trial grant already exists for this organization. Each organization can only have one trial grant.',
      );
      return Response.json(error, { status: 400 });
    }

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + GRANT_CONFIG.TRIAL_DAYS);

    const grantId = crypto.randomUUID();
    await createGrant(db, {
      id: grantId,
      orgId: orgId as string,
      type: 'trial',
      startsAt: now,
      expiresAt,
    });

    return Response.json(
      {
        success: true as const,
        grantId,
        expiresAt: Math.floor(expiresAt.getTime() / 1000),
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('Error starting trial:', err);
    if (isDomainError(err)) {
      const domain = err as DomainError;
      return Response.json(domain, { status: domain.statusCode ?? 403 });
    }
    const error = err as Error;
    const systemError = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
      operation: 'start_trial',
      originalError: error.message,
    });
    return Response.json(systemError, { status: 500 });
  }
};

export const Route = createFileRoute('/api/billing/trial/start')({
  server: { handlers: { POST: handlePost } },
});
