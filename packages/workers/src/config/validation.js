/**
 * Zod validation schemas for API requests
 * Centralized validation for all route handlers
 */

import { z } from 'zod/v4';
import { PROJECT_ROLES } from './constants.js';
import { createValidationError, createMultiFieldValidationError } from '@corates/shared';

/**
 * Common field validators
 */
export const commonFields = {
  uuid: z.uuid('Invalid UUID format'),
  email: z.email('Invalid email address'),
  nonEmptyString: z.string().min(1, 'Field cannot be empty'),
  optionalString: z.string().optional(),
};

/**
 * Project schemas
 */
export const projectSchemas = {
  create: z.object({
    name: z
      .string()
      .min(1, 'Project name is required')
      .max(255, 'Project name must be 255 characters or less')
      .transform(val => val.trim()),
    description: z
      .string()
      .max(2000, 'Description must be 2000 characters or less')
      .optional()
      .transform(val => val?.trim() || null),
  }),

  update: z.object({
    name: z
      .string()
      .min(1, 'Project name cannot be empty')
      .max(255, 'Project name must be 255 characters or less')
      .optional()
      .transform(val => val?.trim()),
    description: z
      .string()
      .max(2000, 'Description must be 2000 characters or less')
      .optional()
      .transform(val => (val === undefined ? undefined : val?.trim() || null)),
  }),
};

/**
 * Member schemas
 */
export const memberSchemas = {
  add: z
    .object({
      // userId is a better-auth generated ID, not a UUID
      userId: z.string().min(1, 'Invalid user ID').optional(),
      email: z.string().email('Invalid email address').optional(),
      role: z
        .enum(PROJECT_ROLES, {
          error: `Role must be one of: ${PROJECT_ROLES.join(', ')}`,
        })
        .default('member'),
    })
    .refine(data => data.userId || data.email, {
      message: 'Either userId or email is required',
    }),

  updateRole: z.object({
    role: z.enum(PROJECT_ROLES, {
      error: `Role must be one of: ${PROJECT_ROLES.join(', ')}`,
    }),
  }),
};

/**
 * User schemas
 */
export const userSchemas = {
  search: z.object({
    q: z.string().min(2, 'Search query must be at least 2 characters'),
    projectId: z.string().uuid('Invalid project ID').optional(),
    limit: z
      .string()
      .optional()
      .transform(val => {
        const num = parseInt(val || '10', 10);
        return Math.min(Math.max(1, num), 20);
      }),
  }),
  ban: z.object({
    reason: z.string().optional(),
    expiresAt: z
      .union([
        z.string().datetime('expiresAt must be a valid ISO datetime string').transform(val => new Date(val)),
        z.null(),
      ])
      .optional(),
  }),
};

/**
 * Email schemas
 */
export const emailSchemas = {
  queue: z
    .object({
      to: z.email('Invalid recipient email address'),
      subject: z.string().min(1, 'Subject is required').max(255, 'Subject too long').optional(),
      html: z.string().optional(),
      text: z.string().optional(),
    })
    .refine(data => data.html || data.text, {
      message: 'Either html or text content is required',
    }),
};

/**
 * Subscription schemas
 */
export const subscriptionSchemas = {
  grant: z.object({
    tier: z.enum(['free', 'pro', 'unlimited'], {
      error: "Tier must be one of: 'free', 'pro', 'unlimited'",
    }),
    status: z.literal('active', {
      error: "Status must be 'active'",
    }),
    currentPeriodStart: z
      .number()
      .int('Current period start must be an integer timestamp')
      .positive('Current period start must be a positive number')
      .optional(),
    currentPeriodEnd: z
      .number()
      .int('Current period end must be an integer timestamp')
      .positive('Current period end must be a positive number')
      .nullable()
      .optional(),
  }),
};

/**
 * Storage management schemas
 */
export const storageSchemas = {
  listDocuments: z.object({
    page: z
      .string()
      .optional()
      .default('1')
      .transform(val => parseInt(val, 10))
      .pipe(z.number().int('Page must be an integer').min(1, 'Page must be at least 1')),
    limit: z
      .string()
      .optional()
      .default('50')
      .transform(val => parseInt(val, 10))
      .pipe(z.number().int('Limit must be an integer').min(1, 'Limit must be at least 1').max(1000, 'Limit must be at most 1000')),
    prefix: z
      .string()
      .optional()
      .transform(val => (val ? val.trim() : '')),
    search: z
      .string()
      .optional()
      .transform(val => (val ? val.trim().toLowerCase() : '')),
  }),
  deleteDocuments: z.object({
    keys: z
      .array(
        z
          .string()
          .min(1, 'Key cannot be empty')
          .refine(
            key => /^projects\/[^/]+\/studies\/[^/]+\/.+$/.test(key),
            {
              message: 'Key must match pattern: projects/{projectId}/studies/{studyId}/{fileName}',
            },
          ),
      )
      .min(1, 'At least one key is required'),
  }),
};

