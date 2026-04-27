import { createDomainError, VALIDATION_ERRORS } from './errors/index.js';

export interface EmailPayload {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
}

interface EmailQueue {
  send(payload: EmailPayload): Promise<unknown>;
}

export async function queueEmail(queue: EmailQueue, payload: EmailPayload): Promise<void> {
  if (!payload?.to || !payload?.subject || (!payload?.html && !payload?.text)) {
    throw createDomainError(
      VALIDATION_ERRORS.INVALID_INPUT,
      { fields: ['to', 'subject', 'html', 'text'] },
      'Email payload requires to, subject, and html or text',
    );
  }

  await queue.send(payload);
}
