/**
 * Zod validation schemas for API requests
 * Centralized validation for all route handlers
 */

import { z } from 'zod/v4';
import { PROJECT_ROLES } from './constants.js';

/**
 * Common field validators
 */
export const commonFields = {
  uuid: z.string().uuid('Invalid UUID format'),
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
      .transform(val => val?.trim() || null),
  }),
};

/**
 * Member schemas
 */
export const memberSchemas = {
  add: z
    .object({
      userId: z.string().uuid('Invalid user ID format').optional(),
      email: z.email('Invalid email address').optional(),
      role: z.enum(PROJECT_ROLES, {
        error: `Role must be one of: ${PROJECT_ROLES.join(', ')}`,
      }).default('member'),
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
};

/**
 * Email schemas
 */
export const emailSchemas = {
  queue: z.object({
    to: z.email('Invalid recipient email address'),
    subject: z.string().min(1, 'Subject is required').max(255, 'Subject too long').optional(),
    html: z.string().optional(),
    text: z.string().optional(),
  }).refine(data => data.html || data.text, {
    message: 'Either html or text content is required',
  }),
};

/**
 * Validate request body against a schema
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @param {Object} data - Data to validate
 * @returns {{ success: boolean, data?: any, error?: Object }}
 */
export function validateBody(schema, data) {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }

  // Format Zod errors into a readable structure
  const errors = result.error.issues.map(issue => ({
    field: issue.path.join('.') || 'root',
    message: issue.message,
  }));

  return {
    success: false,
    error: {
      message: 'Validation failed',
      errors,
    },
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
        return c.json(
          {
            error: result.error.message,
            code: 2001,
            details: result.error.errors,
          },
          400,
        );
      }

      // Attach validated data to context
      c.set('validatedBody', result.data);
      await next();
    } catch (_error) {
      return c.json(
        {
          error: 'Invalid JSON body',
          code: 2002,
        },
        400,
      );
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
      return c.json(
        {
          error: result.error.message,
          code: 2001,
          details: result.error.errors,
        },
        400,
      );
    }

    c.set('validatedQuery', result.data);
    await next();
  };
}
