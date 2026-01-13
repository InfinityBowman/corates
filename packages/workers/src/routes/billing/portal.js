/**
 * Billing portal routes
 * Handles Stripe Customer Portal session creation (delegates to Better Auth)
 */
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { requireAuth, getAuth } from '@/middleware/auth.js';
import { createDb } from '@/db/client.js';
import {
  createDomainError,
  createValidationError,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
} from '@corates/shared';
import { billingPortalRateLimit } from '@/middleware/rateLimit.js';
import { resolveOrgIdWithRole } from './helpers/orgContext.js';
import { requireOrgOwner } from './helpers/ownerGate.js';

const billingPortalRoutes = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const field = firstIssue?.path?.[0] || 'input';
      const fieldName = String(field).charAt(0).toUpperCase() + String(field).slice(1);

      let message = firstIssue?.message || 'Validation failed';
      const isMissing =
        firstIssue?.received === 'undefined' ||
        message.includes('received undefined') ||
        message.includes('Required');

      if (isMissing) {
        message = `${fieldName} is required`;
      }

      const error = createValidationError(
        String(field),
        VALIDATION_ERRORS.FIELD_REQUIRED.code,
        null,
      );
      error.message = message;
      return c.json(error, 400);
    }
  },
});

// Response schemas
const PortalResponseSchema = z
  .object({
    url: z.string(),
  })
  .openapi('PortalResponse');

const PortalErrorSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    statusCode: z.number(),
    details: z.record(z.unknown()).optional(),
  })
  .openapi('PortalError');

// Route definitions
const createPortalRoute = createRoute({
  method: 'post',
  path: '/portal',
  tags: ['Billing'],
  summary: 'Create billing portal session',
  description: 'Create a Stripe Customer Portal session (delegates to Better Auth Stripe plugin)',
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      content: { 'application/json': { schema: PortalResponseSchema } },
      description: 'Portal session created',
    },
    403: {
      content: { 'application/json': { schema: PortalErrorSchema } },
      description: 'Not org owner',
    },
    429: {
      content: { 'application/json': { schema: PortalErrorSchema } },
      description: 'Rate limit exceeded',
    },
    500: {
      content: { 'application/json': { schema: PortalErrorSchema } },
      description: 'Internal error',
    },
  },
});

// Route handlers
billingPortalRoutes.use('*', billingPortalRateLimit);
billingPortalRoutes.use('*', requireAuth);

billingPortalRoutes.openapi(createPortalRoute, async c => {
  const { user, session } = getAuth(c);
  const db = createDb(c.env.DB);

  try {
    const { orgId, role } = await resolveOrgIdWithRole({ db, session, userId: user.id });

    // Verify user is org owner
    requireOrgOwner({ orgId, role });

    // Delegate to Better Auth Stripe plugin
    const { createAuth } = await import('@/auth/config.js');
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
