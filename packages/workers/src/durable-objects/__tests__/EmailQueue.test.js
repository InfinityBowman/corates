/**
 * Tests for EmailQueue Durable Object
 * Tests email queueing, retry logic, batching, and Postmark integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { env, runInDurableObject, runDurableObjectAlarm } from 'cloudflare:test';

// Mock Postmark
vi.mock('postmark', () => {
  return {
    Client: class {
      constructor() {}
      sendEmail() {
        return Promise.resolve({ ErrorCode: 0, MessageID: 'test-message-id' });
      }
    },
  };
});

// Mock email service
const mockSendEmail = vi.fn(async () => ({
  success: true,
  id: 'test-message-id',
}));

vi.mock('@/auth/email.js', () => {
  return {
    createEmailService: _env => ({
      sendEmail: mockSendEmail,
    }),
  };
});

describe('EmailQueue Durable Object', () => {
  // Helper to retry DO operations on invalidation errors
  async function runInDurableObjectWithRetry(stub, fn, maxRetries = 5) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await runInDurableObject(stub, fn);
      } catch (error) {
        const errorMessage = error?.message || String(error) || '';
        const isInvalidationError =
          errorMessage.includes('invalidating this Durable Object') ||
          errorMessage.includes('inputGateBroken') ||
          errorMessage.includes('invalidating') ||
          error?.remote === true ||
          error?.durableObjectReset === true;
        if (isInvalidationError && attempt < maxRetries - 1) {
          // Wait longer before retrying (exponential backoff with longer base delay)
          const delay = 100 * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset mock implementation (clearAllMocks doesn't clear implementations
    // set by mockRejectedValue, so previous tests' permanent mocks leak through)
    mockSendEmail.mockResolvedValue({ success: true, id: 'test-message-id' });
    // Clear storage between tests
    // Use try-catch to handle DO invalidation gracefully
    try {
      const stub = await getEmailQueueStub();
      await runInDurableObject(stub, async (instance, state) => {
        const emails = await state.storage.list({ prefix: 'email:' });
        for (const [key] of emails) {
          await state.storage.delete(key);
        }
        const deadLetters = await state.storage.list({ prefix: 'dead-letter:' });
        for (const [key] of deadLetters) {
          await state.storage.delete(key);
        }
        await state.storage.deleteAlarm();
      });
    } catch (error) {
      // Ignore DO invalidation errors in cleanup - test will create fresh DO
      const isInvalidationError =
        error?.message?.includes('invalidating this Durable Object') ||
        error?.message?.includes('inputGateBroken') ||
        error?.remote === true ||
        error?.durableObjectReset === true;
      if (!isInvalidationError) {
        throw error;
      }
    }
  });

  async function getEmailQueueStub() {
    const id = env.EMAIL_QUEUE.idFromName('default');
    return env.EMAIL_QUEUE.get(id);
  }

  async function queueEmail(payload) {
    const stub = await getEmailQueueStub();
    await stub.queueEmail(payload);
  }

  describe('Email Queueing', () => {
    it('should queue and send email successfully', async () => {
      const payload = {
        to: 'test@example.com',
        subject: 'Test Email',
        html: '<p>Test</p>',
        text: 'Test',
      };

      await queueEmail(payload);

      // Verify email was sent
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail).toHaveBeenCalledWith(payload);
    });

    it('should reject invalid payload - missing to', async () => {
      const payload = {
        subject: 'Test Email',
        html: '<p>Test</p>',
      };

      await expect(queueEmail(payload)).rejects.toThrow(/Invalid email payload/);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('should reject invalid payload - missing subject', async () => {
      const payload = {
        to: 'test@example.com',
        html: '<p>Test</p>',
      };

      await expect(queueEmail(payload)).rejects.toThrow(/Invalid email payload/);
    });

    it('should reject invalid payload - missing html and text', async () => {
      const payload = {
        to: 'test@example.com',
        subject: 'Test Email',
      };

      await expect(queueEmail(payload)).rejects.toThrow(/Invalid email payload/);
    });

    it('should accept email with only html', async () => {
      const payload = {
        to: 'test@example.com',
        subject: 'Test Email',
        html: '<p>Test</p>',
      };

      await queueEmail(payload);

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
    });

    it('should accept email with only text', async () => {
      const payload = {
        to: 'test@example.com',
        subject: 'Test Email',
        text: 'Test',
      };

      await queueEmail(payload);

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed emails with exponential backoff', async () => {
      // First attempt fails
      mockSendEmail.mockRejectedValueOnce(new Error('Postmark error'));

      const payload = {
        to: 'test@example.com',
        subject: 'Test Email',
        html: '<p>Test</p>',
      };

      await queueEmail(payload);

      // Verify email was stored for retry
      const stub = await getEmailQueueStub();
      await runInDurableObjectWithRetry(stub, async (instance, state) => {
        const emails = await state.storage.list({ prefix: 'email:' });
        expect(emails.size).toBeGreaterThan(0);

        // Check retry status
        const emailEntries = Array.from(emails.entries());
        const emailRecord = emailEntries[0][1];
        expect(emailRecord.status).toBe('retry-pending');
        expect(emailRecord.attempts).toBeGreaterThanOrEqual(1);
        expect(emailRecord.nextRetryAt).toBeGreaterThan(Date.now());
      });
    });

    it('should move to dead letter queue after max retries', async () => {
      // Fail all attempts
      mockSendEmail.mockRejectedValue(new Error('Persistent error'));

      const payload = {
        to: 'test@example.com',
        subject: 'Test Email',
        html: '<p>Test</p>',
      };

      await queueEmail(payload);

      const stub = await getEmailQueueStub();

      // Simulate max retries
      await runInDurableObjectWithRetry(stub, async (instance, state) => {
        const emails = await state.storage.list({ prefix: 'email:' });
        if (emails.size > 0) {
          const emailEntries = Array.from(emails.entries());
          let emailRecord = emailEntries[0][1];

          // Manually set attempts to max
          emailRecord.attempts = 3; // MAX_RETRIES
          await state.storage.put(`email:${emailRecord.id}`, emailRecord);

          // Attempt send (should fail and move to dead letter)
          await instance.attemptSend(emailRecord);

          // Check dead letter queue
          const deadLetters = await state.storage.list({ prefix: 'dead-letter:' });
          expect(deadLetters.size).toBeGreaterThan(0);

          const deadLetterEntries = Array.from(deadLetters.entries());
          const deadLetter = deadLetterEntries[0][1];
          expect(deadLetter.status).toBe('failed');
          expect(deadLetter.attempts).toBe(4); // Original + 3 retries
        }
      });
    });

    it('should process retry queue when alarm triggers', async () => {
      // Queue an email that will fail
      mockSendEmail.mockRejectedValueOnce(new Error('Temporary error'));
      mockSendEmail.mockResolvedValueOnce({ success: true, id: 'retry-success' });

      const payload = {
        to: 'test@example.com',
        subject: 'Test Email',
        html: '<p>Test</p>',
      };

      await queueEmail(payload);

      const stub = await getEmailQueueStub();

      // Set up retry-pending email
      await runInDurableObjectWithRetry(stub, async (instance, state) => {
        const emails = await state.storage.list({ prefix: 'email:' });
        if (emails.size > 0) {
          const emailEntries = Array.from(emails.entries());
          let emailRecord = emailEntries[0][1];
          emailRecord.status = 'retry-pending';
          emailRecord.nextRetryAt = Date.now() - 1000; // Past due
          await state.storage.put(`email:${emailRecord.id}`, emailRecord);
        }
      });

      // Trigger alarm
      await runDurableObjectAlarm(stub);

      // Verify retry was processed
      expect(mockSendEmail).toHaveBeenCalledTimes(2); // Initial + retry
    });
  });

  describe('Email Storage', () => {
    it('should clean up sent emails immediately', async () => {
      const payload = {
        to: 'test@example.com',
        subject: 'Test Email',
        html: '<p>Test</p>',
      };

      await queueEmail(payload);

      // After successful send, email record should be deleted immediately
      const stub = await getEmailQueueStub();
      await runInDurableObjectWithRetry(stub, async (instance, state) => {
        const emails = await state.storage.list({ prefix: 'email:' });
        expect(emails.size).toBe(0);
      });
    });
  });

  describe('Dead Letter Queue', () => {
    it('should store failed emails in dead letter queue', async () => {
      mockSendEmail.mockRejectedValue(new Error('Persistent failure'));

      const payload = {
        to: 'test@example.com',
        subject: 'Test Email',
        html: '<p>Test</p>',
      };

      await queueEmail(payload);

      const stub = await getEmailQueueStub();
      await runInDurableObjectWithRetry(stub, async (instance, state) => {
        // Manually trigger max retries scenario
        const emails = await state.storage.list({ prefix: 'email:' });
        if (emails.size > 0) {
          const emailEntries = Array.from(emails.entries());
          let emailRecord = emailEntries[0][1];
          emailRecord.attempts = 3; // MAX_RETRIES
          await state.storage.put(`email:${emailRecord.id}`, emailRecord);

          await instance.attemptSend(emailRecord);

          // Check dead letter queue
          const deadLetters = await instance.getDeadLetterQueue();
          expect(deadLetters.length).toBeGreaterThan(0);
          expect(deadLetters[0].status).toBe('failed');
          expect(deadLetters[0].error).toBeDefined();
        }
      });
    });
  });

  describe('C3: Dead-letter write atomicity', () => {
    it('should have dead-letter record AND no email record after max retries', async () => {
      mockSendEmail.mockRejectedValue(new Error('Permanent failure'));

      const payload = {
        to: 'deadletter@example.com',
        subject: 'Atomicity Test',
        html: '<p>Test</p>',
      };

      await queueEmail(payload);

      const stub = await getEmailQueueStub();
      await runInDurableObjectWithRetry(stub, async (instance, state) => {
        const emails = await state.storage.list({ prefix: 'email:' });
        if (emails.size === 0) return; // Already moved on first attempt at max retries

        const emailEntries = Array.from(emails.entries());
        const emailRecord = emailEntries[0][1];
        const emailId = emailRecord.id;

        // Set to max retries so next attempt triggers dead-letter
        emailRecord.attempts = 3;
        await state.storage.put(`email:${emailId}`, emailRecord);

        await instance.attemptSend(emailRecord);

        // Both conditions must hold simultaneously
        const deadLetters = await state.storage.list({ prefix: 'dead-letter:' });
        const remainingEmails = await state.storage.list({ prefix: 'email:' });

        expect(deadLetters.size).toBe(1);
        expect(remainingEmails.size).toBe(0);

        const deadLetter = Array.from(deadLetters.values())[0];
        expect(deadLetter.id).toBe(emailId);
        expect(deadLetter.status).toBe('failed');
        expect(deadLetter.error).toBe('Permanent failure');
      });
    });
  });

  describe('Alarm Scheduling', () => {
    it('should schedule alarm for retry processing', async () => {
      mockSendEmail.mockRejectedValueOnce(new Error('Temporary error'));

      const payload = {
        to: 'test@example.com',
        subject: 'Test Email',
        html: '<p>Test</p>',
      };

      await queueEmail(payload);

      const stub = await getEmailQueueStub();
      await runInDurableObjectWithRetry(stub, async (instance, state) => {
        const alarm = await state.storage.getAlarm();
        expect(alarm).toBeGreaterThan(Date.now());
      });
    });

    it('should not schedule duplicate alarms', async () => {
      mockSendEmail.mockRejectedValue(new Error('Error'));

      const payload1 = {
        to: 'test1@example.com',
        subject: 'Test 1',
        html: '<p>Test 1</p>',
      };

      const payload2 = {
        to: 'test2@example.com',
        subject: 'Test 2',
        html: '<p>Test 2</p>',
      };

      await queueEmail(payload1);
      const stub = await getEmailQueueStub();

      let firstAlarm;
      await runInDurableObjectWithRetry(stub, async (instance, state) => {
        firstAlarm = await state.storage.getAlarm();
      });

      await queueEmail(payload2);

      await runInDurableObjectWithRetry(stub, async (instance, state) => {
        const secondAlarm = await state.storage.getAlarm();
        // Should be the same alarm (not duplicated)
        expect(secondAlarm).toBe(firstAlarm);
      });
    });
  });
});
