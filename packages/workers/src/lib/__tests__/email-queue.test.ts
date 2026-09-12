/**
 * Tests for email queue consumer and producer
 *
 * Exercises the queue consumer's batch processing: ack on success,
 * retry with exponential backoff on failure, and high-throughput scenarios.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { EmailPayload } from '@corates/shared/email';

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

// In-memory stand-in for the processed_emails table so tests exercise the
// real dedup behavior: SELECT reads the set, INSERT adds to it. Every other
// statement (the invitation status update) is recorded for assertions.
function createMockDb() {
  const processed = new Set<string>();
  const statements: { sql: string; params: unknown[] }[] = [];
  return {
    statements,
    prepare: (sql: string) => ({
      bind: (...params: unknown[]) => {
        const id = params[0] as string;
        statements.push({ sql, params });
        return {
          first: () => Promise.resolve(processed.has(id) ? { 1: 1 } : null),
          run: () => {
            const changes = sql.startsWith('INSERT') && !processed.has(id) ? 1 : 0;
            if (sql.startsWith('INSERT')) processed.add(id);
            return Promise.resolve({ meta: { changes }, success: true });
          },
        };
      },
    }),
  };
}

function undeliverableUpdates(db: ReturnType<typeof createMockDb>) {
  return db.statements.filter(
    s => /update "project_invitations"/i.test(s.sql) && s.params.includes('undeliverable'),
  );
}

function createMockBatch(messages: ReturnType<typeof createMockMessage>[]) {
  return {
    messages,
    queue: 'corates-emails',
    ackAll: vi.fn(),
    retryAll: vi.fn(),
    metadata: { metrics: { backlogCount: 0, backlogBytes: 0 } },
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
    DB: createMockDb(),
  } as never;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockSendEmail.mockResolvedValue({ success: true, id: 'mock-id' });

    const mod = await import('../../queue.js');
    workerHandler = { queue: mod.handleEmailQueue };
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

  it('acks a permanently rejected address without retrying and flags the invitation', async () => {
    mockSendEmail.mockResolvedValue({
      success: false,
      permanent: true,
      error: 'Inactive recipient',
    });
    const db = createMockDb();
    const env = { ...(testEnv as object), DB: db } as never;

    const msg = createMockMessage({ ...makePayload(0), invitationId: 'inv-1' });
    await workerHandler.queue(createMockBatch([msg]), env);

    expect(msg.ack).toHaveBeenCalledTimes(1);
    expect(msg.retry).not.toHaveBeenCalled();
    const updates = undeliverableUpdates(db);
    expect(updates).toHaveLength(1);
    expect(updates[0].params).toContain('inv-1');
  });

  it('does not touch the database for a permanent failure with no invitation', async () => {
    mockSendEmail.mockResolvedValue({ success: false, permanent: true, error: 'Bad address' });
    const db = createMockDb();
    const env = { ...(testEnv as object), DB: db } as never;

    const msg = createMockMessage(makePayload(0));
    await workerHandler.queue(createMockBatch([msg]), env);

    expect(msg.ack).toHaveBeenCalledTimes(1);
    expect(undeliverableUpdates(db)).toHaveLength(0);
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

  it('should send again on redelivery after a failed send', async () => {
    const env = {
      ENVIRONMENT: 'test',
      POSTMARK_SERVER_TOKEN: 'test-token',
      EMAIL_FROM: 'noreply@test.com',
      DB: createMockDb(),
    } as never;

    mockSendEmail.mockResolvedValueOnce({ success: false, error: 'Transient failure' });
    const msg = createMockMessage(makePayload(1));
    await workerHandler.queue(createMockBatch([msg]), env);

    expect(msg.ack).not.toHaveBeenCalled();
    expect(msg.retry).toHaveBeenCalledTimes(1);

    // Redelivery of the same message id must not be suppressed by the
    // dedup marker, since the send never succeeded.
    mockSendEmail.mockResolvedValueOnce({ success: true, id: 'mock-id' });
    const redelivery = { ...createMockMessage(makePayload(1), 1), id: msg.id };
    await workerHandler.queue(createMockBatch([redelivery]), env);

    expect(mockSendEmail).toHaveBeenCalledTimes(2);
    expect(redelivery.ack).toHaveBeenCalledTimes(1);
    expect(redelivery.retry).not.toHaveBeenCalled();
  });

  it('should ack a duplicate delivery of an already-sent message without resending', async () => {
    const env = {
      ENVIRONMENT: 'test',
      POSTMARK_SERVER_TOKEN: 'test-token',
      EMAIL_FROM: 'noreply@test.com',
      DB: createMockDb(),
    } as never;

    const msg = createMockMessage(makePayload(1));
    await workerHandler.queue(createMockBatch([msg]), env);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(msg.ack).toHaveBeenCalledTimes(1);

    const duplicate = { ...createMockMessage(makePayload(1)), id: msg.id };
    await workerHandler.queue(createMockBatch([duplicate]), env);

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(duplicate.ack).toHaveBeenCalledTimes(1);
    expect(duplicate.retry).not.toHaveBeenCalled();
  });
});

describe('Email Queue Producer', () => {
  it('should reject payloads missing required fields', async () => {
    const { queueEmail } = await import('@corates/shared/email');
    const mockEnv = { EMAIL_QUEUE: { send: vi.fn() } } as any;

    await expect(
      queueEmail(mockEnv.EMAIL_QUEUE, { to: '', subject: 'Hi', html: '<p>Hi</p>' }),
    ).rejects.toThrow();
    await expect(
      queueEmail(mockEnv.EMAIL_QUEUE, { to: 'a@b.com', subject: '', html: '<p>Hi</p>' }),
    ).rejects.toThrow();
    await expect(
      queueEmail(mockEnv.EMAIL_QUEUE, { to: 'a@b.com', subject: 'Hi' } as any),
    ).rejects.toThrow();
  });

  it('should queue emails and process them all through the consumer', async () => {
    mockSendEmail.mockClear();
    mockSendEmail.mockResolvedValue({ success: true, id: 'mock-id' });
    const { queueEmail } = await import('@corates/shared/email');

    const queued: EmailPayload[] = [];
    const mockSend = vi.fn(async (payload: EmailPayload) => {
      queued.push(payload);
    });
    const mockEnv = { EMAIL_QUEUE: { send: mockSend } } as any;

    await Promise.all(
      Array.from({ length: 50 }, (_, i) => queueEmail(mockEnv.EMAIL_QUEUE, makePayload(i))),
    );
    expect(queued).toHaveLength(50);

    const mod = await import('../../queue.js');
    const workerHandler = { queue: mod.handleEmailQueue };
    const consumerEnv = {
      ENVIRONMENT: 'test',
      POSTMARK_SERVER_TOKEN: 'test-token',
      EMAIL_FROM: 'noreply@test.com',
      DB: createMockDb(),
    } as never;

    const messages = queued.map(payload => createMockMessage(payload));
    const batch = createMockBatch(messages);

    await workerHandler.queue(batch, consumerEnv);

    expect(mockSendEmail).toHaveBeenCalledTimes(50);
    for (const msg of messages) {
      expect(msg.ack).toHaveBeenCalledTimes(1);
      expect(msg.retry).not.toHaveBeenCalled();
    }
  });
});

describe('Dead-letter consumer', () => {
  it('logs every dead-lettered message and acks it', async () => {
    const logged: Record<string, unknown>[] = [];
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(line => {
      logged.push(JSON.parse(line as string));
    });

    const { handleEmailDeadLetter } = await import('../../queue.js');
    const db = createMockDb();
    const messages = [
      createMockMessage({ ...makePayload(0), invitationId: 'inv-dead' }),
      createMockMessage(makePayload(1)),
    ];

    await handleEmailDeadLetter(createMockBatch(messages), { DB: db } as never);

    expect(logged.map(e => e.message)).toEqual(['email.dead_lettered', 'email.dead_lettered']);
    expect(logged[0]).toMatchObject({ to: 'user0@example.com', subject: 'Test email 0' });
    for (const msg of messages) {
      expect(msg.ack).toHaveBeenCalledTimes(1);
      expect(msg.retry).not.toHaveBeenCalled();
    }
    const updates = undeliverableUpdates(db);
    expect(updates).toHaveLength(1);
    expect(updates[0].params).toContain('inv-dead');

    warnSpy.mockRestore();
  });
});
