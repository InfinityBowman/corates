/**
 * Billing portal routes
 * Handles Stripe Customer Portal session creation (delegates to Better Auth)
 */
import { Hono } from 'hono';
import { requireAuth, getAuth } from '../../middleware/auth.js';
import { createDb } from '../../db/client.js';
import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';
import { billingPortalRateLimit } from '../../middleware/rateLimit.js';
import { resolveOrgIdWithRole } from './helpers/orgContext.js';
import { requireOrgOwner } from './helpers/ownerGate.js';

const billingPortalRoutes = new Hono();

/**
 * POST /portal
 * Create a Stripe Customer Portal session (delegates to Better Auth Stripe plugin)
 */
billingPortalRoutes.post('/portal', billingPortalRateLimit, requireAuth, async c => {
  const { user, session } = getAuth(c);
  const db = createDb(c.env.DB);

  try {
    const { orgId, role } = await resolveOrgIdWithRole({ db, session, userId: user.id });

    // Verify user is org owner
    requireOrgOwner({ orgId, role });

    // Delegate to Better Auth Stripe plugin
    const { createAuth } = await import('../../auth/config.js');
    const auth = createAuth(c.env, c.executionCtx);
    const result = await auth.api.createBillingPortal({
      headers: c.req.raw.headers,
      body: {
        referenceId: orgId,
        returnUrl: `${c.env.APP_URL || 'https://corates.org'}/settings/billing`,
      },
    });

    return c.json(result);
  } catch (error) {
    console.error('Error creating portal session:', error);

    // If error is already a domain error, return it as-is
    if (error.code && error.statusCode) {
      return c.json(error, error.statusCode);
    }

    const systemError = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
      operation: 'create_portal_session',
      originalError: error.message,
    });
    return c.json(systemError, systemError.statusCode);
  }
});

export { billingPortalRoutes };
