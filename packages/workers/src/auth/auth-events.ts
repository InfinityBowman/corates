/**
 * Structured auth mutation events for Better Auth handler responses.
 * Only logs a small allowlist of mutating paths — not session refresh or reads.
 */

import { info } from '../lib/logger';

/** Mask an email for log fields (never log full addresses). */
export function maskEmail(email: string): string {
  return email.replace(/^(..).*@/, '$1***@');
}

const AUTH_MUTATION_EVENTS: Record<string, string> = {
  '/api/auth/sign-out': 'auth.sign_out',
  '/api/auth/two-factor/enable': 'auth.2fa_enabled',
  '/api/auth/two-factor/disable': 'auth.2fa_disabled',
  '/api/auth/two-factor/verify-totp': 'auth.2fa_verified',
  '/api/auth/unlink-account': 'auth.account_unlinked',
};

/** Log a structured event when a Better Auth mutating handler succeeds. */
export function logAuthHandlerSuccess(pathname: string, status: number): void {
  if (status < 200 || status >= 300) return;

  const message = AUTH_MUTATION_EVENTS[pathname];
  if (message) {
    info(message);
  }
}
