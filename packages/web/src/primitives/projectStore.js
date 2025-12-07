/**
 * Project Store - Central store for project data
 *
 * This store holds cached project data that persists across navigation.
 * The Y.js sync engine updates this store, and UI components read from it.
 */

import { createStore, produce } from 'solid-js/store';
import { API_BASE } from '@config/api.js';

function createProjectStore() {
  const [store, setStore] = createStore({
    // Cached project data by projectId (Y.js data: studies, members, meta)
    projects: {},
    // Currently active project
    activeProjectId: null,
    // Connection states by projectId
    connections: {},
    // Project list from API (for dashboard)
    projectList: {
      items: [],
      loaded: false,
      loading: false,
      error: null,
    },
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
    });
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
   */
  async function fetchProjectList(userId, options = {}) {
    const { force = false } = options;

    // Skip if already loaded (unless forcing refresh)
    if (!force && store.projectList.loaded) {
      return store.projectList.items;
    }

    // Skip if already loading
    if (store.projectList.loading) {
      return null;
    }

    if (!userId) {
      return [];
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
      setStore('projectList', {
        items: projects,
        loaded: true,
        loading: false,
        error: null,
      });

      return projects;
    } catch (err) {
      console.error('Error fetching projects:', err);
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

export default projectStore;
