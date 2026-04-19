/**
 * Plan change validation route
 *
 * GET /api/billing/validate-plan-change?targetPlan=<planId>
 * Used before plan downgrades — returns whether current usage fits the target plan.
 */
import { createFileRoute } from '@tanstack/react-router';
import type { Database } from '@corates/db/client';
import { validatePlanChange } from '@corates/workers/billing-resolver';
import {
  createDomainError,
  createValidationError,
  AUTH_ERRORS,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
} from '@corates/shared';
import { resolveOrgId } from '@/server/billing-context';
import { authMiddleware, type Session } from '@/server/middleware/auth';

export const handleGet = async ({
  request,
  context: { db, session },
}: {
  request: Request;
  context: { db: Database; session: Session };
}) => {
  const url = new URL(request.url);
  const targetPlan = url.searchParams.get('targetPlan');

  if (!targetPlan) {
    return Response.json(
      createValidationError('targetPlan', VALIDATION_ERRORS.FIELD_REQUIRED.code, null, 'required'),
      { status: 400 },
    );
  }

  try {
    const orgId = await resolveOrgId({
      db,
      session: session.session,
      userId: session.user.id,
    });

    if (!orgId) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'no_org_found' });
      return Response.json(error, { status: 403 });
    }

    const result = await validatePlanChange(db, orgId, targetPlan);
    return Response.json(result, { status: 200 });
  } catch (err) {
    const error = err as Error;
    console.error('Error validating plan change:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'validate_plan_change',
      originalError: error.message,
    });
    return Response.json(dbError, { status: 500 });
  }
};

export const Route = createFileRoute('/api/billing/validate-plan-change')({
  server: { middleware: [authMiddleware], handlers: { GET: handleGet } },
});
