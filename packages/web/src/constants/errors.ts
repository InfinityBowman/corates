/**
 * Frontend error constants
 * Note: Error codes are now defined in @corates/shared package
 * This file provides frontend-specific utilities and constants
 */

import { PROJECT_ERRORS } from '@corates/shared';

export const PROJECT_DELETED_ERROR = 'This project has been deleted';
export const PROJECT_GONE_ERROR = 'This project no longer exists';
export const PROJECT_REMOVED_ERROR = 'You have been removed from this project';
export const PROJECT_UNREACHABLE_ERROR =
  'Unable to connect to project. It may have been deleted or you may not have access.';

/**
 * Error messages that indicate access to a project has been denied.
 * The project page shows these in place of the project (see fatalReasons).
 */
export const ACCESS_DENIED_ERRORS: string[] = [
  PROJECT_DELETED_ERROR,
  PROJECT_GONE_ERROR,
  PROJECT_REMOVED_ERROR,
  PROJECT_UNREACHABLE_ERROR,
  PROJECT_ERRORS.NOT_FOUND.defaultMessage,
  PROJECT_ERRORS.ACCESS_DENIED.defaultMessage,
];

export const SESSION_EXPIRED_ERROR = 'Your session has expired. Sign in again to reconnect.';
export const PROJECT_SUPERSEDED_ERROR = 'This project was opened in another tab or window.';

/**
 * Connection faults that end the session without taking away access. The
 * project cannot render until the user reconnects, but their cached rows and
 * queued mutations are still theirs -- kept apart from ACCESS_DENIED_ERRORS so
 * neither the message nor the cleanup treats a dropped socket as a revocation.
 */
export const RECOVERABLE_FATAL_ERRORS: string[] = [SESSION_EXPIRED_ERROR, PROJECT_SUPERSEDED_ERROR];
