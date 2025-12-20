/**
 * Transport error codes - network/connection errors (frontend only)
 * These errors occur before/after API calls, never in API responses
 */

export const TRANSPORT_ERRORS = {
  NETWORK_ERROR: {
    code: 'TRANSPORT_NETWORK_ERROR',
    defaultMessage:
      'Unable to connect to the server. Please check your internet connection and try again.',
  },
  TIMEOUT: {
    code: 'TRANSPORT_TIMEOUT',
    defaultMessage: 'The request timed out. Please try again.',
  },
  CORS_ERROR: {
    code: 'TRANSPORT_CORS_ERROR',
    defaultMessage: 'Cross-origin request blocked. Please check your configuration.',
  },
} as const;

export type TransportErrorCode = (typeof TRANSPORT_ERRORS)[keyof typeof TRANSPORT_ERRORS]['code'];
