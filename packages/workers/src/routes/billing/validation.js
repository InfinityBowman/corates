/**
 * Billing plan validation routes
 * Handles plan change validation logic
 */
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { requireAuth, getAuth } from '@/middleware/auth.js';
import { createDb } from '@/db/client.js';
import { validatePlanChange } from '@/lib/billingResolver.js';
import { createDomainError, SYSTEM_ERRORS, AUTH_ERRORS } from '@corates/shared';
import { resolveOrgId } from './helpers/orgContext.js';
import { validationHook } from '@/lib/honoValidationHook.js';

const billingValidationRoutes = new OpenAPIHono({
  defaultHook: validationHook,
});

// Response schemas
const ViolationSchema = z.object({
  field: z.string(),
  message: z.string(),
  current: z.number(),
  limit: z.number(),
});

const UsageSchema = z.object({
  projects: z.number(),
  collaborators: z.number(),
});

const TargetPlanSchema = z.object({
  name: z.string(),
  limits: z.object({
    projects: z.number(),
    collaborators: z.number(),
  }),
});

const PlanValidationResponseSchema = z
  .object({
    valid: z.boolean(),
    violations: z.array(ViolationSchema).optional(),
    usage: UsageSchema.optional(),
    targetPlan: TargetPlanSchema.optional(),
  })
  .openapi('PlanValidationResponse');

const ValidationErrorSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    statusCode: z.number(),
    details: z.record(z.unknown()).optional(),
  })
  .openapi('ValidationError');

// Route definitions
const validatePlanChangeRoute = createRoute({
  method: 'get',
  path: '/validate-plan-change',
  tags: ['Billing'],
  summary: 'Validate plan change',
  description:
    "Validate if the org can change to a target plan. Checks if current usage would exceed the target plan's quotas. Used before allowing plan downgrades.",
  security: [{ cookieAuth: [] }],
  request: {
    query: z.object({
      targetPlan: z.string().min(1).openapi({ example: 'free' }),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: PlanValidationResponseSchema } },
      description: 'Validation result',
    },
    400: {
      content: { 'application/json': { schema: ValidationErrorSchema } },
      description: 'Missing targetPlan parameter',
    },
    403: {
      content: { 'application/json': { schema: ValidationErrorSchema } },
      description: 'No org found',
    },
    500: {
      content: { 'application/json': { schema: ValidationErrorSchema } },
      description: 'Database error',
    },
  },
});

// Route handlers
billingValidationRoutes.use('*', requireAuth);

billingValidationRoutes.openapi(validatePlanChangeRoute, async c => {
  const { user, session } = getAuth(c);
  const db = createDb(c.env.DB);

  try {
    const { targetPlan } = c.req.valid('query');

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
