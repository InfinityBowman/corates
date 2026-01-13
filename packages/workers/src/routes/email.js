/**
 * Email queue routes for Hono
 * Handles email queueing via Durable Object
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { emailRateLimit } from '@/middleware/rateLimit.js';
import {
  createDomainError,
  createValidationError,
  VALIDATION_ERRORS,
  SYSTEM_ERRORS,
} from '@corates/shared';

const emailRoutes = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const field = firstIssue?.path?.[0] || 'input';
      const fieldName = String(field).charAt(0).toUpperCase() + String(field).slice(1);

      let message = firstIssue?.message || 'Validation failed';
      const isMissing =
        firstIssue?.received === 'undefined' ||
        message.includes('received undefined') ||
        message.includes('Required');

      if (isMissing) {
        message = `${fieldName} is required`;
      }

      const error = createValidationError(
        String(field),
        VALIDATION_ERRORS.FIELD_REQUIRED.code,
        null,
      );
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
    data: z.record(z.unknown()).optional(),
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
    details: z.record(z.unknown()).optional(),
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

emailRoutes.openapi(queueEmailRoute, async c => {
  try {
    const payload = c.req.valid('json');

    const id = c.env.EMAIL_QUEUE.idFromName('default');
    const queue = c.env.EMAIL_QUEUE.get(id);

    const resp = await queue.fetch(
      new Request('https://internal/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    );

    const data = await resp.json();
    return c.json({ success: true, queued: data.success });
  } catch (err) {
    console.error('Email queue handler error:', err);
    const error = createDomainError(SYSTEM_ERRORS.EMAIL_SEND_FAILED, {
      operation: 'queue_email',
      originalError: err.message,
    });
    return c.json(error, error.statusCode);
  }
});

export { emailRoutes };
