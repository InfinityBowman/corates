/**
 * Error parsing and handling utilities
 * Uses the shared error system from @corates/shared
 * Separates domain errors (from API) from transport errors (network issues)
 */

import {
  validateErrorResponse,
  normalizeError,
  isDomainError,
  isTransportError,
  AUTH_ERRORS,
  USER_ERRORS,
  type DomainError,
  type TransportError,
} from '@corates/shared';
import { DetailedError } from 'hono/client';
import { showToast } from '@/components/ui/toast';

/**
 * User-friendly error messages for common error codes
 */
const USER_FRIENDLY_MESSAGES: Record<string, string> = {
  // Auth errors
  AUTH_REQUIRED: 'Please sign in to continue',
  AUTH_INVALID: 'Invalid email or password',
  AUTH_EXPIRED: 'Your session has expired. Please sign in again.',
  AUTH_FORBIDDEN: "You don't have permission to do that",

  // Validation errors
  VALIDATION_FIELD_REQUIRED: 'Please fill in all required fields',
  VALIDATION_FIELD_INVALID_FORMAT: 'Please check the format of your input',
  VALIDATION_FIELD_TOO_LONG: 'The value entered is too long',
  VALIDATION_FIELD_TOO_SHORT: 'The value entered is too short',
  VALIDATION_MULTI_FIELD: 'Please fix the errors in the form',
  VALIDATION_FAILED: 'Please check your input and try again',
  VALIDATION_INVALID_INPUT: 'Please check your input and try again',

  // Project errors
  PROJECT_NOT_FOUND: 'This project could not be found',
  PROJECT_NOT_IN_ORG: "This project isn't in your organization",
  PROJECT_ACCESS_DENIED: "You don't have access to this project",
  PROJECT_MEMBER_ALREADY_EXISTS: 'This user is already a project member',
  PROJECT_LAST_OWNER: 'Projects must have at least one owner',
  PROJECT_INVALID_ROLE: 'Please select a valid role',
  PROJECT_INVITATION_ALREADY_ACCEPTED: 'This invitation has already been accepted',

  // File errors
  FILE_TOO_LARGE: 'This file is too large. Please choose a smaller file.',
  FILE_INVALID_TYPE: 'This file type is not supported',
  FILE_NOT_FOUND: 'The file could not be found',
  FILE_UPLOAD_FAILED: 'Upload failed. Please try again.',
  FILE_ALREADY_EXISTS: 'A file with this name already exists',

  // User errors
  USER_NOT_FOUND: 'User not found',
  USER_EMAIL_NOT_VERIFIED: 'Please verify your email address to continue',

  // System errors
  SYSTEM_DB_ERROR: 'Something went wrong. Please try again.',
  SYSTEM_DB_TRANSACTION_FAILED: 'Something went wrong. Please try again.',
  SYSTEM_EMAIL_SEND_FAILED: 'Unable to send email. Please try again later.',
  SYSTEM_EMAIL_INVALID: 'Please enter a valid email address',
  SYSTEM_RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
  SYSTEM_INTERNAL_ERROR: 'Something went wrong. Please try again.',
  SYSTEM_SERVICE_UNAVAILABLE: 'Service temporarily unavailable. Please try again later.',

  // Transport errors
  TRANSPORT_NETWORK_ERROR: 'Unable to connect. Please check your internet connection.',
  TRANSPORT_TIMEOUT: 'Request timed out. Please try again.',
  TRANSPORT_CORS_ERROR: 'Connection blocked. Please try again.',

  // Unknown errors
  UNKNOWN_ERROR: 'Something went wrong. Please try again.',
  UNKNOWN_INVALID_RESPONSE: 'Something went wrong. Please try again.',
};

type AppError = DomainError | TransportError;

interface ErrorHandlingOptions {
  setError?: (_message: string) => void;
  showToast?: boolean;
  toastTitle?: string;
  onError?: (_error: AppError) => void;
  navigate?: (_opts: { to: string; replace?: boolean }) => void;
}

