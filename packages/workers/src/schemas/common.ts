/**
 * Common OpenAPI schemas used across routes
 */

import { z } from '@hono/zod-openapi';

/**
 * Domain error response matching @corates/shared error format
 */
export const ErrorResponseSchema = z
  .object({
    code: z.string().openapi({ example: 'VALIDATION_ERROR' }),
    message: z.string().openapi({ example: 'Validation failed' }),
    statusCode: z.number().openapi({ example: 400 }),
    details: z.any().optional(),
    timestamp: z.string().optional(),
  })
  .openapi('ErrorResponse');
