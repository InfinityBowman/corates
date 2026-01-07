/**
 * Centralized helpers for ProjectDoc Durable Object ID derivation
 *
 * ProjectDoc DO instances are project-scoped, using the format: `project:${projectId}`
 * This makes project transfers between orgs safe (no DO state migration needed).
 * Tenant safety is enforced via DB validation of project.orgId against URL orgId.
 */

import { createDomainError, VALIDATION_ERRORS } from '@corates/shared';

/**
 * Get the project-scoped name for a ProjectDoc DO instance
 * @param {string} projectId - Project ID
 * @returns {string} The DO instance name in format "project:${projectId}"
 */
export function getProjectDocName(projectId) {
  if (!projectId) {
    throw createDomainError(
      VALIDATION_ERRORS.FIELD_REQUIRED,
      { field: 'projectId' },
      'projectId is required for ProjectDoc DO name',
    );
  }
  return `project:${projectId}`;
}

/**
 * Get the ProjectDoc DO stub for a given project
 * @param {Object} env - Cloudflare environment with PROJECT_DOC binding
 * @param {string} projectId - Project ID
 * @returns {DurableObjectStub} The DO stub
 */
export function getProjectDocStub(env, projectId) {
  const name = getProjectDocName(projectId);
  const id = env.PROJECT_DOC.idFromName(name);
  return env.PROJECT_DOC.get(id);
}
