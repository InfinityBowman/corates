import { EMAIL_RETRY_CONFIG } from '../config/constants.js';
import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';

export class EmailQueue {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);

    // Handle alarm-triggered retry processing
    if (url.pathname === '/process-retry') {
      return await this.processRetryQueue();
    }

    // Accept POST with email payload {to, subject, html, text}
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const payload = await request.json();
      // Minimally validate
      if (!payload?.to || !payload?.subject || (!payload?.html && !payload?.text)) {
        return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 });
      }

      // Add to queue and process
      await this.queueEmail(payload);

      return new Response(JSON.stringify({ success: true }), { status: 202 });
    } catch (err) {
      console.error('EmailQueue error parsing request:', err);
      return new Response(JSON.stringify({ error: 'Bad request' }), { status: 400 });
    }
  }

  /**
   * Queue an email for sending with retry support
   */
  async queueEmail(payload) {
    const emailId = crypto.randomUUID();
    const emailRecord = {
      id: emailId,
      payload,
      attempts: 0,
      nextRetryAt: Date.now(),
      createdAt: Date.now(),
      status: 'pending',
    };

    // Store in queue
    await this.state.storage.put(`email:${emailId}`, emailRecord);

    // Attempt immediate send
    await this.attemptSend(emailRecord);
  }

  /**
   * Attempt to send an email with exponential backoff
   */
  async attemptSend(emailRecord) {
    const { createEmailService } = await import('../auth/email.js');
    const emailService = createEmailService(this.env);

    emailRecord.attempts++;
    emailRecord.lastAttemptAt = Date.now();

    try {
      const result = await emailService.sendEmail(emailRecord.payload);

      if (result.success) {
        console.log(
          `EmailQueue: email sent to ${emailRecord.payload.to} (attempt ${emailRecord.attempts})`,
        );
        emailRecord.status = 'sent';
        emailRecord.sentAt = Date.now();
        // Keep record for a short time for debugging, then delete
        await this.state.storage.put(`email:${emailRecord.id}`, emailRecord);
        // Schedule cleanup
        setTimeout(() => this.cleanupSentEmail(emailRecord.id), 60000);
        return true;
      } else {
        throw createDomainError(
          SYSTEM_ERRORS.INTERNAL,
          { service: 'email' },
          result.error || 'Unknown email error',
        );
      }
    } catch (err) {
      console.error(
        `EmailQueue: send failed for ${emailRecord.payload.to} (attempt ${emailRecord.attempts}):`,
        err.message,
      );

      if (emailRecord.attempts >= EMAIL_RETRY_CONFIG.MAX_RETRIES) {
        // Move to dead letter queue
        emailRecord.status = 'failed';
        emailRecord.error = err.message;
        await this.state.storage.put(`dead-letter:${emailRecord.id}`, emailRecord);
        await this.state.storage.delete(`email:${emailRecord.id}`);
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

      await this.state.storage.put(`email:${emailRecord.id}`, emailRecord);

      // Schedule retry via alarm
      await this.scheduleRetryAlarm();

      console.log(`EmailQueue: scheduled retry for ${emailRecord.payload.to} in ${delay}ms`);
      return false;
    }
  }

  /**
   * Schedule an alarm to process retry queue
   */
  async scheduleRetryAlarm() {
    const currentAlarm = await this.state.storage.getAlarm();
    if (!currentAlarm) {
      // Schedule alarm for 1 second from now to batch process
      await this.state.storage.setAlarm(Date.now() + 1000);
    }
  }

  /**
   * Process retry queue (called by alarm)
   */
  async processRetryQueue() {
    const now = Date.now();
    const emails = await this.state.storage.list({ prefix: 'email:' });

    let nextRetryTime = null;

    for (const [_key, emailRecord] of emails) {
      if (emailRecord.status === 'retry-pending' && emailRecord.nextRetryAt <= now) {
        await this.attemptSend(emailRecord);
      } else if (emailRecord.status === 'retry-pending' && emailRecord.nextRetryAt > now) {
        // Track earliest next retry
        if (!nextRetryTime || emailRecord.nextRetryAt < nextRetryTime) {
          nextRetryTime = emailRecord.nextRetryAt;
        }
      }
    }

    // Schedule next alarm if there are pending retries
    if (nextRetryTime) {
      await this.state.storage.setAlarm(nextRetryTime);
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }

  /**
   * Alarm handler for processing retries
   */
  async alarm() {
    await this.processRetryQueue();
  }

  /**
   * Clean up successfully sent email record
   */
  async cleanupSentEmail(emailId) {
    try {
      await this.state.storage.delete(`email:${emailId}`);
    } catch (err) {
      // Log but don't throw - cleanup is non-critical
      console.debug('Email cleanup failed:', emailId, err.message);
    }
  }

  /**
   * Get dead letter queue for debugging/monitoring
   */
  async getDeadLetterQueue() {
    const deadLetters = await this.state.storage.list({ prefix: 'dead-letter:' });
    return Array.from(deadLetters.values());
  }
}
