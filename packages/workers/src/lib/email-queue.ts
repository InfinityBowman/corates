/**
 * Email queue producer utility
 *
 * Sends email payloads to the Cloudflare Queue for async delivery.
 * The queue consumer (in index.ts) processes messages via Postmark.
 */
import { createDomainError, VALIDATION_ERRORS } from '@corates/shared';
import type { Env } from '../types';

export interface EmailPayload {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

export async function queueEmail(env: Env, payload: EmailPayload): Promise<void> {
  if (!payload?.to || !payload?.subject || (!payload?.html && !payload?.text)) {
    throw createDomainError(
      VALIDATION_ERRORS.INVALID_INPUT,
      { fields: ['to', 'subject', 'html', 'text'] },
      'Email payload requires to, subject, and html or text',
    );
  }
  await env.EMAIL_QUEUE.send(payload);
}
