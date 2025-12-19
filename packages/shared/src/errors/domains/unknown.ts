/**
 * Unknown error codes - fallback for unhandled errors
 * Used when errors cannot be properly categorized
 */

export const UNKNOWN_ERRORS = {
  PROGRAMMER_ERROR: {
    code: 'UNKNOWN_PROGRAMMER_ERROR',
    defaultMessage: 'An unexpected error occurred',
    statusCode: 500,
  },
  UNHANDLED_ERROR: {
    code: 'UNKNOWN_UNHANDLED_ERROR',
    defaultMessage: 'Something went wrong',
    statusCode: 500,
  },
  INVALID_RESPONSE: {
    code: 'UNKNOWN_INVALID_RESPONSE',
    defaultMessage: 'Invalid error response format',
    statusCode: 500,
  },
} as const;

export type UnknownErrorCode = (typeof UNKNOWN_ERRORS)[keyof typeof UNKNOWN_ERRORS]['code'];
