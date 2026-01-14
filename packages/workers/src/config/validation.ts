import { z } from 'zod';
import type { Context, MiddlewareHandler } from 'hono';
import { PROJECT_ROLES } from './constants';
import { createValidationError, createMultiFieldValidationError } from '@corates/shared';
import type { DomainError } from '@corates/shared';

export const commonFields = {
  uuid: z.uuid('Invalid UUID format'),
  email: z.email('Invalid email address'),
  nonEmptyString: z.string().min(1, 'Field cannot be empty'),
  optionalString: z.string().optional(),
};

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

export const memberSchemas = {
  add: z
    .object({
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

export const invitationSchemas = {
  create: z.object({
    email: z.string().email('Invalid email address'),
    role: z.enum(PROJECT_ROLES, {
      error: `Role must be one of: ${PROJECT_ROLES.join(', ')}`,
    }),
    grantOrgMembership: z.boolean().optional().default(false),
  }),
  accept: z.object({
    token: z.string().min(1, 'Token is required'),
  }),
};

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
        z
          .string()
          .datetime('expiresAt must be a valid ISO datetime string')
          .transform(val => new Date(val)),
        z.null(),
      ])
      .optional(),
  }),
  unban: z.object({}),
  impersonate: z.object({
    userId: z.string().min(1, 'userId is required'),
  }),
};

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

export const storageSchemas = {
  listDocuments: z.object({
    cursor: z
      .string()
      .optional()
      .transform(val => (val ? val.trim() : undefined)),
    limit: z
      .string()
      .optional()
      .default('50')
      .transform(val => parseInt(val, 10))
      .pipe(
        z
          .number()
          .int('Limit must be an integer')
          .min(1, 'Limit must be at least 1')
          .max(1000, 'Limit must be at most 1000'),
      ),
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
          .refine(key => /^projects\/[^/]+\/studies\/[^/]+\/.+$/.test(key), {
            message: 'Key must match pattern: projects/{projectId}/studies/{studyId}/{fileName}',
          }),
      )
      .min(1, 'At least one key is required'),
  }),
};

export const stripeSchemas = {
  portalLink: z.object({
    customerId: z.string().min(1, 'customerId is required'),
    returnUrl: z.string().url('returnUrl must be a valid URL').optional(),
  }),
};

export const billingSchemas = {
  validateCoupon: z.object({
    code: z
      .string()
      .min(1, 'Please enter a promo code')
      .transform(val => val.trim().toUpperCase()),
  }),
};

type ValidationCode =
  | 'VALIDATION_FIELD_REQUIRED'
  | 'VALIDATION_FIELD_TOO_SHORT'
  | 'VALIDATION_FIELD_TOO_LONG'
  | 'VALIDATION_FIELD_INVALID_FORMAT'
  | 'VALIDATION_FAILED';

function mapZodErrorToValidationCode(issue: z.core.$ZodIssue): ValidationCode {
  const kind = (issue as { kind?: string }).kind || (issue as { code?: string }).code;

  switch (kind) {
    case 'too_small':
      if (
        (issue as { type?: string }).type === 'string' &&
        (issue as { minimum?: number }).minimum === 1
      ) {
        return 'VALIDATION_FIELD_REQUIRED';
      }
      return 'VALIDATION_FIELD_TOO_SHORT';
    case 'too_big':
      return 'VALIDATION_FIELD_TOO_LONG';
    case 'invalid_string':
      return 'VALIDATION_FIELD_INVALID_FORMAT';
    case 'invalid_type':
      return 'VALIDATION_FIELD_INVALID_FORMAT';
    default:
      return 'VALIDATION_FAILED';
  }
}

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: DomainError;
}

export function validateBody<T>(schema: z.ZodSchema<T>, data: unknown): ValidationResult<T> {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const validationErrors = result.error.issues.map(issue => {
    const field = issue.path.map(String).join('.') || 'root';
    const validationCode = mapZodErrorToValidationCode(issue);
    const value = issue.path.reduce(
      (obj: unknown, key) =>
        obj && typeof obj === 'object' ? (obj as Record<PropertyKey, unknown>)[key] : undefined,
      data,
    );
    const zodKind =
      (issue as { kind?: string }).kind || (issue as { code?: string }).code || 'unknown';
    return {
      field,
      code: validationCode,
      message: issue.message,
      value,
      zodCode: zodKind,
    };
  });

  if (validationErrors.length === 1) {
    const error = validationErrors[0];
    return {
      success: false,
      error: createValidationError(
        error.field,
        error.code as Parameters<typeof createValidationError>[1],
        error.value,
        error.zodCode,
      ),
    };
  }

  return {
    success: false,
    error: createMultiFieldValidationError(
      validationErrors.map(e => ({
        field: e.field,
        code: e.code as Parameters<typeof createMultiFieldValidationError>[0][number]['code'],
        message: e.message,
      })),
    ),
  };
}

export function validateQuery<T>(schema: z.ZodSchema<T>, query: unknown): ValidationResult<T> {
  return validateBody(schema, query);
}

export function validateRequest<T>(schema: z.ZodSchema<T>): MiddlewareHandler {
  return async (c: Context, next) => {
    try {
      const body = await c.req.json();
      const result = validateBody(schema, body);

      if (!result.success && result.error) {
        return c.json(result.error, result.error.statusCode as 400 | 401 | 403 | 404 | 500);
      }

      c.set('validatedBody', result.data);
      await next();
    } catch {
      const invalidJsonError = createValidationError(
        'body',
        'VALIDATION_INVALID_INPUT',
        null,
        'invalid_json',
      );
      return c.json(invalidJsonError, invalidJsonError.statusCode as 400);
    }
  };
}

export function validateQueryParams<T>(schema: z.ZodSchema<T>): MiddlewareHandler {
  return async (c: Context, next) => {
    const query = c.req.query();
    const result = validateQuery(schema, query);

    if (!result.success && result.error) {
      return c.json(result.error, result.error.statusCode as 400 | 401 | 403 | 404 | 500);
    }

    c.set('validatedQuery', result.data);
    await next();
  };
}
