import { DurableObject } from 'cloudflare:workers';
import { EMAIL_RETRY_CONFIG } from '../config/constants';
import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';
import type { Env } from '../types';

export interface EmailPayload {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

interface EmailRecord {
  id: string;
  payload: EmailPayload;
  attempts: number;
  nextRetryAt: number;
  createdAt: number;
  status: 'pending' | 'sent' | 'retry-pending' | 'failed';
  lastAttemptAt?: number;
  sentAt?: number;
  error?: string;
}

export class EmailQueue extends DurableObject<Env> {
  /**
   * Queue an email for sending with retry support (RPC method)
   */
  async queueEmail(payload: EmailPayload): Promise<void> {
    if (!payload?.to || !payload?.subject || (!payload?.html && !payload?.text)) {
      throw new Error('Invalid email payload: to, subject, and html or text are required');
    }

    const emailId = crypto.randomUUID();
    const emailRecord: EmailRecord = {
      id: emailId,
      payload,
      attempts: 0,
      nextRetryAt: Date.now(),
      createdAt: Date.now(),
      status: 'pending',
    };

    await this.ctx.storage.put(`email:${emailId}`, emailRecord);
    await this.attemptSend(emailRecord);
  }

  /**
   * Attempt to send an email with exponential backoff
   */
  async attemptSend(emailRecord: EmailRecord): Promise<boolean> {
    const { createEmailService } = await import('../auth/email');
    const emailService = createEmailService(this.env);

    emailRecord.attempts++;
    emailRecord.lastAttemptAt = Date.now();

    try {
      const result = await emailService.sendEmail(
        emailRecord.payload as Parameters<typeof emailService.sendEmail>[0],
      );

      if (result.success) {
        console.log(
          `EmailQueue: email sent to ${emailRecord.payload.to} (attempt ${emailRecord.attempts})`,
        );
        // Delete immediately after successful send instead of using setTimeout
        await this.ctx.storage.delete(`email:${emailRecord.id}`);
        return true;
      } else {
        throw createDomainError(
          SYSTEM_ERRORS.INTERNAL_ERROR,
          { service: 'email' },
          result.error || 'Unknown email error',
        );
      }
    } catch (err) {
      const error = err as Error;
      console.error(
        `EmailQueue: send failed for ${emailRecord.payload.to} (attempt ${emailRecord.attempts}):`,
        error.message,
      );

      if (emailRecord.attempts >= EMAIL_RETRY_CONFIG.MAX_RETRIES) {
        emailRecord.status = 'failed';
        emailRecord.error = error.message;
        await this.ctx.storage.put(`dead-letter:${emailRecord.id}`, emailRecord);
        await this.ctx.storage.delete(`email:${emailRecord.id}`);
        console.error(`EmailQueue: moved to dead letter queue: ${emailRecord.payload.to}`);
        return false;
      }

      // Calculate next retry time with exponential backoff
      const delay = Math.min(
        EMAIL_RETRY_CONFIG.BASE_DELAY_MS *
          Math.pow(EMAIL_RETRY_CONFIG.BACKOFF_MULTIPLIER, emailRecord.attempts - 1),
        EMAIL_RETRY_CONFIG.MAX_DELAY_MS,
      );
      emailRecord.nextRetryAt = Date.now() + delay;
      emailRecord.status = 'retry-pending';

      await this.ctx.storage.put(`email:${emailRecord.id}`, emailRecord);

      await this.scheduleRetryAlarm();

      console.log(`EmailQueue: scheduled retry for ${emailRecord.payload.to} in ${delay}ms`);
      return false;
    }
  }

  /**
   * Schedule an alarm to process retry queue
   */
  async scheduleRetryAlarm(): Promise<void> {
    const currentAlarm = await this.ctx.storage.getAlarm();
    if (!currentAlarm) {
      await this.ctx.storage.setAlarm(Date.now() + 1000);
    }
  }

  /**
   * Process retry queue (called by alarm)
   */
  async processRetryQueue(): Promise<void> {
    const now = Date.now();
    const emails = await this.ctx.storage.list<EmailRecord>({ prefix: 'email:' });

    let nextRetryTime: number | null = null;

    for (const [_key, emailRecord] of emails) {
      if (emailRecord.status === 'retry-pending' && emailRecord.nextRetryAt <= now) {
        await this.attemptSend(emailRecord);
      } else if (emailRecord.status === 'retry-pending' && emailRecord.nextRetryAt > now) {
        if (!nextRetryTime || emailRecord.nextRetryAt < nextRetryTime) {
          nextRetryTime = emailRecord.nextRetryAt;
        }
      }
    }

    if (nextRetryTime) {
      await this.ctx.storage.setAlarm(nextRetryTime);
    }
  }

  /**
   * Alarm handler for processing retries
   */
  async alarm(): Promise<void> {
    await this.processRetryQueue();
  }

  /**
   * Get dead letter queue for debugging/monitoring (RPC method)
   */
  async getDeadLetterQueue(): Promise<EmailRecord[]> {
    const deadLetters = await this.ctx.storage.list<EmailRecord>({ prefix: 'dead-letter:' });
    return Array.from(deadLetters.values());
  }
}
