/**
 * Project Store - Central store for project data
 *
 * This store holds cached project data that persists across navigation.
 * The Y.js sync engine updates this store, and UI components read from it.
 */

import { createStore, produce } from 'solid-js/store';
import { API_BASE } from '@config/api.js';

// LocalStorage keys for offline caching
const PROJECT_LIST_CACHE_KEY = 'corates-project-list-cache';
const PROJECT_LIST_CACHE_TIMESTAMP_KEY = 'corates-project-list-cache-timestamp';
const PROJECT_LIST_CACHE_USER_ID_KEY = 'corates-project-list-cache-user-id';
const PROJECT_LIST_CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

// Temporary in-memory storage for pending uploads during project creation
// This avoids passing non-serializable data through router state
const pendingProjectData = new Map();

// Callback for cleaning up local data when a project is no longer accessible
// Set by useProject module to avoid circular dependency
let onStaleProjectCleanup = null;

function createProjectStore() {
  // Load cached project list from localStorage
  function loadCachedProjectList() {
    if (typeof window === 'undefined') return null;
    try {
      const cached = localStorage.getItem(PROJECT_LIST_CACHE_KEY);
      const timestamp = localStorage.getItem(PROJECT_LIST_CACHE_TIMESTAMP_KEY);
      const cachedUserId = localStorage.getItem(PROJECT_LIST_CACHE_USER_ID_KEY);
      if (!cached || !timestamp) return null;

      const age = Date.now() - parseInt(timestamp, 10);
      if (age > PROJECT_LIST_CACHE_MAX_AGE) {
        // Cache expired, clear it
        localStorage.removeItem(PROJECT_LIST_CACHE_KEY);
        localStorage.removeItem(PROJECT_LIST_CACHE_TIMESTAMP_KEY);
        localStorage.removeItem(PROJECT_LIST_CACHE_USER_ID_KEY);
        return null;
      }

      return { projects: JSON.parse(cached), userId: cachedUserId };
    } catch (err) {
      console.error('Error loading cached project list:', err);
      return null;
    }
  }

  // Save project list to localStorage
  function saveCachedProjectList(projects, userId) {
    if (typeof window === 'undefined') return;
    try {
      if (projects && Array.isArray(projects) && userId) {
        localStorage.setItem(PROJECT_LIST_CACHE_KEY, JSON.stringify(projects));
        localStorage.setItem(PROJECT_LIST_CACHE_TIMESTAMP_KEY, Date.now().toString());
        localStorage.setItem(PROJECT_LIST_CACHE_USER_ID_KEY, userId);
      } else {
        localStorage.removeItem(PROJECT_LIST_CACHE_KEY);
        localStorage.removeItem(PROJECT_LIST_CACHE_TIMESTAMP_KEY);
        localStorage.removeItem(PROJECT_LIST_CACHE_USER_ID_KEY);
      }
    } catch (err) {
      console.error('Error saving cached project list:', err);
    }
  }

  // Initialize with cached data if available
  const cachedData = loadCachedProjectList();
  const initialProjectList =
    cachedData?.projects ?
      {
        items: cachedData.projects,
        loaded: false, // Don't mark as loaded - we'll check userId and fetch if needed
        loading: false,
        error: null,
        cachedUserId: cachedData.userId, // Track which user this cache belongs to
      }
    : {
        items: [],
        loaded: false,
        loading: false,
        error: null,
        cachedUserId: null,
      };

  const [store, setStore] = createStore({
    // Cached project data by projectId (Y.js data: studies, members, meta)
    projects: {},
    // Currently active project
    activeProjectId: null,
    // Connection states by projectId
    connections: {},
    // Project list from API (for dashboard)
    projectList: initialProjectList,
  });

  /**
   * Get project data (returns undefined if not cached)
   */
  function getProject(projectId) {
    return store.projects[projectId];
  }

  /**
   * Get active project data
   */
  function getActiveProject() {
    if (!store.activeProjectId) return null;
    return store.projects[store.activeProjectId] || null;
  }

  /**
   * Set the active project
   */
  function setActiveProject(projectId) {
    setStore('activeProjectId', projectId);
  }

  /**
   * Initialize or update project data
   */
  function setProjectData(projectId, data) {
    setStore(
      produce(s => {
        if (!s.projects[projectId]) {
          s.projects[projectId] = {
            meta: {},
            members: [],
            studies: [],
          };
        }
        if (data.meta !== undefined) s.projects[projectId].meta = data.meta;
        if (data.members !== undefined) s.projects[projectId].members = data.members;
        if (data.studies !== undefined) s.projects[projectId].studies = data.studies;
      }),
    );
  }

  /**
   * Update connection state for a project
   */
  function setConnectionState(projectId, state) {
    setStore(
      produce(s => {
        if (!s.connections[projectId]) {
          s.connections[projectId] = {
            connected: false,
            connecting: false,
            synced: false,
            error: null,
          };
        }
        Object.assign(s.connections[projectId], state);
      }),
    );
  }

  /**
   * Get connection state for a project
   */
  function getConnectionState(projectId) {
    return (
      store.connections[projectId] || {
        connected: false,
        connecting: false,
        synced: false,
        error: null,
      }
    );
  }

  /**
   * Clear project from cache
   */
  function clearProject(projectId) {
    setStore(
      produce(s => {
        delete s.projects[projectId];
        delete s.connections[projectId];
        if (s.activeProjectId === projectId) {
          s.activeProjectId = null;
        }
      }),
    );
  }

  /**
   * Check if project data is cached
   */
  function hasProject(projectId) {
    return !!store.projects[projectId];
  }

  /**
   * Get studies for a project
   */
  function getStudies(projectId) {
    return store.projects[projectId]?.studies || [];
  }

  /**
   * Get members for a project
   */
  function getMembers(projectId) {
    return store.projects[projectId]?.members || [];
  }

  /**
   * Get meta for a project
   */
  function getMeta(projectId) {
    return store.projects[projectId]?.meta || {};
  }

  /**
   * Find a specific study within a project
   */
  function getStudy(projectId, studyId) {
    const studies = store.projects[projectId]?.studies;
    if (!studies) return null;
    return studies.find(s => s.id === studyId) || null;
  }

  /**
   * Find a specific checklist within a study
   */
  function getChecklist(projectId, studyId, checklistId) {
    const study = getStudy(projectId, studyId);
    if (!study?.checklists) return null;
    return study.checklists.find(c => c.id === checklistId) || null;
  }

  // ============ PDF Selectors ============

  /**
   * Get all PDFs for a study
   */
  function getStudyPdfs(projectId, studyId) {
    const study = getStudy(projectId, studyId);
    return study?.pdfs || [];
  }

  /**
   * Get primary PDF for a study
   */
  function getPrimaryPdf(projectId, studyId) {
    const pdfs = getStudyPdfs(projectId, studyId);
    return pdfs.find(pdf => pdf.tag === 'primary') || null;
  }

  /**
   * Get protocol PDF for a study
   */
  function getProtocolPdf(projectId, studyId) {
    const pdfs = getStudyPdfs(projectId, studyId);
    return pdfs.find(pdf => pdf.tag === 'protocol') || null;
  }

  /**
   * Get secondary PDFs for a study
   */
  function getSecondaryPdfs(projectId, studyId) {
    const pdfs = getStudyPdfs(projectId, studyId);
    return pdfs.filter(pdf => pdf.tag === 'secondary' || !pdf.tag);
  }

  /**
   * Get a specific PDF by ID
   */
  function getPdf(projectId, studyId, pdfId) {
    const pdfs = getStudyPdfs(projectId, studyId);
    return pdfs.find(pdf => pdf.id === pdfId) || null;
  }

  // ============ Project List (Dashboard) ============

  /**
   * Get the project list
   */
  function getProjectList() {
    return store.projectList.items;
  }

  /**
   * Check if project list is loaded
   */
  function isProjectListLoaded() {
    return store.projectList.loaded;
  }

  /**
   * Check if project list is loading
   */
  function isProjectListLoading() {
    return store.projectList.loading;
  }

  /**
   * Add a project to the list
   */
  function addProjectToList(project) {
    setStore(
      produce(s => {
        s.projectList.items.push(project);
      }),
    );
    // Update cache (preserve userId)
    saveCachedProjectList(store.projectList.items, store.projectList.cachedUserId);
  }

  /**
   * Update a project in the list
   */
  function updateProjectInList(projectId, updates) {
    setStore(
      produce(s => {
        const index = s.projectList.items.findIndex(p => p.id === projectId);
        if (index !== -1) {
          Object.assign(s.projectList.items[index], updates);
        }
      }),
    );
    // Update cache (preserve userId)
    saveCachedProjectList(store.projectList.items, store.projectList.cachedUserId);
  }

  /**
   * Remove a project from the list
   */
  function removeProjectFromList(projectId) {
    setStore(
      produce(s => {
        s.projectList.items = s.projectList.items.filter(p => p.id !== projectId);
      }),
    );
    // Update cache (preserve userId)
    saveCachedProjectList(store.projectList.items, store.projectList.cachedUserId);
  }

  /**
   * Clear the project list (e.g., on logout)
   */
  function clearProjectList() {
    setStore('projectList', {
      items: [],
      loaded: false,
      loading: false,
      error: null,
      cachedUserId: null,
    });
    // Clear cached data
    saveCachedProjectList(null, null);
  }

  /**
   * Get project list error
   */
  function getProjectListError() {
    return store.projectList.error;
  }

  /**
   * Fetch projects from API for a user
   * Returns early if already loaded or loading
   * Falls back to cached data when offline
   */
  async function fetchProjectList(userId, options = {}) {
    const { force = false } = options;

    // Check if cached data belongs to a different user - if so, force refresh and clear cache
    const cachedUserId = store.projectList.cachedUserId;
    const shouldForceRefresh = force || (cachedUserId && cachedUserId !== userId);

    // If userId changed, clear the cached items
    if (cachedUserId && cachedUserId !== userId) {
      setStore('projectList', {
        items: [],
        loaded: false,
        cachedUserId: null,
      });
    }

    // Skip if already loaded and userId matches (unless forcing refresh)
    if (!shouldForceRefresh && store.projectList.loaded && cachedUserId === userId) {
      return store.projectList.items;
    }

    // Skip if already loading
    if (store.projectList.loading) {
      return null;
    }

    if (!userId) {
      return [];
    }

    // Check if we're offline - if so, try to use cached data (only if it's for the same user)
    const isOnline = navigator.onLine;
    if (!isOnline) {
      const cached = loadCachedProjectList();
      if (cached?.projects && cached.userId === userId) {
        setStore('projectList', {
          items: cached.projects,
          loaded: true,
          loading: false,
          error: null,
          cachedUserId: userId,
        });
        return cached.projects;
      }
      // No cached data available offline
      setStore('projectList', {
        loading: false,
        error: 'No internet connection and no cached data available',
      });
      return null;
    }

    setStore('projectList', { loading: true, error: null });

    try {
      const response = await fetch(`${API_BASE}/api/users/${userId}/projects`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }

      const projects = await response.json();

      // Reconcile: clean up local data for projects no longer in the server list
      // This handles cases where user was removed or project was deleted while offline
      const serverProjectIds = new Set(projects.map(p => p.id));
      const cachedProjectIds = Object.keys(store.projects);

      for (const cachedId of cachedProjectIds) {
        if (!serverProjectIds.has(cachedId) && onStaleProjectCleanup) {
          // User no longer has access to this project - clean up local data
          // Run async but don't block the fetch
          onStaleProjectCleanup(cachedId).catch(err => {
            console.error('Failed to clean up stale project:', cachedId, err);
          });
        }
      }

      setStore('projectList', {
        items: projects,
        loaded: true,
        loading: false,
        error: null,
        cachedUserId: userId,
      });

      // Save to cache for offline access
      saveCachedProjectList(projects, userId);

      return projects;
    } catch (err) {
      console.error('Error fetching projects:', err);

      // If fetch failed, try to use cached data as fallback (only if it's for the same user)
      const cached = loadCachedProjectList();
      if (cached?.projects && cached.userId === userId) {
        setStore('projectList', {
          items: cached.projects,
          loaded: true,
          loading: false,
          error: 'Using cached data - connection error',
          cachedUserId: userId,
        });
        return cached.projects;
      }

      setStore('projectList', {
        loading: false,
        error: err.message,
      });
      return null;
    }
  }

  /**
   * Refresh the project list (force re-fetch)
   */
  function refreshProjectList(userId) {
    return fetchProjectList(userId, { force: true });
  }

  /**
   * Temporarily store pending project data during creation
   * This avoids passing non-serializable data through router state
   */
  function setPendingProjectData(projectId, data) {
    pendingProjectData.set(projectId, data);
  }

  /**
   * Retrieve and clear pending project data
   */
  function getPendingProjectData(projectId) {
    const data = pendingProjectData.get(projectId);
    if (data) {
      pendingProjectData.delete(projectId); // Clean up after retrieval
    }
    return data;
  }

  return {
    // Raw store for reactive access
    store,

    // Getters - Project Data (Y.js)
    getProject,
    getActiveProject,
    getConnectionState,
    hasProject,
    getStudies,
    getMembers,
    getMeta,
    getStudy,
    getChecklist,

    // Getters - PDF Data
    getStudyPdfs,
    getPrimaryPdf,
    getProtocolPdf,
    getSecondaryPdfs,
    getPdf,

    // Getters - Project List (Dashboard)
    getProjectList,
    isProjectListLoaded,
    isProjectListLoading,
    getProjectListError,

    // Actions - Project List (Dashboard)
    fetchProjectList,
    refreshProjectList,
    addProjectToList,
    updateProjectInList,
    removeProjectFromList,
    clearProjectList,

    // Temporary storage for project creation
    setPendingProjectData,
    getPendingProjectData,

    // Setters - Project Data (Y.js)
    setActiveProject,
    setProjectData,
    setConnectionState,
    clearProject,
  };
}

// Create singleton store without createRoot
// createStore doesn't need a reactive owner/root context
const projectStore = createProjectStore();

/**
 * Register a callback for cleaning up stale project local data.
 * This is called by useProject module to avoid circular dependency.
 * @param {Function} callback - Async function that takes projectId and cleans up local data
 */
export function registerStaleProjectCleanup(callback) {
  onStaleProjectCleanup = callback;
}

export default projectStore;
