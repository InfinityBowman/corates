/**
 * Tests for contact routes
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { json } from '@/__tests__/helpers.js';

// Mock Postmark
const mockSendEmail = vi.fn(async () => ({
  ErrorCode: 0,
  MessageID: 'test-message-id',
}));

vi.mock('postmark', () => {
  return {
    Client: class {
      constructor() {
        this.sendEmail = mockSendEmail;
      }
    },
  };
});

let app;

beforeAll(async () => {
  const { contactRoutes } = await import('../contact.js');
  app = new Hono();
  app.route('/api/contact', contactRoutes);
});

beforeEach(() => {
  vi.clearAllMocks();
  // Reset rate limiter by using unique IPs for each test
  // This prevents rate limiting from interfering with other tests
});

let testCounter = 0;

async function fetchContact(path = '', init = {}) {
  testCounter++;
  const testEnv = {
    ...env,
    POSTMARK_SERVER_TOKEN: 'test-token',
    CONTACT_EMAIL: 'contact@example.com',
    EMAIL_FROM: 'noreply@example.com',
  };

  // Use unique IP for each test to avoid rate limiting interference
  const headers = {
    'CF-Connecting-IP': `192.168.1.${testCounter}`,
    ...init.headers,
  };

  const ctx = createExecutionContext();
  const req = new Request(`http://localhost/api/contact${path}`, {
    ...init,
    headers,
  });
  const res = await app.fetch(req, testEnv, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

describe('Contact Routes - POST /api/contact', () => {
  it('should accept valid contact form submission', async () => {
    const res = await fetchContact('', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'John Doe',
        email: 'john@example.com',
        subject: 'Test Subject',
        message: 'Test message',
      }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.messageId).toBe('test-message-id');
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  it('should accept submission without subject', async () => {
    const res = await fetchContact('', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'John Doe',
        email: 'john@example.com',
        message: 'Test message',
      }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
  });

  it('should reject missing name', async () => {
    const res = await fetchContact('', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'john@example.com',
        message: 'Test message',
      }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toBeDefined();
    expect(body.code).toMatch(/VALIDATION/);
    expect(body.message || body.error).toMatch(/name/i);
  });

  it('should reject missing email', async () => {
    const res = await fetchContact('', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'John Doe',
        message: 'Test message',
      }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toBeDefined();
    expect(body.code).toMatch(/VALIDATION/);
    expect(body.message || body.error).toMatch(/email/i);
  });

  it('should reject invalid email format', async () => {
    const res = await fetchContact('', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'John Doe',
        email: 'not-an-email',
        message: 'Test message',
      }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toBeDefined();
    expect(body.code).toMatch(/VALIDATION/);
    expect(body.message || body.error).toMatch(/email/i);
  });

  it('should reject missing message', async () => {
    const res = await fetchContact('', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'John Doe',
        email: 'john@example.com',
      }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toBeDefined();
    expect(body.code).toMatch(/VALIDATION/);
    expect(body.message || body.error).toMatch(/message/i);
  });

  it('should reject name longer than 100 characters', async () => {
    const res = await fetchContact('', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'a'.repeat(101),
        email: 'john@example.com',
        message: 'Test message',
      }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toBeDefined();
    expect(body.code).toMatch(/VALIDATION/);
    expect(body.message || body.error).toMatch(/name/i);
  });

  it('should reject message longer than 2000 characters', async () => {
    const res = await fetchContact('', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'John Doe',
        email: 'john@example.com',
        message: 'a'.repeat(2001),
      }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toBeDefined();
    expect(body.code).toMatch(/VALIDATION/);
    expect(body.message || body.error).toMatch(/message/i);
  });

  it('should handle Postmark API errors', async () => {
    mockSendEmail.mockResolvedValueOnce({
      ErrorCode: 406,
      Message: 'Invalid email',
    });

    const res = await fetchContact('', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'John Doe',
        email: 'john@example.com',
        message: 'Test message',
      }),
    });

    expect(res.status).toBe(500);
    const body = await json(res);
    expect(body.code).toBeDefined();
    expect(body.code).toMatch(/SYSTEM_EMAIL_SEND_FAILED/);
    expect(body.message || body.error).toBeDefined();
  });

  it('should return error when POSTMARK_SERVER_TOKEN not configured', async () => {
    const testEnv = {
      ...env,
      POSTMARK_SERVER_TOKEN: null,
    };

    const ctx = createExecutionContext();
    const req = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'John Doe',
        email: 'john@example.com',
        message: 'Test message',
      }),
    });
    const res = await app.fetch(req, testEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(503);
    const body = await json(res);
    expect(body.code).toBeDefined();
    expect(body.code).toMatch(/SYSTEM_SERVICE_UNAVAILABLE/);
    expect(body.message || body.error).toMatch(/service|unavailable/i);
  });

  it('should trim whitespace from fields', async () => {
    const res = await fetchContact('', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: '  John Doe  ',
        email: '  john@example.com  ',
        message: '  Test message  ',
      }),
    });

    expect(res.status).toBe(200);
    expect(mockSendEmail).toHaveBeenCalled();
    const callArgs = mockSendEmail.mock.calls[0][0];
    expect(callArgs.TextBody).toContain('John Doe');
    expect(callArgs.TextBody).not.toContain('  ');
  });
});
