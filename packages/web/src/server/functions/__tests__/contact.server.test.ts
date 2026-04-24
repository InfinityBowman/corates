import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { env } from 'cloudflare:test';
import { sendContactEmail } from '@/server/functions/contact.server';

const dummyRequest = new Request('http://localhost/api/contact', { method: 'POST' });

let mockQueueSend: Mock;

beforeEach(() => {
  mockQueueSend = vi.fn(async () => {});
  vi.spyOn(env.EMAIL_QUEUE, 'send').mockImplementation(mockQueueSend);
  (env as unknown as Record<string, string>).CONTACT_EMAIL = 'contact@example.com';
});

describe('sendContactEmail', () => {
  it('accepts valid submission', async () => {
    const result = await sendContactEmail(dummyRequest, {
      name: 'John Doe',
      email: 'john@example.com',
      subject: 'Test Subject',
      message: 'Test message',
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
    expect(mockQueueSend).toHaveBeenCalledTimes(1);

    const payload = mockQueueSend.mock.calls[0][0];
    expect(payload.to).toBe('contact@example.com');
    expect(payload.subject).toBe('[Contact Form] Test Subject');
    expect(payload.text).toContain('John Doe');
    expect(payload.html).toContain('John Doe');
  });

  it('accepts submission without subject', async () => {
    const result = await sendContactEmail(dummyRequest, {
      name: 'John Doe',
      email: 'john@example.com',
      subject: '',
      message: 'Test message',
    });

    expect(result.success).toBe(true);
    const payload = mockQueueSend.mock.calls[0][0];
    expect(payload.subject).toBe('[Contact Form] New Inquiry');
  });

  it('throws 503 when queue send fails', async () => {
    mockQueueSend.mockRejectedValueOnce(new Error('Queue unavailable'));

    try {
      await sendContactEmail(dummyRequest, {
        name: 'John Doe',
        email: 'john@example.com',
        subject: '',
        message: 'Test message',
      });
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as Response;
      expect(res.status).toBe(503);
      const body = (await res.json()) as { code: string };
      expect(body.code).toMatch(/SYSTEM_EMAIL_SEND_FAILED/);
    }
  });
});
