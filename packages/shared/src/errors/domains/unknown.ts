/**
 * Unknown error codes - fallback for unhandled errors
 * Used when errors cannot be properly categorized
 */

export const UNKNOWN_ERRORS = {
  PROGRAMMER_ERROR: {
    code: 'UNKNOWN_PROGRAMMER_ERROR',
    defaultMessage:
      'An unexpected error occurred. Try again, and contact support if it keeps happening.',
    statusCode: 500,
  },
  UNHANDLED_ERROR: {
    code: 'UNKNOWN_UNHANDLED_ERROR',
    defaultMessage: 'Something went wrong. Try again, and contact support if it keeps happening.',
    statusCode: 500,
  },
  INVALID_RESPONSE: {
    code: 'UNKNOWN_INVALID_RESPONSE',
    defaultMessage: 'The server sent a response CoRATES could not read. Try again.',
    statusCode: 500,
  },
} as const;

export type UnknownErrorCode = (typeof UNKNOWN_ERRORS)[keyof typeof UNKNOWN_ERRORS]['code'];
