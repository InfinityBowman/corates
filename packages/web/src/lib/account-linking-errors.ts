/**
 * Error code mapping for account linking operations
 *
 * Better Auth returns error codes in URL params after OAuth redirect.
 * Common codes: account_already_linked_to_different_user, email_does_not_match, etc.
 */

const LINK_ERROR_MESSAGES: Record<string, string | null> = {
  // Account already linked to a different user - security safeguard
  ACCOUNT_ALREADY_LINKED:
    'That account is already linked to a different CoRATES account. Unlink it there first, or use a different account.',
  ACCOUNT_ALREADY_LINKED_TO_DIFFERENT_USER:
    'That account is already linked to a different CoRATES account. To use it here, sign in to that account and unlink it first, or use a different account.',
  ACCOUNT_NOT_LINKED:
    'Sign in with the method you used before, then connect this one under Settings > Sign-in methods.',
  // OAuth provider errors
  OAUTH_ERROR: 'Connecting to that provider did not complete. Try again.',
  OAUTH_CANCELLED: null, // Silent - user cancelled intentionally
  // Email verification errors
  EMAIL_NOT_VERIFIED: 'Verify your email with that provider, then link the account again.',
  EMAIL_DOESNT_MATCH:
    'The email on that account does not match the email on your CoRATES account. Contact support if you need to link accounts with different emails.',
  EMAIL_NOT_FOUND:
    'That provider did not return an email address. Add a verified email to your account there, then try again.',
  // Session/auth errors
  SESSION_EXPIRED: 'Your session expired. Sign in again.',
  INVALID_SESSION: 'Your session is no longer valid. Sign in again.',
  PLEASE_RESTART_THE_PROCESS: 'That sign-in attempt is no longer valid. Start again.',
  // Network/connection errors
  NETWORK_ERROR: 'Could not reach the server. Check your internet connection and try again.',
  // Provider configuration errors
  PROVIDER_NOT_FOUND: 'That sign-in provider is not set up. Contact support.',
  OAUTH_PROVIDER_NOT_FOUND: 'That sign-in provider is not available. Contact support.',
  INVALID_PROVIDER: 'That is not a sign-in provider CoRATES supports.',
  // Unlink errors
  CANNOT_UNLINK_ONLY_ACCOUNT:
    'This is your only sign-in method. Add another one before unlinking it.',
  // State errors (OAuth flow)
  STATE_MISMATCH: 'The sign-in request could not be verified. Start again.',
  STATE_NOT_FOUND: 'The sign-in request could not be found. Start again.',
  INVALID_CALLBACK_REQUEST: 'The provider sent back a response CoRATES could not use. Start again.',
  NO_CALLBACK_URL: 'Sign-in is not configured correctly for this provider. Contact support.',
  NO_CODE: 'Sign-in did not complete at the provider. Try again.',
  UNABLE_TO_GET_USER_INFO: 'Could not read your account details from that provider. Try again.',
  // Silent - the signin page shows an inline prompt with sign-up and other-method options
  SIGNUP_DISABLED: null,
  // General
  UNABLE_TO_LINK_ACCOUNT:
    'Could not link that account. Try again, or contact support if it keeps happening.',
  UNKNOWN: 'An unexpected error occurred. Try again, and contact support if it keeps happening.',
};

// Better Auth and the OAuth providers spell some of the codes above differently.
const OAUTH_CODE_ALIASES: Record<string, string> = {
  ACCESS_DENIED: 'OAUTH_CANCELLED',
  USER_CANCELLED: 'OAUTH_CANCELLED',
  ACCOUNT_EXISTS: 'ACCOUNT_ALREADY_LINKED',
  EMAIL_DOES_NOT_MATCH: 'EMAIL_DOESNT_MATCH',
};

/**
 * Get a user-friendly error message for account linking errors
 */
export function getLinkErrorMessage(code: string): string | null {
  if (code in LINK_ERROR_MESSAGES) {
    return LINK_ERROR_MESSAGES[code];
  }
  return 'An unexpected error occurred. Try again, and contact support if it keeps happening.';
}

interface ParsedOAuthError {
  code: string;
  message: string | null;
}

/**
 * Parse error from URL search params (used after OAuth redirect)
 *
 * Better Auth returns errors in URL params after OAuth callback.
 * Error codes are lowercase with underscores (e.g., account_already_linked_to_different_user)
 */
export function parseOAuthError(params: URLSearchParams): ParsedOAuthError | null {
  const error = params.get('error');
  if (!error) return null;

  // Normalize error code to uppercase with underscores (our convention)
  const normalized = error.toUpperCase().replace(/-/g, '_');
  const code = OAUTH_CODE_ALIASES[normalized] ?? normalized;

  // Message is null for silent errors (user cancelled)
  return { code, message: getLinkErrorMessage(code) };
}
