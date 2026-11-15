import { describe, it, expect } from 'vitest';
import { ACCESS_DENIED_ERRORS, RECOVERABLE_FATAL_ERRORS } from '@/constants/errors';
import { fatalReasonMessage, projectUnavailableCopy } from '../fatalReasons';

function stateFor(reason: string | undefined) {
  return projectUnavailableCopy(fatalReasonMessage(reason));
}

describe('project page state for a fatal sync close', () => {
  it('says a missing project no longer exists', () => {
    expect(stateFor('project-not-found')?.title).toBe('This project no longer exists');
  });

  it('says a project deleted mid-session has been deleted', () => {
    expect(stateFor('project-deleted')?.title).toBe('This project has been deleted');
  });

  it('tells a removed member they were removed', () => {
    expect(stateFor('membership-revoked')?.title).toBe('You have been removed from this project');
  });

  it('does not confirm the project exists to a non-member', () => {
    const copy = stateFor('not-a-member');
    expect(copy?.title).toBe('Project not found');
    expect(copy?.description).toContain('does not exist, or you do not have access');
    expect(JSON.stringify(copy)).not.toMatch(/member/i);
  });

  it('falls back to an ambiguous state for an unknown or missing reason', () => {
    expect(stateFor('something-new')?.title).toBe('Unable to open this project');
    expect(stateFor(undefined)?.title).toBe('Unable to open this project');
  });

  it('leaves connection faults to the dashboard redirect', () => {
    for (const reason of ['auth-required', 'superseded']) {
      const message = fatalReasonMessage(reason);
      expect(RECOVERABLE_FATAL_ERRORS).toContain(message);
      expect(projectUnavailableCopy(message)).toBeNull();
    }
  });

  it('has copy for every access-denied message the child views match on', () => {
    for (const error of ACCESS_DENIED_ERRORS) {
      expect(projectUnavailableCopy(error)).not.toBeNull();
    }
  });
});
