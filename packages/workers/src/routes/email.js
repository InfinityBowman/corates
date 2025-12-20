/**
 * Email queue routes for Hono
 * Handles email queueing via Durable Object
 */

import { Hono } from 'hono';
import { emailRateLimit } from '../middleware/rateLimit.js';
import {
  createDomainError,
  createValidationError,
  VALIDATION_ERRORS,
  SYSTEM_ERRORS,
} from '@corates/shared';

const emailRoutes = new Hono();

// Apply rate limiting to email endpoints
emailRoutes.use('*', emailRateLimit);

/**
 * POST /api/email/queue
 * Enqueue email payload to Durable Object
 */
emailRoutes.post('/queue', async c => {
  try {
    const payload = await c.req.json();

    if (!payload?.to) {
      const error = createValidationError(
        'to',
        VALIDATION_ERRORS.FIELD_REQUIRED.code,
        null,
        'required',
      );
      return c.json(error, error.statusCode);
    }

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
