/**
 * Frontend error constants
 * Note: Error codes are now defined in @corates/shared package
 * This file provides frontend-specific utilities and constants
 */

import {
  getErrorMessage as getSharedErrorMessage,
  PROJECT_ERRORS,
} from '@corates/shared'

/**
 * Re-export getErrorMessage from shared package for backward compatibility
 * @param {string} errorCode - Error code
 * @returns {string} User-friendly error message
 */
export function getErrorMessage(errorCode) {
  return getSharedErrorMessage(errorCode)
}

/**
 * Error messages that indicate access to a project has been denied.
 * Used to detect when a user should be redirected away from a project view.
 * These are derived from project-related error codes and connection errors.
 */
export const ACCESS_DENIED_ERRORS = [
  'This project has been deleted',
  'You have been removed from this project',
  'You are not a member of this project',
  'Unable to connect to project. It may have been deleted or you may not have access.',
  PROJECT_ERRORS.NOT_FOUND.defaultMessage,
  PROJECT_ERRORS.ACCESS_DENIED.defaultMessage,
]
