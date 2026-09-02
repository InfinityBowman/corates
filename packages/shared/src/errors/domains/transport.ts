/**
 * Transport error codes - network/connection errors (frontend only)
 * These errors occur before/after API calls, never in API responses
 */

export const TRANSPORT_ERRORS = {
  NETWORK_ERROR: {
    code: 'TRANSPORT_NETWORK_ERROR',
    defaultMessage:
      'Unable to connect to the server. Check your internet connection and try again.',
  },
  TIMEOUT: {
    code: 'TRANSPORT_TIMEOUT',
    defaultMessage: 'The request timed out. Try again.',
  },
  CORS_ERROR: {
    code: 'TRANSPORT_CORS_ERROR',
    defaultMessage:
      'The browser blocked this request for security reasons. Contact support if it keeps happening.',
  },
} as const;

export type TransportErrorCode = (typeof TRANSPORT_ERRORS)[keyof typeof TRANSPORT_ERRORS]['code'];
