/**
 * Study CRUD operations for useProject
 */

import * as Y from 'yjs';
import { useProjectStore } from '@/stores/projectStore';
import { connectionPool } from '@/project/ConnectionPool';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { updateProject } from '@/server/functions/org-projects.functions';

export interface StudyMetadata {
  originalTitle?: string;
  firstAuthor?: string;
  publicationYear?: string;
  authors?: string;
  journal?: string;
  doi?: string;
  abstract?: string;
  importSource?: string;
  pdfUrl?: string;
  pdfSource?: string;
  pdfAccessible?: boolean;
  pmid?: string;
  url?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  type?: string;
}

export interface StudyUpdates extends StudyMetadata {
  name?: string;
  description?: string;
  reviewer1?: string;
  reviewer2?: string;
}

export interface StudyOperations {
  createStudy: (name: string, description?: string, metadata?: StudyMetadata) => string | null;
  updateStudy: (studyId: string, updates: StudyUpdates) => void;
  deleteStudy: (studyId: string) => void;
  updateProjectSettings: (settings: Record<string, unknown>) => void;
  renameProject: (newName: string) => Promise<string>;
  updateDescription: (newDescription: string) => Promise<string>;
}

/**
 * Creates study operations
 */
export function createStudyOperations(
  projectId: string,
  getYDoc: () => Y.Doc | null,
  isSynced: () => boolean,
): StudyOperations {
  function createStudy(
    name: string,
    description: string = '',
    metadata: StudyMetadata = {},
  ): string | null {
    const ydoc = getYDoc();
    if (!ydoc) return null;

    const studyId = crypto.randomUUID();
    const now = Date.now();

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = new Y.Map();

    studyYMap.set('name', name);
    studyYMap.set('description', description);
    studyYMap.set('createdAt', now);
    studyYMap.set('updatedAt', now);
    studyYMap.set('checklists', new Y.Map());

    // Set optional reference metadata fields
    if (metadata.originalTitle) studyYMap.set('originalTitle', metadata.originalTitle);
    if (metadata.firstAuthor) studyYMap.set('firstAuthor', metadata.firstAuthor);
    if (metadata.publicationYear) studyYMap.set('publicationYear', metadata.publicationYear);
    if (metadata.authors) studyYMap.set('authors', metadata.authors);
    if (metadata.journal) studyYMap.set('journal', metadata.journal);
    if (metadata.doi) studyYMap.set('doi', metadata.doi);
    if (metadata.abstract) studyYMap.set('abstract', metadata.abstract);
    if (metadata.importSource) studyYMap.set('importSource', metadata.importSource);
    if (metadata.pdfUrl) studyYMap.set('pdfUrl', metadata.pdfUrl);
    if (metadata.pdfSource) studyYMap.set('pdfSource', metadata.pdfSource);
    if (metadata.pdfAccessible !== undefined)
      studyYMap.set('pdfAccessible', Boolean(metadata.pdfAccessible));
    if (metadata.pmid) studyYMap.set('pmid', metadata.pmid);
    if (metadata.url) studyYMap.set('url', metadata.url);
    if (metadata.volume) studyYMap.set('volume', metadata.volume);
    if (metadata.issue) studyYMap.set('issue', metadata.issue);
    if (metadata.pages) studyYMap.set('pages', metadata.pages);
    if (metadata.type) studyYMap.set('type', metadata.type);

    studiesMap.set(studyId, studyYMap);

    return studyId;
  }

  function updateStudy(studyId: string, updates: StudyUpdates): void {
    const ydoc = getYDoc();
    if (!ydoc) return;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId) as Y.Map<unknown> | undefined;

    if (!studyYMap) return;

    if (updates.name !== undefined) studyYMap.set('name', updates.name);
    if (updates.description !== undefined) studyYMap.set('description', updates.description);
    // Reference metadata fields
    if (updates.originalTitle !== undefined) studyYMap.set('originalTitle', updates.originalTitle);
    if (updates.firstAuthor !== undefined) studyYMap.set('firstAuthor', updates.firstAuthor);
    if (updates.publicationYear !== undefined)
      studyYMap.set('publicationYear', updates.publicationYear);
    if (updates.authors !== undefined) studyYMap.set('authors', updates.authors);
    if (updates.journal !== undefined) studyYMap.set('journal', updates.journal);
    if (updates.doi !== undefined) studyYMap.set('doi', updates.doi);
    if (updates.abstract !== undefined) studyYMap.set('abstract', updates.abstract);
    if (updates.importSource !== undefined) studyYMap.set('importSource', updates.importSource);
    if (updates.pdfUrl !== undefined) studyYMap.set('pdfUrl', updates.pdfUrl);
    if (updates.pdfSource !== undefined) studyYMap.set('pdfSource', updates.pdfSource);
    if (updates.pdfAccessible !== undefined)
      studyYMap.set('pdfAccessible', Boolean(updates.pdfAccessible));
    if (updates.pmid !== undefined) studyYMap.set('pmid', updates.pmid);
    if (updates.url !== undefined) studyYMap.set('url', updates.url);
    if (updates.volume !== undefined) studyYMap.set('volume', updates.volume);
    if (updates.issue !== undefined) studyYMap.set('issue', updates.issue);
    if (updates.pages !== undefined) studyYMap.set('pages', updates.pages);
    if (updates.type !== undefined) studyYMap.set('type', updates.type);
    // Reviewer assignment fields
    if (updates.reviewer1 !== undefined) studyYMap.set('reviewer1', updates.reviewer1);
    if (updates.reviewer2 !== undefined) studyYMap.set('reviewer2', updates.reviewer2);
    studyYMap.set('updatedAt', Date.now());
  }

  function deleteStudy(studyId: string): void {
    const ydoc = getYDoc();
    if (!ydoc) return;

    const studiesMap = ydoc.getMap('reviews');
    studiesMap.delete(studyId);
  }

  function updateProjectSettings(settings: Record<string, unknown>): void {
    const ydoc = getYDoc();
    if (!ydoc) return;

    const metaMap = ydoc.getMap('meta');
    for (const [key, value] of Object.entries(settings)) {
      metaMap.set(key, value);
    }
    metaMap.set('updatedAt', Date.now());
  }

  async function renameProject(newName: string): Promise<string> {
    const trimmed = (newName || '').trim();
    if (!trimmed) {
      throw new Error('Project name is required');
    }

    const orgId = connectionPool.getActiveOrgId();
    if (!orgId) {
      throw new Error('No active organization');
    }

    await updateProject({ data: { orgId, projectId, name: trimmed } });

    const now = Date.now();
    const ydoc = getYDoc();

    if (ydoc && isSynced()) {
      const metaMap = ydoc.getMap('meta');
      metaMap.set('name', trimmed);
      metaMap.set('updatedAt', now);
    }

    const existingMeta = useProjectStore.getState().projects[projectId]?.meta || {};
    useProjectStore.getState().setProjectData(projectId, {
      meta: { ...existingMeta, name: trimmed, updatedAt: now },
    });
    // Invalidate project list query to refetch with updated name
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });

    return trimmed;
  }

  async function updateDescription(newDescription: string): Promise<string> {
    const trimmed = (newDescription || '').trim();

    const orgId = connectionPool.getActiveOrgId();
    if (!orgId) {
      throw new Error('No active organization');
    }

    await updateProject({ data: { orgId, projectId, description: trimmed || undefined } });

    const now = Date.now();
    const ydoc = getYDoc();

    if (ydoc && isSynced()) {
      const metaMap = ydoc.getMap('meta');
      metaMap.set('description', trimmed || null);
      metaMap.set('updatedAt', now);
    }

    const existingMeta = useProjectStore.getState().projects[projectId]?.meta || {};
    useProjectStore.getState().setProjectData(projectId, {
      meta: { ...existingMeta, description: trimmed || null, updatedAt: now },
    });
    // Invalidate project list query to refetch with updated description
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });

    return trimmed;
  }

  return {
    createStudy,
    updateStudy,
    deleteStudy,
    updateProjectSettings,
    renameProject,
    updateDescription,
  };
}
