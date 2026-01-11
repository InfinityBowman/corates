/**
 * Project Store - Central store for project data
 *
 * This store holds cached project data that persists across navigation.
 * The Y.js sync engine updates this store, and UI components read from it.
 */

import { createStore, produce } from 'solid-js/store';

// Temporary in-memory storage for pending uploads during project creation
// This avoids passing non-serializable data through router state
const pendingProjectData = new Map();

// localStorage key for persisted project stats
const PROJECT_STATS_KEY = 'corates:projectStats';

/**
 * Load project stats from localStorage
 */
function loadPersistedStats() {
  try {
    const stored = localStorage.getItem(PROJECT_STATS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (err) {
    console.warn('Failed to load project stats from localStorage:', err.message);
    return {};
  }
}

/**
 * Save project stats to localStorage
 */
function persistStats(stats) {
  try {
    localStorage.setItem(PROJECT_STATS_KEY, JSON.stringify(stats));
  } catch (err) {
    console.warn('Failed to persist project stats to localStorage:', err.message);
  }
}

function createProjectStore() {
  const [store, setStore] = createStore({
    // Cached project data by projectId (Y.js data: studies, members, meta)
    projects: {},
    // Currently active project
    activeProjectId: null,
    // Connection states by projectId
    connections: {},
    // Cached project stats by projectId (computed from Yjs data)
    // { [projectId]: { studyCount, completedCount, lastUpdated } }
    // Initialized from localStorage for persistence across refreshes
    projectStats: loadPersistedStats(),
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
        if (data.studies !== undefined) {
          s.projects[projectId].studies = data.studies;
          // Auto-compute and cache stats when studies change
          const stats = computeProjectStats(data.studies);
          s.projectStats[projectId] = {
            ...stats,
            lastUpdated: Date.now(),
          };
          // Persist stats to localStorage for cross-refresh access
          persistStats(s.projectStats);
        }
      }),
    );
  }

  /**
   * Compute project stats from studies array
   * @param {Array} studies - Array of study objects
   * @returns {{ studyCount: number, completedCount: number }}
   */
  function computeProjectStats(studies) {
    const studyCount = studies?.length || 0;
    let completedCount = 0;

    if (studies) {
      for (const study of studies) {
        // A study is "completed" if it has at least one checklist with status 'completed'
        const hasCompletedChecklist = study.checklists?.some(c => c.status === 'completed');
        if (hasCompletedChecklist) {
          completedCount++;
        }
      }
    }

    return { studyCount, completedCount };
  }

  /**
   * Get cached stats for a project
   * @param {string} projectId
   * @returns {{ studyCount: number, completedCount: number, lastUpdated: number } | null}
   */
  function getProjectStats(projectId) {
    return store.projectStats[projectId] || null;
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

  /**
   * Get the score for a specific checklist (computed during sync)
   */
  function getChecklistScore(projectId, studyId, checklistId) {
    const checklist = getChecklist(projectId, studyId, checklistId);
    return checklist?.score || null;
  }

  /**
   * Get the consolidated answers for a checklist (for charts, computed during sync)
   */
  function getChecklistAnswers(projectId, studyId, checklistId) {
    const checklist = getChecklist(projectId, studyId, checklistId);
    return checklist?.consolidatedAnswers || checklist?.answers || null;
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
    getChecklistScore,
    getChecklistAnswers,
    getProjectStats,

    // Getters - PDF Data
    getStudyPdfs,
    getPrimaryPdf,
    getProtocolPdf,
    getSecondaryPdfs,
    getPdf,

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

export default projectStore;
