/**
 * Tests for email queue consumer and producer
 *
 * Exercises the queue consumer's batch processing: ack on success,
 * retry with exponential backoff on failure, and high-throughput scenarios.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { EmailPayload } from '../email-queue.js';

vi.mock('postmark', () => ({
  Client: class {
    sendEmail() {
      return Promise.resolve({ ErrorCode: 0, MessageID: 'mock-id' });
    }
  },
}));

const mockSendEmail = vi.fn();
vi.mock('../../auth/email.js', () => ({
  createEmailService: () => ({
    sendEmail: mockSendEmail,
    isProduction: false,
  }),
}));

function createMockMessage(payload: EmailPayload, attempts = 0) {
  return {
    body: payload,
    attempts,
    ack: vi.fn(),
    retry: vi.fn(),
    id: crypto.randomUUID(),
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

function makePayload(index: number): EmailPayload {
  return {
    to: `user${index}@example.com`,
    subject: `Test email ${index}`,
    html: `<p>Email body ${index}</p>`,
    text: `Email body ${index}`,
  };
}

describe('Email Queue Consumer', () => {
  let workerHandler: { queue: (batch: any, env: any) => Promise<void> };
  const testEnv = {
    ENVIRONMENT: 'test',
    POSTMARK_SERVER_TOKEN: 'test-token',
    EMAIL_FROM: 'noreply@test.com',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockSendEmail.mockResolvedValue({ success: true, id: 'mock-id' });

    const mod = await import('../../index.js');
    workerHandler = mod.default as any;
  });

  it('should process 100 emails and ack all of them', async () => {
    const messages = Array.from({ length: 100 }, (_, i) => createMockMessage(makePayload(i)));
    const batch = createMockBatch(messages);

    await workerHandler.queue(batch, testEnv);

    const acked = messages.filter(m => m.ack.mock.calls.length > 0);
    const retried = messages.filter(m => m.retry.mock.calls.length > 0);

    expect(acked).toHaveLength(100);
    expect(retried).toHaveLength(0);
    expect(mockSendEmail).toHaveBeenCalledTimes(100);
  });

  it('should retry with exponential backoff capped at 1800s', async () => {
    mockSendEmail.mockResolvedValue({ success: false, error: 'Transient failure' });

    const cases = [
      { attempts: 0, expectedDelay: 30 },
      { attempts: 1, expectedDelay: 60 },
      { attempts: 2, expectedDelay: 120 },
      { attempts: 3, expectedDelay: 240 },
      { attempts: 5, expectedDelay: 960 },
      { attempts: 10, expectedDelay: 1800 },
    ];

    for (const { attempts, expectedDelay } of cases) {
      const msg = createMockMessage(makePayload(0), attempts);
      await workerHandler.queue(createMockBatch([msg]), testEnv);

      expect(msg.ack).not.toHaveBeenCalled();
      expect(msg.retry).toHaveBeenCalledWith({ delaySeconds: expectedDelay });
    }
  });

  it('should handle mixed success and failure in a batch', async () => {
    let callCount = 0;
    mockSendEmail.mockImplementation(async () => {
      callCount++;
      if (callCount % 3 === 0) {
        return { success: false, error: 'Server error' };
      }
      return { success: true, id: `msg-${callCount}` };
    });

    const messages = Array.from({ length: 30 }, (_, i) => createMockMessage(makePayload(i)));
    const batch = createMockBatch(messages);

    await workerHandler.queue(batch, testEnv);

    const acked = messages.filter(m => m.ack.mock.calls.length > 0);
    const retried = messages.filter(m => m.retry.mock.calls.length > 0);

    expect(acked).toHaveLength(20);
    expect(retried).toHaveLength(10);
  });

  it('should retry when email service throws an exception', async () => {
    mockSendEmail.mockRejectedValue(new Error('Network timeout'));

    const msg = createMockMessage(makePayload(1));
    await workerHandler.queue(createMockBatch([msg]), testEnv);

    expect(msg.ack).not.toHaveBeenCalled();
    expect(msg.retry).toHaveBeenCalledTimes(1);
  });
});

describe('Email Queue Producer', () => {
  it('should reject payloads missing required fields', async () => {
    const { queueEmail } = await import('../email-queue.js');
    const mockEnv = { EMAIL_QUEUE: { send: vi.fn() } } as any;

    await expect(
      queueEmail(mockEnv, { to: '', subject: 'Hi', html: '<p>Hi</p>' }),
    ).rejects.toThrow();
    await expect(
      queueEmail(mockEnv, { to: 'a@b.com', subject: '', html: '<p>Hi</p>' }),
    ).rejects.toThrow();
    await expect(queueEmail(mockEnv, { to: 'a@b.com', subject: 'Hi' } as any)).rejects.toThrow();
  });

  it('should queue 100 emails and process them all through the consumer', async () => {
    mockSendEmail.mockClear();
    mockSendEmail.mockResolvedValue({ success: true, id: 'mock-id' });
    const { queueEmail } = await import('../email-queue.js');

    const queued: EmailPayload[] = [];
    const mockSend = vi.fn(async (payload: EmailPayload) => {
      queued.push(payload);
    });
    const mockEnv = { EMAIL_QUEUE: { send: mockSend } } as any;

    await Promise.all(
      Array.from({ length: 100 }, (_, i) => queueEmail(mockEnv, makePayload(i))),
    );
    expect(queued).toHaveLength(100);

    const mod = await import('../../index.js');
    const workerHandler = mod.default as any;
    const consumerEnv = {
      ENVIRONMENT: 'test',
      POSTMARK_SERVER_TOKEN: 'test-token',
      EMAIL_FROM: 'noreply@test.com',
    };

    const messages = queued.map(payload => createMockMessage(payload));
    const batch = createMockBatch(messages);

    await workerHandler.queue(batch, consumerEnv);

    expect(mockSendEmail).toHaveBeenCalledTimes(100);
    for (let i = 0; i < 100; i++) {
      expect(messages[i].ack).toHaveBeenCalledTimes(1);
      expect(messages[i].retry).not.toHaveBeenCalled();
    }
  });
});
