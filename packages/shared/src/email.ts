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

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * ORCID sign-in falls back to `<orcid-id>@orcid.org` when no public email
 * exists; those are not mailboxes and hard-bounce.
 */
export function isSyntheticEmail(email: string): boolean {
  return /@orcid\.org$/i.test(email.trim());
}
