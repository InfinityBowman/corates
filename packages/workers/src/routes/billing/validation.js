/**
 * Billing plan validation routes
 * Handles plan change validation logic
 */
import { Hono } from 'hono';
import { requireAuth, getAuth } from '../../middleware/auth.js';
import { createDb } from '../../db/client.js';
import { validatePlanChange } from '../../lib/billingResolver.js';
import { createDomainError, SYSTEM_ERRORS, AUTH_ERRORS, VALIDATION_ERRORS } from '@corates/shared';
import { resolveOrgId } from './helpers/orgContext.js';

const billingValidationRoutes = new Hono();

/**
 * GET /validate-plan-change
 * Validate if the org can change to a target plan
 * Checks if current usage would exceed the target plan's quotas
 * Used before allowing plan downgrades
 */
billingValidationRoutes.get('/validate-plan-change', requireAuth, async c => {
  const { user, session } = getAuth(c);
  const db = createDb(c.env.DB);

  try {
    const targetPlan = c.req.query('targetPlan');

    if (!targetPlan) {
      const error = createDomainError(VALIDATION_ERRORS.INVALID_INPUT, {
        field: 'targetPlan',
        value: targetPlan,
      });
      return c.json(error, error.statusCode);
    }

    const orgId = await resolveOrgId({ db, session, userId: user.id });

    if (!orgId) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'no_org_found',
      });
      return c.json(error, error.statusCode);
    }

    const validationResult = await validatePlanChange(db, orgId, targetPlan);

    return c.json(validationResult);
  } catch (error) {
    console.error('Error validating plan change:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'validate_plan_change',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

export { billingValidationRoutes };
