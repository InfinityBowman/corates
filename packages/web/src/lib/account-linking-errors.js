/**
 * Error code mapping for account linking operations
 *
 * Better Auth returns error codes in URL params after OAuth redirect.
 * Common codes: account_already_linked_to_different_user, email_doesn't_match, etc.
 */

export const LINK_ERROR_MESSAGES = {
  // Account already linked to a different user - security safeguard
  ACCOUNT_ALREADY_LINKED:
    'This account is already linked to another CoRATES account. Unlink it from the other account first, or use a different account.',
  ACCOUNT_ALREADY_LINKED_TO_DIFFERENT_USER:
    'This account is already linked to another CoRATES account. To use it here, sign into that account and unlink it first, or use a different account.',
  // OAuth provider errors
  OAUTH_ERROR: 'Failed to connect to the provider. Please try again.',
  OAUTH_CANCELLED: null, // Silent - user cancelled intentionally
  ACCESS_DENIED: null, // Silent - user denied permission
  USER_CANCELLED: null, // Silent - user cancelled
  // Email verification errors
  EMAIL_NOT_VERIFIED: 'Please verify your email with this provider before linking.',
  EMAIL_DOESNT_MATCH:
    'The email from this account does not match. Contact support if you need to link accounts with different emails.',
  // Session/auth errors
  SESSION_EXPIRED: 'Your session expired. Please sign in again.',
  INVALID_SESSION: 'Your session is invalid. Please sign in again.',
  // Network/connection errors
  NETWORK_ERROR: 'Connection error. Please check your internet and try again.',
  // Provider configuration errors
  PROVIDER_NOT_FOUND: 'This authentication provider is not configured.',
  OAUTH_PROVIDER_NOT_FOUND: 'This authentication provider is not available.',
  INVALID_PROVIDER: 'Invalid authentication provider.',
  // Unlink errors
  CANNOT_UNLINK_ONLY_ACCOUNT: 'Cannot unlink your only sign-in method. Link another account first.',
  // State errors (OAuth flow)
  STATE_MISMATCH: 'Authentication session expired. Please try again.',
  STATE_NOT_FOUND: 'Authentication session not found. Please try again.',
  INVALID_CALLBACK_REQUEST: 'Invalid authentication callback. Please try again.',
  // General
  UNABLE_TO_LINK_ACCOUNT: 'Unable to link this account. Please try again or contact support.',
  UNKNOWN: 'An unexpected error occurred. Please try again.',
};

/**
 * Get a user-friendly error message for account linking errors
 * @param {string} code - The error code from the API
 * @returns {string|null} The user-friendly message, or null if the error should be silent
 */
export function getLinkErrorMessage(code) {
  if (code in LINK_ERROR_MESSAGES) {
    return LINK_ERROR_MESSAGES[code];
  }
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Parse error from URL search params (used after OAuth redirect)
 *
 * Better Auth returns errors in URL params after OAuth callback.
 * Error codes are lowercase with underscores (e.g., account_already_linked_to_different_user)
 *
 * @param {URLSearchParams} params - The URL search params
 * @returns {{ code: string, message: string } | null} The parsed error or null
 */
export function parseOAuthError(params) {
  const error = params.get('error');
  if (!error) return null;

  // Normalize error code to uppercase with underscores (our convention)
  let code = error.toUpperCase().replace(/-/g, '_');

  // Map common OAuth/Better Auth error codes to our standardized codes
  const errorMappings = {
    ACCESS_DENIED: 'OAUTH_CANCELLED',
    USER_CANCELLED: 'OAUTH_CANCELLED',
    ACCOUNT_ALREADY_LINKED: 'ACCOUNT_ALREADY_LINKED',
    ACCOUNT_EXISTS: 'ACCOUNT_ALREADY_LINKED',
    ACCOUNT_ALREADY_LINKED_TO_DIFFERENT_USER: 'ACCOUNT_ALREADY_LINKED_TO_DIFFERENT_USER',
    EMAIL_DOESNT_MATCH: 'EMAIL_DOESNT_MATCH',
    STATE_MISMATCH: 'STATE_MISMATCH',
    STATE_NOT_FOUND: 'STATE_NOT_FOUND',
    INVALID_CALLBACK_REQUEST: 'INVALID_CALLBACK_REQUEST',
    OAUTH_PROVIDER_NOT_FOUND: 'OAUTH_PROVIDER_NOT_FOUND',
    UNABLE_TO_LINK_ACCOUNT: 'UNABLE_TO_LINK_ACCOUNT',
  };

  // Apply mapping if exists
  if (errorMappings[code]) {
    code = errorMappings[code];
  }

  const message = getLinkErrorMessage(code);

  // Return null message for silent errors (user cancelled)
  return {
    code,
    message,
  };
}
