import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { createDb } from '@corates/db/client';
import { contactSubmissions } from '@corates/db/schema';
import { DomainErrorException } from '@corates/shared';
import { resetTestDatabase } from '@/__tests__/server/helpers';
import { submitContact } from '@/server/functions/contact.server';

let mockQueueSend: Mock;

const sampleSubmission = {
  name: 'John Doe',
  email: 'john@example.com',
  subject: 'Test Subject',
  message: 'Test message',
};

beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
  mockQueueSend = vi.fn(async () => {});
  vi.spyOn(env.EMAIL_QUEUE, 'send').mockImplementation(mockQueueSend);
  (env as unknown as Record<string, string>).CONTACT_EMAIL = 'contact@example.com';
});

describe('submitContact', () => {
  it('stores the submission and sends a notification email', async () => {
    const db = createDb(env.DB);
    const result = await submitContact(db, sampleSubmission);

    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
    expect(mockQueueSend).toHaveBeenCalledTimes(1);

    const row = await db
      .select()
      .from(contactSubmissions)
      .where(eq(contactSubmissions.id, result.messageId))
      .get();
    expect(row).toBeDefined();
    expect(row!.email).toBe('john@example.com');

    const payload = mockQueueSend.mock.calls[0][0];
    expect(payload.to).toBe('contact@example.com');
    expect(payload.subject).toBe('[Contact Form] Test Subject');
    expect(payload.text).toContain('John Doe');
    expect(payload.html).toContain('John Doe');
  });

  it('accepts submission without subject', async () => {
    const db = createDb(env.DB);
    const result = await submitContact(db, {
      ...sampleSubmission,
      subject: '',
    });

    expect(result.success).toBe(true);
    const payload = mockQueueSend.mock.calls[0][0];
    expect(payload.subject).toBe('[Contact Form] New Inquiry');
  });

  it('deduplicates identical submissions within the same minute', async () => {
    const db = createDb(env.DB);

    await submitContact(db, sampleSubmission);
    const duplicate = await submitContact(db, sampleSubmission);

    expect(duplicate.success).toBe(true);
    expect(mockQueueSend).toHaveBeenCalledTimes(1);
  });

  it('still succeeds when the notification email fails', async () => {
    mockQueueSend.mockRejectedValueOnce(new Error('Queue unavailable'));
    const db = createDb(env.DB);

    const result = await submitContact(db, sampleSubmission);

    expect(result.success).toBe(true);
    const row = await db
      .select()
      .from(contactSubmissions)
      .where(eq(contactSubmissions.id, result.messageId))
      .get();
    expect(row).toBeDefined();
  });

  it('rejects the sixth submission within an hour from the same email', async () => {
    const db = createDb(env.DB);

    for (let i = 0; i < 5; i++) {
      await submitContact(db, { ...sampleSubmission, message: `Message ${i}` });
    }

    try {
      await submitContact(db, { ...sampleSubmission, message: 'One too many' });
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as DomainErrorException;
      expect(res.statusCode).toBe(429);
      const body = res.toDomainError() as { code: string };
      expect(body.code).toBe('SYSTEM_RATE_LIMITED');
    }
  });
});
