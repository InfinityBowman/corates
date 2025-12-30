/**
 * Centralized helpers for ProjectDoc Durable Object ID derivation
 *
 * All ProjectDoc DO instances are org-scoped, using the format: `${orgId}:${projectId}`
 * This ensures complete isolation between organizations.
 */

/**
 * Get the org-scoped name for a ProjectDoc DO instance
 * @param {string} orgId - Organization ID
 * @param {string} projectId - Project ID
 * @returns {string} The DO instance name in format "orgId:projectId"
 */
export function getProjectDocName(orgId, projectId) {
  if (!orgId || !projectId) {
    throw new Error('Both orgId and projectId are required for ProjectDoc DO name');
  }
  return `${orgId}:${projectId}`;
}

/**
 * Get the ProjectDoc DO stub for a given org and project
 * @param {Object} env - Cloudflare environment with PROJECT_DOC binding
 * @param {string} orgId - Organization ID
 * @param {string} projectId - Project ID
 * @returns {DurableObjectStub} The DO stub
 */
export function getProjectDocStub(env, orgId, projectId) {
  const name = getProjectDocName(orgId, projectId);
  const id = env.PROJECT_DOC.idFromName(name);
  return env.PROJECT_DOC.get(id);
}
