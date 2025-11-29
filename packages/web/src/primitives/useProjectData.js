/**
 * useProjectData - Lightweight hook for reading project data from store
 *
 * Use this hook when you only need to READ project data (studies, members, meta).
 * It will ensure a connection is established if one doesn't exist.
 *
 * For write operations (createStudy, updateChecklist, etc.), use useProject instead.
 */

import { createMemo, createEffect, onCleanup } from 'solid-js';
import projectStore from './projectStore.js';
import { useProject } from './useProject.js';

/**
 * Get reactive project data from the store
 * Optionally ensures a Y.js connection exists
 *
 * @param {string} projectId - The project ID
 * @param {Object} options - Options
 * @param {boolean} options.autoConnect - Whether to auto-connect if no connection exists (default: true)
 * @returns {Object} Reactive project data
 */
export function useProjectData(projectId, options = {}) {
  const { autoConnect = true } = options;

  // If autoConnect is enabled and we don't have a connection, establish one
  // This ensures the store gets populated
  let projectHook = null;
  if (autoConnect) {
    // Only create connection if we need one
    const connectionState = () => projectStore.getConnectionState(projectId);
    const needsConnection = () => !connectionState().connected && !connectionState().connecting;

    if (needsConnection()) {
      projectHook = useProject(projectId);
    }
  }

  // Return reactive getters that read from the store
  return {
    // Data getters (reactive)
    studies: () => projectStore.getStudies(projectId),
    members: () => projectStore.getMembers(projectId),
    meta: () => projectStore.getMeta(projectId),

    // Connection state (reactive)
    connected: () => projectStore.getConnectionState(projectId).connected,
    connecting: () => projectStore.getConnectionState(projectId).connecting,
    synced: () => projectStore.getConnectionState(projectId).synced,
    error: () => projectStore.getConnectionState(projectId).error,

    // Helpers
    hasData: () => projectStore.hasProject(projectId),
    getStudy: studyId => projectStore.getStudy(projectId, studyId),
    getChecklist: (studyId, checklistId) =>
      projectStore.getChecklist(projectId, studyId, checklistId),

    // If we created a connection, expose disconnect
    disconnect: projectHook?.disconnect,
  };
}

export default useProjectData;
