import { z } from 'zod';
import { PROJECT_ROLES } from './constants';
import { createValidationError, createMultiFieldValidationError } from '@corates/shared';
import type { DomainError } from '@corates/shared';

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

interface ValidationResult<T> {
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
