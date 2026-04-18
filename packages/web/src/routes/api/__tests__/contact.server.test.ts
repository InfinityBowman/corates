import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { env } from 'cloudflare:test';
import { handler } from '../contact';

function jsonRequest(body: unknown): Request {
  return new Request('http://localhost/api/contact', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

let mockQueueSend: Mock;

beforeEach(() => {
  mockQueueSend = vi.fn(async () => {});
  vi.spyOn(env.EMAIL_QUEUE, 'send').mockImplementation(mockQueueSend);
  (env as unknown as Record<string, string>).CONTACT_EMAIL = 'contact@example.com';
});

describe('POST /api/contact', () => {
  it('accepts valid submission', async () => {
    const res = await handler({
      request: jsonRequest({
        name: 'John Doe',
        email: 'john@example.com',
        subject: 'Test Subject',
        message: 'Test message',
      }),
    });

    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(body.messageId).toBeDefined();
    expect(mockQueueSend).toHaveBeenCalledTimes(1);

    const payload = mockQueueSend.mock.calls[0][0];
    expect(payload.to).toBe('contact@example.com');
    expect(payload.subject).toBe('[Contact Form] Test Subject');
    expect(payload.text).toContain('John Doe');
    expect(payload.html).toContain('John Doe');
  });

  it('accepts submission without subject', async () => {
    const res = await handler({
      request: jsonRequest({
        name: 'John Doe',
        email: 'john@example.com',
        message: 'Test message',
      }),
    });

    expect(res.status).toBe(200);
    const payload = mockQueueSend.mock.calls[0][0];
    expect(payload.subject).toBe('[Contact Form] New Inquiry');
  });

  it('rejects missing name', async () => {
    const res = await handler({
      request: jsonRequest({
        email: 'john@example.com',
        message: 'Test message',
      }),
    });

    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.code).toMatch(/VALIDATION/);
    expect(body.message).toMatch(/name/i);
  });

  it('rejects missing email', async () => {
    const res = await handler({
      request: jsonRequest({
        name: 'John Doe',
        message: 'Test message',
      }),
    });

    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.code).toMatch(/VALIDATION/);
    expect(body.message).toMatch(/email/i);
  });

  it('rejects invalid email format', async () => {
    const res = await handler({
      request: jsonRequest({
        name: 'John Doe',
        email: 'not-an-email',
        message: 'Test message',
      }),
    });

    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.code).toMatch(/VALIDATION/);
    expect(body.message).toMatch(/email/i);
  });

  it('rejects missing message', async () => {
    const res = await handler({
      request: jsonRequest({
        name: 'John Doe',
        email: 'john@example.com',
      }),
    });

    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.code).toMatch(/VALIDATION/);
    expect(body.message).toMatch(/message/i);
  });

  it('rejects name longer than 100 characters', async () => {
    const res = await handler({
      request: jsonRequest({
        name: 'a'.repeat(101),
        email: 'john@example.com',
        message: 'Test message',
      }),
    });

    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.code).toMatch(/VALIDATION/);
    expect(body.message).toMatch(/name/i);
  });

  it('rejects message longer than 2000 characters', async () => {
    const res = await handler({
      request: jsonRequest({
        name: 'John Doe',
        email: 'john@example.com',
        message: 'a'.repeat(2001),
      }),
    });

    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.code).toMatch(/VALIDATION/);
    expect(body.message).toMatch(/message/i);
  });

  it('returns 503 when queue send fails', async () => {
    mockQueueSend.mockRejectedValueOnce(new Error('Queue unavailable'));

    const res = await handler({
      request: jsonRequest({
        name: 'John Doe',
        email: 'john@example.com',
        message: 'Test message',
      }),
    });

    expect(res.status).toBe(503);
    const body = await readJson(res);
    expect(body.code).toMatch(/SYSTEM_EMAIL_SEND_FAILED/);
  });

  it('trims whitespace from fields', async () => {
    const res = await handler({
      request: jsonRequest({
        name: '  John Doe  ',
        email: '  john@example.com  ',
        message: '  Test message  ',
      }),
    });

    expect(res.status).toBe(200);
    const payload = mockQueueSend.mock.calls[0][0];
    expect(payload.text).toContain('John Doe');
    expect(payload.text).not.toMatch(/^ {2}John/);
  });

  it('rejects invalid JSON body', async () => {
    const res = await handler({
      request: new Request('http://localhost/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not-json',
      }),
    });

    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.message).toMatch(/JSON/i);
  });
});
