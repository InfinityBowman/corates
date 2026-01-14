/**
 * Billing grants routes
 * Handles trial and access grant management
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
import { GRANT_CONFIG } from '@/config/constants.js';
import { resolveOrgIdWithRole } from './helpers/orgContext.js';
import { requireOrgOwner } from '@/policies';

const billingGrantRoutes = new OpenAPIHono({
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
const TrialStartSuccessSchema = z
  .object({
    success: z.literal(true),
    grantId: z.string(),
    expiresAt: z.number(),
  })
  .openapi('TrialStartSuccess');

const GrantErrorSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    statusCode: z.number(),
    details: z.record(z.unknown()).optional(),
  })
  .openapi('GrantError');

// Route definitions
const startTrialRoute = createRoute({
  method: 'post',
  path: '/trial/start',
  tags: ['Billing'],
  summary: 'Start trial grant',
  description:
    'Start a trial grant for the current org (owner-only). Each organization can only have one trial grant.',
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      content: { 'application/json': { schema: TrialStartSuccessSchema } },
      description: 'Trial started successfully',
    },
    400: {
      content: { 'application/json': { schema: GrantErrorSchema } },
      description: 'Trial already exists',
    },
    403: {
      content: { 'application/json': { schema: GrantErrorSchema } },
      description: 'Not org owner',
    },
    500: {
      content: { 'application/json': { schema: GrantErrorSchema } },
      description: 'Internal error',
    },
  },
});

// Route handlers
billingGrantRoutes.use('*', requireAuth);

billingGrantRoutes.openapi(startTrialRoute, async c => {
  const { user, session } = getAuth(c);
  const db = createDb(c.env.DB);

  try {
    const { orgId, role } = await resolveOrgIdWithRole({ db, session, userId: user.id });

    // Verify user is org owner
    requireOrgOwner({ orgId, role });

    const { getGrantByOrgIdAndType, createGrant } = await import('@/db/orgAccessGrants.js');

    // Check if trial grant already exists (uniqueness requirement)
    const existingTrial = await getGrantByOrgIdAndType(db, orgId, 'trial');
    if (existingTrial) {
      const error = createDomainError(
        VALIDATION_ERRORS.INVALID_INPUT,
        {
          field: 'trial',
          value: 'already_exists',
        },
        'Trial grant already exists for this organization. Each organization can only have one trial grant.',
      );
      return c.json(error, error.statusCode);
    }

    // Create trial grant (configured trial days from now)
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + GRANT_CONFIG.TRIAL_DAYS);

    const grantId = crypto.randomUUID();
    await createGrant(db, {
      id: grantId,
      orgId,
      type: 'trial',
      startsAt: now,
      expiresAt,
    });

    return c.json({
      success: true,
      grantId,
      expiresAt: Math.floor(expiresAt.getTime() / 1000),
    });
  } catch (error) {
    console.error('Error starting trial:', error);

    // If error is already a domain error, return it as-is
    if (error.code && error.statusCode) {
      return c.json(error, error.statusCode);
    }

    const systemError = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
      operation: 'start_trial',
      originalError: error.message,
    });
    return c.json(systemError, systemError.statusCode);
  }
});

export { billingGrantRoutes };
