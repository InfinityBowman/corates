/**
 * useProject hook - Manages Y.js connection and operations for a single project
 *
 * This is the main coordinator that combines all the sub-modules.
 */

import { createEffect, onCleanup, createMemo } from 'solid-js';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import projectStore from '@/stores/projectStore.js';
import useOnlineStatus from '../useOnlineStatus.js';
import { createConnectionManager } from './connection.js';
import { createSyncManager } from './sync.js';
import { createStudyOperations } from './studies.js';
import { createChecklistOperations } from './checklists.js';
import { createPdfOperations } from './pdfs.js';
import { createReconciliationOperations } from './reconciliation.js';

/**
 * Hook to connect to a project's Y.Doc and manage studies/checklists
 * Note: Y.js map key remains 'reviews' for backward compatibility with existing data
 * @param {string} projectId - The project ID to connect to
 * @returns {Object} Project state and operations
 */
export function useProject(projectId) {
  // Check if this is a local-only project
  const isLocalProject = () => projectId && projectId.startsWith('local-');

  let ydoc = null;
  let indexeddbProvider = null;
  let connectionManager = null;

  const isOnline = useOnlineStatus();

  // Reactive getters from store
  const connectionState = createMemo(() => projectStore.getConnectionState(projectId));
  const connected = () => connectionState().connected;
  const connecting = () => connectionState().connecting;
  const synced = () => connectionState().synced;
  const error = () => connectionState().error;

  const projectData = createMemo(() => projectStore.getProject(projectId));
  const studies = () => projectData()?.studies || [];
  const meta = () => projectData()?.meta || {};
  const members = () => projectData()?.members || [];

  // Helper to get the current Y.Doc
  const getYDoc = () => ydoc;

  // Create sync manager
  let syncManager = null;

  // Create domain operation modules (initialized after ydoc is created)
  let studyOps = null;
  let checklistOps = null;
  let pdfOps = null;
  let reconciliationOps = null;

  // Connect to the project's WebSocket (or just IndexedDB for local projects)
  function connect() {
    if (ydoc || !projectId) return;

    // Set this as the active project
    projectStore.setActiveProject(projectId);
    projectStore.setConnectionState(projectId, { connecting: true, error: null });

    ydoc = new Y.Doc();

    // Initialize sync manager
    syncManager = createSyncManager(projectId, getYDoc);

    // Initialize domain operation modules
    studyOps = createStudyOperations(projectId, getYDoc, synced);
    checklistOps = createChecklistOperations(projectId, getYDoc, synced);
    pdfOps = createPdfOperations(projectId, getYDoc, synced);
    reconciliationOps = createReconciliationOperations(projectId, getYDoc, synced);

    // Set up IndexedDB persistence for offline support
    indexeddbProvider = new IndexeddbPersistence(`corates-project-${projectId}`, ydoc);

    indexeddbProvider.whenSynced.then(() => {
      projectStore.setConnectionState(projectId, { synced: true });
      // Sync UI from locally persisted data immediately
      syncManager.syncFromYDoc();

      // For local projects, we're "connected" once IndexedDB is synced
      if (isLocalProject()) {
        projectStore.setConnectionState(projectId, {
          connecting: false,
          connected: true,
        });
      }
    });

    // For local projects, don't connect to WebSocket
    if (isLocalProject()) {
      // Listen for local Y.Doc changes (no WebSocket sync)
      ydoc.on('update', () => {
        syncManager.syncFromYDoc();
      });
      return;
    }

    // Create and connect WebSocket manager
    connectionManager = createConnectionManager(projectId, ydoc, {
      onSync: () => syncManager.syncFromYDoc(),
      isLocalProject,
    });
    connectionManager.connect();

    // Listen for local Y.Doc changes
    ydoc.on('update', () => {
      syncManager.syncFromYDoc();
    });
  }

  // Disconnect from WebSocket
  function disconnect() {
    if (connectionManager) {
      connectionManager.destroy(); // Use destroy to clean up event listeners
      connectionManager = null;
    }
    if (indexeddbProvider) {
      indexeddbProvider.destroy();
      indexeddbProvider = null;
    }
    if (ydoc) {
      ydoc.destroy();
      ydoc = null;
    }

    syncManager = null;
    studyOps = null;
    checklistOps = null;
    pdfOps = null;
    reconciliationOps = null;

    projectStore.setConnectionState(projectId, { connected: false, synced: false });
  }

  // Auto-connect when projectId changes
  createEffect(() => {
    if (projectId) {
      connect();
    }
  });

  // Reconnect when coming back online
  createEffect(() => {
    if (isOnline() && connectionManager?.getShouldReconnect() && !connected() && !connecting()) {
      connectionManager.setShouldReconnect(false);
      connectionManager.reconnect();
    }
  });

  // Cleanup on unmount
  onCleanup(() => {
    disconnect();
  });

  return {
    // State
    connected,
    connecting,
    synced,
    error,
    studies,
    meta,
    members,
    isLocalProject,

    // Study operations
    createStudy: (...args) => studyOps?.createStudy(...args),
    updateStudy: (...args) => studyOps?.updateStudy(...args),
    deleteStudy: (...args) => studyOps?.deleteStudy(...args),
    updateProjectSettings: (...args) => studyOps?.updateProjectSettings(...args),
    renameProject: (...args) => studyOps?.renameProject(...args),
    updateDescription: (...args) => studyOps?.updateDescription(...args),

    // Checklist operations
    createChecklist: (...args) => checklistOps?.createChecklist(...args),
    updateChecklist: (...args) => checklistOps?.updateChecklist(...args),
    deleteChecklist: (...args) => checklistOps?.deleteChecklist(...args),
    getChecklistAnswersMap: (...args) => checklistOps?.getChecklistAnswersMap(...args),
    getChecklistData: (...args) => checklistOps?.getChecklistData(...args),
    updateChecklistAnswer: (...args) => checklistOps?.updateChecklistAnswer(...args),
    getQuestionNote: (...args) => checklistOps?.getQuestionNote(...args),

    // PDF operations
    addPdfToStudy: (...args) => pdfOps?.addPdfToStudy(...args),
    removePdfFromStudy: (...args) => pdfOps?.removePdfFromStudy(...args),
    removePdfByFileName: (...args) => pdfOps?.removePdfByFileName(...args),
    updatePdfTag: (...args) => pdfOps?.updatePdfTag(...args),
    updatePdfMetadata: (...args) => pdfOps?.updatePdfMetadata(...args),
    setPdfAsPrimary: (...args) => pdfOps?.setPdfAsPrimary(...args),
    setPdfAsProtocol: (...args) => pdfOps?.setPdfAsProtocol(...args),

    // Reconciliation operations
    saveReconciliationProgress: (...args) => reconciliationOps?.saveReconciliationProgress(...args),
    getReconciliationProgress: (...args) => reconciliationOps?.getReconciliationProgress(...args),
    getReconciliationNote: (...args) => reconciliationOps?.getReconciliationNote(...args),
    clearReconciliationProgress: (...args) =>
      reconciliationOps?.clearReconciliationProgress(...args),

    // Connection management
    connect,
    disconnect,
  };
}

export default useProject;
