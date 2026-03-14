/**
 * useOrgProjectContext - Combined org + project context for project-level routes
 *
 * Provides org context, project ID, and path builders.
 * The caller provides orgSlug and projectId from their router params.
 */

import { useMemo, useCallback } from 'react';
import { useOrgContext } from './useOrgContext';

// Path builder utilities (framework-agnostic, exported for reuse)

export function buildOrgProjectPath(orgSlug: string, projectId: string): string {
  if (!orgSlug || !projectId) return '';
  return `/orgs/${orgSlug}/projects/${projectId}`;
}

export function buildStudyPath(orgSlug: string, projectId: string, studyId: string): string {
  const basePath = buildOrgProjectPath(orgSlug, projectId);
  if (!basePath || !studyId) return '';
  return `${basePath}/studies/${studyId}`;
}

export function buildChecklistPath(orgSlug: string, projectId: string, studyId: string, checklistId: string): string {
  const studyPath = buildStudyPath(orgSlug, projectId, studyId);
  if (!studyPath || !checklistId) return '';
  return `${studyPath}/checklists/${checklistId}`;
}

export function buildReconcilePath(orgSlug: string, projectId: string, studyId: string, checklist1Id: string, checklist2Id: string): string {
  const studyPath = buildStudyPath(orgSlug, projectId, studyId);
  if (!studyPath || !checklist1Id || !checklist2Id) return '';
  return `${studyPath}/reconcile/${checklist1Id}/${checklist2Id}`;
}

/**
 * Hook that combines org context with project context
 * @param orgSlug - The org slug from URL params
 * @param projectId - The project ID from URL params
 */
export function useOrgProjectContext(orgSlug?: string | null, projectId?: string | null) {
  const orgContext = useOrgContext(orgSlug);

  const basePath = useMemo(() => {
    return buildOrgProjectPath(orgSlug || '', projectId || '');
  }, [orgSlug, projectId]);

  const projectIdMissing = !projectId;

  const isReady = !orgContext.isLoading && !orgContext.orgNotFound && !projectIdMissing;

  const getStudyPath = useCallback((studyId: string) => {
    return buildStudyPath(orgSlug || '', projectId || '', studyId);
  }, [orgSlug, projectId]);

  const getChecklistPath = useCallback((studyId: string, checklistId: string) => {
    return buildChecklistPath(orgSlug || '', projectId || '', studyId, checklistId);
  }, [orgSlug, projectId]);

  const getReconcilePath = useCallback((studyId: string, checklist1Id: string, checklist2Id: string) => {
    return buildReconcilePath(orgSlug || '', projectId || '', studyId, checklist1Id, checklist2Id);
  }, [orgSlug, projectId]);

  return {
    ...orgContext,
    projectId,
    basePath,
    projectIdMissing,
    isReady,
    getStudyPath,
    getChecklistPath,
    getReconcilePath,
  };
}
