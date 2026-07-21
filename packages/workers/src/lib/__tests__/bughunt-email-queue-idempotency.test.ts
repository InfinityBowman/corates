/**
 * Bug hunt: email queue idempotency vs retry interaction.
 *
 * The consumer (src/queue.ts handleEmailQueue) records the queue message id in
 * processed_emails BEFORE attempting the send. When the send fails it calls
 * msg.retry(), but the id is already recorded, so on redelivery
 * isAlreadyProcessed() returns true and the message is acked WITHOUT ever
 * sending the email. Any email whose first delivery attempt fails transiently
 * is therefore permanently dropped, and the retry/backoff logic can never
 * succeed.
 *
 * This test uses the real D1 test database (so the ON CONFLICT DO NOTHING
 * semantics are exercised for real) and asserts the CORRECT behavior: a
 * redelivered message whose previous send failed must be sent again.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { env } from 'cloudflare:workers';
import { resetTestDatabase } from '../../__tests__/helpers.js';
import type { EmailPayload } from '@corates/shared/email';

const mockSendEmail = vi.fn();
vi.mock('../../auth/email.js', () => ({
  createEmailService: () => ({
    sendEmail: mockSendEmail,
    isProduction: false,
  }),
}));

function createMockMessage(id: string, payload: EmailPayload, attempts: number) {
  return {
    id,
    body: payload,
    attempts,
    ack: vi.fn(),
    retry: vi.fn(),
    timestamp: new Date(),
  };
}

function createMockBatch(messages: ReturnType<typeof createMockMessage>[]) {
  return {
    messages,
    queue: 'corates-emails',
    ackAll: vi.fn(),
    retryAll: vi.fn(),
  };
}

const payload: EmailPayload = {
  to: 'user@example.com',
  subject: 'Bug hunt',
  html: '<p>hi</p>',
  text: 'hi',
};

describe('email queue consumer: retry after transient failure', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetTestDatabase();
  });

  // .fails: documents a known unfixed bug without failing CI. When the bug is
  // fixed, vitest reports this test as failing -- then restore plain it().
  it.fails('sends the email on redelivery when the first send attempt failed', async () => {
    const { handleEmailQueue } = await import('../../queue.js');

    const consumerEnv = {
      ENVIRONMENT: 'test',
      POSTMARK_SERVER_TOKEN: 'test-token',
      EMAIL_FROM: 'noreply@test.com',
      DB: env.DB,
    } as never;

    // First send attempt fails transiently, all subsequent attempts succeed
    mockSendEmail
      .mockResolvedValueOnce({ success: false, error: 'Transient upstream failure' })
      .mockResolvedValue({ success: true, id: 'mock-id' });

    const messageId = crypto.randomUUID();

    // Delivery attempt 1: send fails, message must be retried (not acked)
    const firstDelivery = createMockMessage(messageId, payload, 1);
    await handleEmailQueue(createMockBatch([firstDelivery]) as never, consumerEnv);

    expect(firstDelivery.ack).not.toHaveBeenCalled();
    expect(firstDelivery.retry).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);

    // Delivery attempt 2 (queue redelivers the SAME message id): the email was
    // never sent, so the consumer must attempt the send again and ack only
    // after it succeeds.
    const secondDelivery = createMockMessage(messageId, payload, 2);
    await handleEmailQueue(createMockBatch([secondDelivery]) as never, consumerEnv);

    // CORRECT behavior: the redelivered message is actually sent.
    // BUG: isAlreadyProcessed() recorded the id before the failed send, so the
    // consumer acks without sending and the email is silently dropped.
    expect(mockSendEmail).toHaveBeenCalledTimes(2);
    expect(secondDelivery.ack).toHaveBeenCalledTimes(1);
  });
});
