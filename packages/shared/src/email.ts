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

// ORCID sign-ins without a public email get a placeholder on a reserved domain;
// older accounts carry `<orcid-id>@orcid.org`
export const SYNTHETIC_EMAIL_DOMAIN = 'orcid.placeholder.invalid';

export function makeSyntheticEmail(orcidId: string): string {
  return `${orcidId}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

export function isSyntheticEmail(email: string): boolean {
  return /@(orcid\.org|orcid\.placeholder\.invalid)$/i.test(email.trim());
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
