import { createDomainError, VALIDATION_ERRORS } from '@corates/shared';
import type { Env } from '../types';

export function getProjectDocName(projectId: string): string {
  if (!projectId) {
    throw createDomainError(
      VALIDATION_ERRORS.FIELD_REQUIRED,
      { field: 'projectId' },
      'projectId is required for ProjectDoc DO name',
    );
  }
  return `project:${projectId}`;
}

export function getProjectDocStub(env: Env, projectId: string) {
  const name = getProjectDocName(projectId);
  const id = env.PROJECT_DOC.idFromName(name);
  return env.PROJECT_DOC.get(id);
}
