/**
 * Email queue routes for Hono
 * Handles email queueing via Durable Object
 */

import { Hono } from 'hono';
import { emailRateLimit } from '../middleware/rateLimit.js';

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
      return c.json({ error: 'Email `to` required' }, 400);
    }

    const id = c.env.EMAIL_QUEUE.idFromName('default');
    const queue = c.env.EMAIL_QUEUE.get(id);

    const resp = await queue.fetch('/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await resp.json();
    return c.json({ success: true, queued: data.success });
  } catch (err) {
    console.error('Email queue handler error:', err);
    return c.json({ error: 'Failed to queue email' }, 500);
  }
});

export { emailRoutes };
