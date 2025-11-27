import { jsonResponse, errorResponse } from '../middleware/cors.js';

// Route to enqueue email payload to Durable Object
export async function handleEmailQueue(request, env) {
  try {
    if (request.method !== 'POST') {
      return errorResponse('Method Not Allowed', 405, request);
    }

    const payload = await request.json();
    if (!payload?.to) {
      return errorResponse('Email `to` required', 400, request);
    }

    const id = env.EMAIL_QUEUE.idFromName('default');
    const queue = env.EMAIL_QUEUE.get(id);

    const resp = await queue.fetch('/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await resp.json();
    return jsonResponse({ success: true, queued: data.success }, {}, request);
  } catch (err) {
    console.error('Email queue handler error:', err);
    return errorResponse('Failed to queue email', 500, request);
  }
}
