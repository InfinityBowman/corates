/**
 * Study CRUD operations for useProject
 */

import * as Y from 'yjs';
import { API_BASE } from '@config/api.js';
import projectStore from '../projectStore.js';

/**
 * Creates study operations
 * @param {string} projectId - The project ID
 * @param {Function} getYDoc - Function that returns the Y.Doc
 * @param {Function} isSynced - Function that returns sync status
 * @returns {Object} Study operations
 */
export function createStudyOperations(projectId, getYDoc, isSynced) {
  /**
   * Create a new study
   * @param {string} name - Study name
   * @param {string} description - Study description
   * @param {Object} metadata - Optional metadata (firstAuthor, publicationYear, etc.)
   * @returns {string|null} The study ID or null if failed
   */
  function createStudy(name, description = '', metadata = {}) {
    const ydoc = getYDoc();
    if (!ydoc || !isSynced()) return null;

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

  /**
   * Update a study
   * @param {string} studyId - The study ID
   * @param {Object} updates - Fields to update
   */
  function updateStudy(studyId, updates) {
    const ydoc = getYDoc();
    if (!ydoc || !isSynced()) return;

    const studiesMap = ydoc.getMap('reviews');
    const studyYMap = studiesMap.get(studyId);

    if (!studyYMap) return;

    if (updates.name !== undefined) studyYMap.set('name', updates.name);
    if (updates.description !== undefined) studyYMap.set('description', updates.description);
    // Reference metadata fields
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

  /**
   * Delete a study
   * @param {string} studyId - The study ID
   */
  function deleteStudy(studyId) {
    const ydoc = getYDoc();
    if (!ydoc || !isSynced()) return;

    const studiesMap = ydoc.getMap('reviews');
    studiesMap.delete(studyId);
  }

  /**
   * Update project settings (stored in meta map)
   * @param {Object} settings - Settings to update
   */
  function updateProjectSettings(settings) {
    const ydoc = getYDoc();
    if (!ydoc || !isSynced()) return;

    const metaMap = ydoc.getMap('meta');
    for (const [key, value] of Object.entries(settings)) {
      metaMap.set(key, value);
    }
    metaMap.set('updatedAt', Date.now());
  }

  /**
   * Rename project (owner only server-side)
   * @param {string} newName - New project name
   * @returns {Promise<string>} The new name
   */
  async function renameProject(newName) {
    const trimmed = (newName || '').trim();
    if (!trimmed) {
      throw new Error('Project name is required');
    }

    const response = await fetch(`${API_BASE}/api/projects/${projectId}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    });

    if (!response.ok) {
      let message = 'Failed to rename project';
      try {
        const errorBody = await response.json();
        message = errorBody?.error || message;
      } catch (_err) {
        // ignore
      }
      throw new Error(message);
    }

    const now = Date.now();
    const ydoc = getYDoc();

    if (ydoc && isSynced()) {
      const metaMap = ydoc.getMap('meta');
      metaMap.set('name', trimmed);
      metaMap.set('updatedAt', now);
    }

    const existingMeta = projectStore.getMeta(projectId) || {};
    projectStore.setProjectData(projectId, {
      meta: { ...existingMeta, name: trimmed, updatedAt: now },
    });
    projectStore.updateProjectInList(projectId, {
      name: trimmed,
      updatedAt: new Date(now),
    });

    return trimmed;
  }

  return {
    createStudy,
    updateStudy,
    deleteStudy,
    updateProjectSettings,
    renameProject,
  };
}
