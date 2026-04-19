/**
 * Single-project one-time purchase
 *
 * POST /api/billing/single-project/checkout — owner-only. Creates a Stripe
 * one-time payment session via the `createSingleProjectCheckout` command.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { getSession } from '@corates/workers/auth';
import type { Database } from '@corates/db/client';
import { user as userTable } from '@corates/db/schema';
import { eq } from 'drizzle-orm';
import { createSingleProjectCheckout } from '@corates/workers/commands/billing';
import { requireOrgOwner } from '@corates/workers/policies';
import {
  createDomainError,
  isDomainError,
  AUTH_ERRORS,
  SYSTEM_ERRORS,
  type DomainError,
} from '@corates/shared';
import { resolveOrgIdWithRole } from '@/server/billing-context';
import { BILLING_CHECKOUT_RATE_LIMIT, checkRateLimit } from '@/server/rateLimit';
import { dbMiddleware } from '@/server/middleware/db';

export const handlePost = async ({
  request,
  context: { db },
}: {
  request: Request;
  context: { db: Database };
}) => {
  const limit = checkRateLimit(request, env, BILLING_CHECKOUT_RATE_LIMIT);
  if (limit.blocked) return limit.blocked;

  const session = await getSession(request, env);
  if (!session) {
    const error = createDomainError(AUTH_ERRORS.REQUIRED, { reason: 'no_user' });
    return Response.json(error, { status: 401, headers: limit.headers });
  }

  try {
    const { orgId, role } = await resolveOrgIdWithRole({
      db,
      session: session.session,
      userId: session.user.id,
    });

    requireOrgOwner({ orgId, role });

    console.info('single_project_checkout_initiated', {
      orgId,
      userId: session.user.id,
    });

    const userRecord = await db
      .select({ stripeCustomerId: userTable.stripeCustomerId })
      .from(userTable)
      .where(eq(userTable.id, session.user.id))
      .get();

    const result = await createSingleProjectCheckout(
      env,
      {
        id: session.user.id,
        stripeCustomerId: userRecord?.stripeCustomerId || null,
      },
      { orgId: orgId as string },
    );

    return Response.json(result, { status: 200, headers: limit.headers });
  } catch (err) {
    console.error('single_project_checkout_failed:', err);
    if (isDomainError(err)) {
      const domain = err as DomainError;
      return Response.json(domain, {
        status: domain.statusCode ?? 403,
        headers: limit.headers,
      });
    }
    const error = err as Error;
    const systemError = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
      operation: 'create_single_project_checkout',
      originalError: error.message,
    });
    return Response.json(systemError, { status: 500, headers: limit.headers });
  }
};

export const Route = createFileRoute('/api/billing/single-project/checkout')({
  server: { middleware: [dbMiddleware], handlers: { POST: handlePost } },
});
