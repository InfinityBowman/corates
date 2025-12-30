/**
 * useOrgProjectContext - Combined org + project context for project-level routes
 *
 * Provides everything needed to work within an org-scoped project:
 * - orgId, orgSlug from URL
 * - projectId from URL
 * - Base path helper for constructing org-scoped project URLs
 * - Guard states for routing decisions
 */

import { createMemo } from 'solid-js';
import { useParams } from '@solidjs/router';
import { useOrgContext } from './useOrgContext.js';

/**
 * Build org-scoped project base path
 * @param {string} orgSlug - Organization slug
 * @param {string} projectId - Project ID
 * @returns {string} Base path like /orgs/:orgSlug/projects/:projectId
 */
export function buildOrgProjectPath(orgSlug, projectId) {
  if (!orgSlug || !projectId) return '';
  return `/orgs/${orgSlug}/projects/${projectId}`;
}

/**
 * Build org-scoped study path
 * @param {string} orgSlug - Organization slug
 * @param {string} projectId - Project ID
 * @param {string} studyId - Study ID
 * @returns {string} Path like /orgs/:orgSlug/projects/:projectId/studies/:studyId
 */
export function buildStudyPath(orgSlug, projectId, studyId) {
  const basePath = buildOrgProjectPath(orgSlug, projectId);
  if (!basePath || !studyId) return '';
  return `${basePath}/studies/${studyId}`;
}

/**
 * Build org-scoped checklist path
 * @param {string} orgSlug - Organization slug
 * @param {string} projectId - Project ID
 * @param {string} studyId - Study ID
 * @param {string} checklistId - Checklist ID
 * @returns {string} Path like /orgs/:orgSlug/projects/:projectId/studies/:studyId/checklists/:checklistId
 */
export function buildChecklistPath(orgSlug, projectId, studyId, checklistId) {
  const studyPath = buildStudyPath(orgSlug, projectId, studyId);
  if (!studyPath || !checklistId) return '';
  return `${studyPath}/checklists/${checklistId}`;
}

/**
 * Build org-scoped reconciliation path
 * @param {string} orgSlug - Organization slug
 * @param {string} projectId - Project ID
 * @param {string} studyId - Study ID
 * @param {string} checklist1Id - First checklist ID
 * @param {string} checklist2Id - Second checklist ID
 * @returns {string} Reconciliation path
 */
export function buildReconcilePath(orgSlug, projectId, studyId, checklist1Id, checklist2Id) {
  const studyPath = buildStudyPath(orgSlug, projectId, studyId);
  if (!studyPath || !checklist1Id || !checklist2Id) return '';
  return `${studyPath}/reconcile/${checklist1Id}/${checklist2Id}`;
}

/**
 * Hook that combines org context with project context from URL params
 *
 * @returns {Object} Combined org and project context
 */
export function useOrgProjectContext() {
  const params = useParams();
  const orgContext = useOrgContext();

  // Extract projectId from URL params
  const projectId = () => params.projectId || null;

  // Combined base path for the current org+project
  const basePath = createMemo(() => {
    const slug = orgContext.orgSlug();
    const pid = projectId();
    return buildOrgProjectPath(slug, pid);
  });

  // Guard: project ID is missing from URL
  const projectIdMissing = createMemo(() => !projectId());

  // Ready state: org is resolved and project ID exists
  const isReady = createMemo(() => {
    return !orgContext.isLoading() && !orgContext.orgNotFound() && !projectIdMissing();
  });

  // Path builders bound to current context
  const getStudyPath = studyId => {
    return buildStudyPath(orgContext.orgSlug(), projectId(), studyId);
  };

  const getChecklistPath = (studyId, checklistId) => {
    return buildChecklistPath(orgContext.orgSlug(), projectId(), studyId, checklistId);
  };

  const getReconcilePath = (studyId, checklist1Id, checklist2Id) => {
    return buildReconcilePath(
      orgContext.orgSlug(),
      projectId(),
      studyId,
      checklist1Id,
      checklist2Id,
    );
  };

  return {
    // From org context
    orgSlug: orgContext.orgSlug,
    orgId: orgContext.orgId,
    orgName: orgContext.orgName,
    currentOrg: orgContext.currentOrg,
    orgs: orgContext.orgs,
    isLoadingOrg: orgContext.isLoading,
    orgNotFound: orgContext.orgNotFound,
    hasNoOrgs: orgContext.hasNoOrgs,
    refetchOrgs: orgContext.refetchOrgs,

    // Project context
    projectId,
    basePath,
    projectIdMissing,

    // Combined guard states
    isReady,

    // Path builders
    getStudyPath,
    getChecklistPath,
    getReconcilePath,
  };
}

export default useOrgProjectContext;
