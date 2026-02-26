/**
 * Email queue routes for Hono
 * Handles email queueing via Durable Object
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { emailRateLimit } from '@/middleware/rateLimit';
import {
  createDomainError,
  createValidationError,
  VALIDATION_ERRORS,
  SYSTEM_ERRORS,
} from '@corates/shared';
import type { ValidationErrorCode } from '@corates/shared';
import type { Env } from '../types';

const emailRoutes = new OpenAPIHono<{ Bindings: Env }>({
  defaultHook: (result, c) => {
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const field = firstIssue?.path?.[0] || 'input';
      const fieldName = String(field).charAt(0).toUpperCase() + String(field).slice(1);

      let errorCode: ValidationErrorCode = VALIDATION_ERRORS.INVALID_INPUT.code;
      let message = firstIssue?.message || 'Validation failed';

      const isMissing =
        firstIssue?.code === 'invalid_type' ||
        message.includes('received undefined') ||
        message.includes('Required');

      if (isMissing) {
        errorCode = VALIDATION_ERRORS.FIELD_REQUIRED.code;
        message = `${fieldName} is required`;
      } else if (firstIssue?.code === 'too_big') {
        errorCode = VALIDATION_ERRORS.FIELD_TOO_LONG.code;
      } else if (firstIssue?.code === 'too_small') {
        errorCode = VALIDATION_ERRORS.FIELD_TOO_SHORT.code;
      } else if (firstIssue?.code === 'invalid_format') {
        errorCode = VALIDATION_ERRORS.FIELD_INVALID_FORMAT.code;
      }

      const error = createValidationError(String(field), errorCode, null);
      error.message = message;
      return c.json(error, 400);
    }
  },
});

// Apply rate limiting to email endpoints
emailRoutes.use('*', emailRateLimit);

// Request schema
const EmailQueueRequestSchema = z
  .object({
    to: z.string().email().openapi({ example: 'user@example.com' }),
    subject: z.string().optional().openapi({ example: 'Welcome to CoRATES' }),
    body: z.string().optional().openapi({ example: 'Email body content' }),
    template: z.string().optional().openapi({ example: 'welcome' }),
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .openapi('EmailQueueRequest');

// Response schemas
const EmailQueueSuccessSchema = z
  .object({
    success: z.literal(true),
    queued: z.boolean(),
  })
  .openapi('EmailQueueSuccess');

const ErrorSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    statusCode: z.number(),
    field: z.string().optional(),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .openapi('EmailError');

// Queue email route
const queueEmailRoute = createRoute({
  method: 'post',
  path: '/queue',
  tags: ['Email'],
  summary: 'Queue email',
  description: 'Enqueue an email to be sent via the email queue Durable Object',
  request: {
    body: {
      content: {
        'application/json': {
          schema: EmailQueueRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: EmailQueueSuccessSchema,
        },
      },
      description: 'Email queued successfully',
    },
    400: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Validation error',
    },
    429: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Rate limit exceeded',
    },
    500: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Email queue error',
    },
  },
});

// @ts-expect-error OpenAPIHono strict return types don't account for error responses
emailRoutes.openapi(queueEmailRoute, async c => {
  try {
    const payload = c.req.valid('json');

    const id = c.env.EMAIL_QUEUE.idFromName('default');
    const queue = c.env.EMAIL_QUEUE.get(id);

    await queue.queueEmail(payload as import('../durable-objects/EmailQueue').EmailPayload);

    return c.json({ success: true as const, queued: true });
  } catch (err) {
    const error = err as Error;
    console.error('Email queue handler error:', error);
    const domainError = createDomainError(SYSTEM_ERRORS.EMAIL_SEND_FAILED, {
      operation: 'queue_email',
      originalError: error.message,
    });
    return c.json(domainError, domainError.statusCode as ContentfulStatusCode);
  }
});

export { emailRoutes };
