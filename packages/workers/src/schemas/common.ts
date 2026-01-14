/**
 * Common OpenAPI schemas used across routes
 */

import { z } from '@hono/zod-openapi';

/**
 * Standard success response with optional data
 */
export const SuccessResponseSchema = z
  .object({
    success: z.boolean().openapi({ example: true }),
  })
  .openapi('SuccessResponse');

/**
 * Domain error response matching @corates/shared error format
 */
export const ErrorResponseSchema = z
  .object({
    code: z.string().openapi({ example: 'VALIDATION_ERROR' }),
    message: z.string().openapi({ example: 'Validation failed' }),
    statusCode: z.number().openapi({ example: 400 }),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .openapi('ErrorResponse');

/**
 * Validation error response
 */
export const ValidationErrorSchema = z
  .object({
    code: z.string().openapi({ example: 'VALIDATION_ERROR' }),
    message: z.string().openapi({ example: 'Field is required' }),
    statusCode: z.literal(400).openapi({ example: 400 }),
    field: z.string().optional().openapi({ example: 'email' }),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .openapi('ValidationError');