/**
 * Map Zod error to validation error code
 * @param {object} issue - Zod issue object from error.issues array
 * @param {string} [issue.kind] - Error kind (Zod v4)
 * @param {string} [issue.code] - Error code (Zod v3 fallback)
 * @param {string} [issue.type] - Expected type
 * @param {number} [issue.minimum] - Minimum value
 * @param {string} [issue.validation] - Validation type (email, uuid, etc.)
 * @returns {string} Validation error code
 */
function mapZodErrorToValidationCode(issue) {
  // Zod v4: Use issue.kind instead of issue.code (code is deprecated)
  const kind = issue.kind || issue.code; // Fallback for compatibility

  switch (kind) {
    case 'too_small':
      // Check if it's a required field (minimum === 1 for strings)
      if (issue.type === 'string' && issue.minimum === 1) {
        return 'VALIDATION_FIELD_REQUIRED';
      }
      return 'VALIDATION_FIELD_TOO_SHORT';
    case 'too_big':
      return 'VALIDATION_FIELD_TOO_LONG';
    case 'invalid_string':
      if (issue.validation === 'email' || issue.validation === 'uuid') {
        return 'VALIDATION_FIELD_INVALID_FORMAT';
      }
      return 'VALIDATION_FIELD_INVALID_FORMAT';
    case 'invalid_type':
      return 'VALIDATION_FIELD_INVALID_FORMAT';
    default:
      return 'VALIDATION_FAILED';
  }
}

/**
 * Validate request body against a schema
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @param {Object} data - Data to validate
 * @returns {{ success: boolean, data?: any, error?: DomainError }}
 */
export function validateBody(schema, data) {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  // Map Zod errors to validation errors
  const validationErrors = result.error.issues.map(issue => {
    const field = issue.path.join('.') || 'root';
    const validationCode = mapZodErrorToValidationCode(issue);
    // Get the value from the data object using the path
    const value = issue.path.reduce(
      (obj, key) => (obj && typeof obj === 'object' ? obj[key] : undefined),
      data,
    );
    const zodKind = issue.kind || issue.code; // Use kind (v4) with fallback to code
    return {
      field,
      code: validationCode,
      message: issue.message,
      value,
      zodCode: zodKind,
    };
  });

  // If single field error, return single validation error
  if (validationErrors.length === 1) {
    const error = validationErrors[0];
    return {
      success: false,
      error: createValidationError(error.field, error.code, error.value, error.zodCode),
    };
  }

  // Multiple field errors - return multi-field validation error
  return {
    success: false,
    error: createMultiFieldValidationError(validationErrors),
  };
}

/**
 * Validate query parameters against a schema
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @param {Object} query - Query parameters to validate
 * @returns {{ success: boolean, data?: any, error?: Object }}
 */
export function validateQuery(schema, query) {
  return validateBody(schema, query);
}

/**
 * Hono middleware for request body validation
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @returns {Function} Hono middleware
 */
export function validateRequest(schema) {
  return async (c, next) => {
    try {
      const body = await c.req.json();
      const result = validateBody(schema, body);

      if (!result.success) {
        // result.error is already a DomainError from createValidationError/createMultiFieldValidationError
        return c.json(result.error, result.error.statusCode);
      }

      // Attach validated data to context
      c.set('validatedBody', result.data);
      await next();
    } catch (error) {
      console.warn('Body validation error:', error.message);
      // Invalid JSON - create validation error
      const invalidJsonError = createValidationError(
        'body',
        'VALIDATION_INVALID_INPUT',
        null,
        'invalid_json',
      );
      return c.json(invalidJsonError, invalidJsonError.statusCode);
    }
  };
}

/**
 * Hono middleware for query parameter validation
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @returns {Function} Hono middleware
 */
export function validateQueryParams(schema) {
  return async (c, next) => {
    const query = c.req.query();
    const result = validateQuery(schema, query);

    if (!result.success) {
      // result.error is already a DomainError from validateBody
      return c.json(result.error, result.error.statusCode);
    }

    c.set('validatedQuery', result.data);
    await next();
  };
}
