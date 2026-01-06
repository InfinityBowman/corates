/**
 * Billing grants routes
 * Handles trial and access grant management
 */
import { Hono } from 'hono';
import { requireAuth, getAuth } from '../../middleware/auth.js';
import { createDb } from '../../db/client.js';
import { createDomainError, SYSTEM_ERRORS, VALIDATION_ERRORS } from '@corates/shared';
import { resolveOrgIdWithRole } from './helpers/orgContext.js';
import { requireOrgOwner } from './helpers/ownerGate.js';

const billingGrantRoutes = new Hono();

/**
 * POST /trial/start
 * Start a trial grant for the current org (owner-only)
 * Uniqueness: Only one trial grant per org (active, expired, or revoked)
 */
billingGrantRoutes.post('/trial/start', requireAuth, async c => {
  const { user, session } = getAuth(c);
  const db = createDb(c.env.DB);

  try {
    const { orgId, role } = await resolveOrgIdWithRole({ db, session, userId: user.id });

    // Verify user is org owner
    requireOrgOwner({ orgId, role });

    const { getGrantByOrgIdAndType, createGrant } = await import('../../db/orgAccessGrants.js');

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

    // Create trial grant (14 days from now)
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 14);

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
