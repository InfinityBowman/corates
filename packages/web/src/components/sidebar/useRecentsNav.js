import { createSignal, createEffect, onMount } from 'solid-js';
import { useLocation } from '@solidjs/router';

const RECENTS_STORAGE_KEY = 'corates-recents';
const MAX_RECENTS = 6;

/**
 * Tracks recently visited pages and provides a list of recent items.
 * Only tracks project/study/checklist pages (not generic pages like dashboard).
 */
export default function useRecentsNav() {
  const location = useLocation();
  const [recents, setRecents] = createSignal([]);

  // Load recents from localStorage on mount
  onMount(() => {
    try {
      const stored = localStorage.getItem(RECENTS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRecents(parsed.slice(0, MAX_RECENTS));
        }
      }
    } catch (err) {
      console.warn('Failed to parse recents from localStorage:', err.message);
    }
  });

  // Track navigation and add to recents
  createEffect(() => {
    const path = location.pathname;
    const item = parsePathToRecentItem(path);
    if (!item) return;

    setRecents(prev => {
      // Remove existing entry for same path
      const filtered = prev.filter(r => r.path !== item.path);
      // Add to front
      const updated = [item, ...filtered].slice(0, MAX_RECENTS);
      // Persist to localStorage
      try {
        localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(updated));
      } catch (err) {
        console.warn('Failed to persist recents to localStorage:', err.message);
      }
      return updated;
    });
  });

  return { recents };
}

/**
 * Parses a path into a recent item if it's a trackable page.
 * Returns null for generic pages that shouldn't be tracked.
 */
function parsePathToRecentItem(path) {
  // Match project pages: /projects/:projectId
  const projectMatch = path.match(/^\/projects\/([^/]+)/);
  if (projectMatch) {
    const [, projectId] = projectMatch;
    // Check if it's a study page: /projects/:projectId/studies/:studyId
    const studyMatch = path.match(/^\/projects\/([^/]+)\/studies\/([^/]+)/);
    if (studyMatch) {
      const [, , studyId] = studyMatch;
      // Check if it's a checklist page
      const checklistMatch = path.match(
        /^\/projects\/([^/]+)\/studies\/([^/]+)\/checklists\/([^/]+)/,
      );
      if (checklistMatch) {
        return {
          type: 'checklist',
          path,
          projectId,
          studyId,
          checklistId: checklistMatch[3],
        };
      }
      return {
        type: 'study',
        path,
        projectId,
        studyId,
      };
    }
    return {
      type: 'project',
      path,
      projectId,
    };
  }

  // Legacy: Match old org-scoped paths for backward compatibility
  const legacyProjectMatch = path.match(/^\/orgs\/([^/]+)\/projects\/([^/]+)/);
  if (legacyProjectMatch) {
    const [, _orgSlug, projectId] = legacyProjectMatch;
    // Check if it's a study page: /orgs/:slug/projects/:projectId/studies/:studyId
    const studyMatch = path.match(/^\/orgs\/([^/]+)\/projects\/([^/]+)\/studies\/([^/]+)/);
    if (studyMatch) {
      const [, , , studyId] = studyMatch;
      // Check if it's a checklist page
      const checklistMatch = path.match(
        /^\/orgs\/([^/]+)\/projects\/([^/]+)\/studies\/([^/]+)\/checklists\/([^/]+)/,
      );
      if (checklistMatch) {
        // Convert to new project-scoped path
        return {
          type: 'checklist',
          path: `/projects/${projectId}/studies/${studyId}/checklists/${checklistMatch[4]}`,
          projectId,
          studyId,
          checklistId: checklistMatch[4],
        };
      }
      // Convert to new project-scoped path
      return {
        type: 'study',
        path: `/projects/${projectId}/studies/${studyId}`,
        projectId,
        studyId,
      };
    }
    // Convert to new project-scoped path
    return {
      type: 'project',
      path: `/projects/${projectId}`,
      projectId,
    };
  }

  // Match local checklist pages: /checklist/:id
  const localChecklistMatch = path.match(/^\/checklist\/([^/]+)$/);
  if (localChecklistMatch) {
    return {
      type: 'local-checklist',
      path,
      checklistId: localChecklistMatch[1],
    };
  }

  // Not a trackable page
  return null;
}
