/**
 * What a permanent sync rejection means to the user: the close-reason slug the
 * worker's authorize hook or an admin kick sends, the message stored on the
 * connection, and the copy the project page shows in place of the project.
 */

import { PROJECT_ERRORS } from '@corates/shared';
import {
  PROJECT_DELETED_ERROR,
  PROJECT_GONE_ERROR,
  PROJECT_REMOVED_ERROR,
  PROJECT_SUPERSEDED_ERROR,
  PROJECT_UNREACHABLE_ERROR,
  SESSION_EXPIRED_ERROR,
} from '@/constants/errors';

// `not-a-member` gets the same words as a missing project so the page never
// confirms to an outsider that a project exists at this id.
const FATAL_REASON_MESSAGES: Record<string, string> = {
  'project-deleted': PROJECT_DELETED_ERROR,
  'membership-revoked': PROJECT_REMOVED_ERROR,
  'not-a-member': PROJECT_ERRORS.NOT_FOUND.defaultMessage,
  'project-not-found': PROJECT_GONE_ERROR,
  'auth-required': SESSION_EXPIRED_ERROR,
  superseded: PROJECT_SUPERSEDED_ERROR,
};

export function fatalReasonMessage(reason: string | undefined): string {
  return (reason && FATAL_REASON_MESSAGES[reason]) || PROJECT_UNREACHABLE_ERROR;
}

export interface ProjectUnavailableCopy {
  title: string;
  description: string;
}

const NO_ACCESS: ProjectUnavailableCopy = {
  title: 'Project not found',
  description:
    'It does not exist, or you do not have access to it. If someone shared this link with you, ask them to invite you.',
};

const UNAVAILABLE_COPY: Record<string, ProjectUnavailableCopy> = {
  [PROJECT_DELETED_ERROR]: {
    title: PROJECT_DELETED_ERROR,
    description: 'It was deleted while you had it open.',
  },
  [PROJECT_GONE_ERROR]: {
    title: PROJECT_GONE_ERROR,
    description: 'It has been deleted. Your projects are listed on your dashboard.',
  },
  [PROJECT_REMOVED_ERROR]: {
    title: PROJECT_REMOVED_ERROR,
    description: 'Ask a project owner to invite you again if you still need access.',
  },
  [PROJECT_ERRORS.NOT_FOUND.defaultMessage]: NO_ACCESS,
  [PROJECT_ERRORS.ACCESS_DENIED.defaultMessage]: NO_ACCESS,
  [PROJECT_UNREACHABLE_ERROR]: {
    title: 'Unable to open this project',
    description: 'It may have been deleted, or you may not have access to it.',
  },
};

/**
 * The in-page state for a connection error that takes the project away, or
 * null for a connection fault (expired session, another tab) that the gate
 * handles by sending the user back to the dashboard.
 */
export function projectUnavailableCopy(error: string): ProjectUnavailableCopy | null {
  return UNAVAILABLE_COPY[error] ?? null;
}
