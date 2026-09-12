import { createDomainError, VALIDATION_ERRORS } from './errors/index.js';

export interface EmailPayload {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  // Lets the queue consumer mark the invitation row when the address is undeliverable
  invitationId?: string;
}

/**
 * What happened to the invitation email. recently_sent is a resend inside the
 * cooldown; not_sent covers a queue failure and an address that cannot take
 * mail, in both cases the in-app notification is the delivery path.
 */
export type InvitationDelivery = 'queued' | 'recently_sent' | 'not_sent';

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

// Addresses pasted from chat apps and PDFs often carry zero-width joiners or a
// BOM. They survive trim(), and Postmark then rejects the whole send, so the
// invite is silently never delivered.
const INVISIBLE_CHARS = /[\u00ad\u200b-\u200f\u2060-\u2064\ufeff]/g;

export function normalizeEmail(email: string): string {
  return email.replace(INVISIBLE_CHARS, '').trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// ORCID sign-ins without a public email get a placeholder on a reserved domain
export const SYNTHETIC_EMAIL_DOMAIN = 'orcid.placeholder.invalid';

export function makeSyntheticEmail(orcidId: string): string {
  return `${orcidId}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

export function isSyntheticEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`);
}

export type OnboardingStep = 'email' | 'profile';

// A verified real email is the account identity; providers only prove ownership
export function getOnboardingStep(user: {
  email?: string | null;
  emailVerified?: boolean | null;
  profileCompletedAt?: number | null;
}): OnboardingStep | null {
  if (!user.email || isSyntheticEmail(user.email) || !user.emailVerified) return 'email';
  if (!user.profileCompletedAt) return 'profile';
  return null;
}
