/**
 * Billing portal route
 *
 * POST /api/billing/portal — creates a Stripe Customer Portal session via the
 * Better Auth Stripe plugin. Only org owners can manage billing.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createAuth } from '@corates/workers/auth-config';
import type { Database } from '@corates/db/client';
import { requireOrgOwner } from '@corates/workers/policies';
import { createDomainError, isDomainError, SYSTEM_ERRORS, type DomainError } from '@corates/shared';
import { resolveOrgIdWithRole } from '@/server/billing-context';
import { BILLING_PORTAL_RATE_LIMIT, checkRateLimit } from '@/server/rateLimit';
import { authMiddleware, type Session } from '@/server/middleware/auth';

interface PortalApi {
  createBillingPortal: (req: {
    headers: Headers;
    body: Record<string, unknown>;
  }) => Promise<{ url: string }>;
}

export const handlePost = async ({
  request,
  context: { db, session },
}: {
  request: Request;
  context: { db: Database; session: Session };
}) => {
  const limit = checkRateLimit(request, env, BILLING_PORTAL_RATE_LIMIT);
  if (limit.blocked) return limit.blocked;

  try {
    const { orgId, role } = await resolveOrgIdWithRole({
      db,
      session: session.session,
      userId: session.user.id,
    });

    requireOrgOwner({ orgId, role });

    const auth = createAuth(env);
    const billingApi = auth.api as unknown as PortalApi;
    const result = await billingApi.createBillingPortal({
      headers: request.headers,
      body: {
        referenceId: orgId as string,
        returnUrl: `${env.APP_URL || 'https://corates.org'}/settings/billing`,
      },
    });

    return Response.json(result, { status: 200, headers: limit.headers });
  } catch (err) {
    console.error('Error creating portal session:', err);
    if (isDomainError(err)) {
      const domain = err as DomainError;
      return Response.json(domain, {
        status: domain.statusCode ?? 403,
        headers: limit.headers,
      });
    }
    const error = err as Error;
    const systemError = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
      operation: 'create_portal_session',
      originalError: error.message,
    });
    return Response.json(systemError, { status: 500, headers: limit.headers });
  }
};

export const Route = createFileRoute('/api/billing/portal')({
  server: { middleware: [authMiddleware], handlers: { POST: handlePost } },
});