export function getUserFriendlyMessage(error: AppError): string {
  if (error.code && USER_FRIENDLY_MESSAGES[error.code]) {
    return USER_FRIENDLY_MESSAGES[error.code];
  }
  if (error.message) {
    if (/^[A-Z][A-Z0-9_]+$/.test(error.message)) {
      return 'Something went wrong. Please try again.';
    }
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}

export async function parseApiError(response: Response): Promise<DomainError> {
  try {
    const data = await response.json();
    return validateErrorResponse(data);
  } catch {
    return {
      code: 'UNKNOWN_INVALID_RESPONSE',
      message: 'Invalid error response format',
      statusCode: response.status || 500,
      timestamp: new Date().toISOString(),
    } as DomainError;
  }
}

export async function handleFetchError(
  fetchPromise: Promise<Response>,
  options: ErrorHandlingOptions = {},
): Promise<Response> {
  try {
    const response = await fetchPromise;

    if (!response.ok) {
      const domainError = await parseApiError(response);
      await handleDomainError(domainError, options);
      throw domainError;
    }

    return response;
  } catch (error) {
    if (isDomainError(error)) {
      throw error;
    }

    const normalizedError = normalizeError(error);

    if (isTransportError(normalizedError)) {
      await handleTransportError(normalizedError, options);
      throw normalizedError;
    } else if (isDomainError(normalizedError)) {
      await handleDomainError(normalizedError, options);
      throw normalizedError;
    } else {
      await handleTransportError(normalizedError as TransportError, options);
      throw normalizedError;
    }
  }
}

export async function handleDomainError(
  error: DomainError,
  options: ErrorHandlingOptions = {},
): Promise<void> {
  const { setError, showToast: showToastOption = true, toastTitle, onError, navigate } = options;

  if (onError) {
    onError(error);
  }

  if (navigate) {
    if (error.code === AUTH_ERRORS.REQUIRED.code || error.code === AUTH_ERRORS.EXPIRED.code) {
      navigate({ to: '/signin', replace: true });
      return;
    }
    if (error.code === USER_ERRORS.EMAIL_NOT_VERIFIED.code) {
      navigate({ to: '/check-email', replace: true });
      return;
    }
  }

  const friendlyMessage = getUserFriendlyMessage(error);

  if (setError) {
    setError(friendlyMessage);
  }

  if (showToastOption) {
    const title = toastTitle || friendlyMessage;
    const details = error.details && typeof error.details === 'string' ? error.details : '';
    showToast.error(title, details);
  }
}

export async function handleTransportError(
  error: TransportError,
  options: ErrorHandlingOptions = {},
): Promise<void> {
  const { setError, showToast: showToastOption = true, toastTitle, onError } = options;

  if (onError) {
    onError(error);
  }

  const friendlyMessage = getUserFriendlyMessage(error);

  if (setError) {
    setError(friendlyMessage);
  }

  if (showToastOption) {
    const title = toastTitle || 'Connection Error';
    showToast.error(title, friendlyMessage);
  }
}

export async function handleError(
  error: unknown,
  options: ErrorHandlingOptions = {},
): Promise<AppError> {
  if (isDomainError(error)) {
    await handleDomainError(error, options);
    return error;
  }

  if (isTransportError(error)) {
    await handleTransportError(error, options);
    return error;
  }

  if (error instanceof Response) {
    const domainError = await parseApiError(error);
    await handleDomainError(domainError, options);
    return domainError;
  }

  const normalizedError = normalizeError(error);
  if (isTransportError(normalizedError)) {
    await handleTransportError(normalizedError, options);
  } else {
    await handleDomainError(normalizedError as DomainError, options);
  }

  return normalizedError;
}

export function parseError(error: unknown): AppError {
  return normalizeError(error);
}

export function isErrorCode(error: AppError | null | undefined, code: string): boolean {
  return error?.code === code;
}

/**
 * Extract a DomainError from either a DetailedError (thrown by parseResponse)
 * or a raw DomainError. Returns null if the error is neither.
 */
export function getDomainError(error: unknown): DomainError | null {
  if (error instanceof DetailedError && error.detail?.data?.code) {
    return error.detail.data as DomainError;
  }
  if (isDomainError(error)) {
    return error;
  }
  return null;
}
