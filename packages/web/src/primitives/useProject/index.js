/**
 * useProject hook - Manages Y.js connection and operations for a single project
 *
 * This is the main coordinator that combines all the sub-modules.
 */

import { createEffect, onCleanup, createMemo } from 'solid-js';
import * as Y from 'yjs';
import { DexieYProvider } from 'y-dexie';
import projectStore from '@/stores/projectStore.js';
import { queryClient } from '@lib/queryClient.js';
import { queryKeys } from '@lib/queryKeys.js';
import projectActionsStore from '@/stores/projectActionsStore';
import useOnlineStatus from '../useOnlineStatus.js';
import { createConnectionManager } from './connection.js';
import { createSyncManager } from './sync.js';
import { createStudyOperations } from './studies.js';
import { createChecklistOperations } from './checklists/index.js';
import { createPdfOperations } from './pdfs.js';
import { createReconciliationOperations } from './reconciliation.js';
import { db, deleteProjectData } from '../db.js';

/**
 * Global connection registry to prevent multiple connections to the same project.
 * Each project ID maps to a connection instance with reference counting.
 */
const connectionRegistry = new Map();

/**
 * Get or create a shared connection for a project
 * @param {string} projectId - The project ID
 * @returns {Object|null} The shared connection entry or null if projectId is invalid
 */
function getOrCreateConnection(projectId) {
  if (!projectId) return null;

  if (connectionRegistry.has(projectId)) {
    const entry = connectionRegistry.get(projectId);
    entry.refCount++;
    return entry;
  }

  // Create new connection entry
  const entry = {
    ydoc: new Y.Doc(),
    dexieProvider: null,
    connectionManager: null,
    syncManager: null,
    studyOps: null,
    checklistOps: null,
    pdfOps: null,
    reconciliationOps: null,
    refCount: 1,
    initialized: false,
  };

  connectionRegistry.set(projectId, entry);
  return entry;
}

/**
 * Release a connection reference. Destroys the connection when refCount reaches 0.
 * @param {string} projectId - The project ID
 */
function releaseConnection(projectId) {
  if (!projectId || !connectionRegistry.has(projectId)) return;

  const entry = connectionRegistry.get(projectId);
  entry.refCount--;

  if (entry.refCount <= 0) {
    // Clean up all resources
    if (entry.connectionManager) {
      entry.connectionManager.destroy();
    }
    if (entry.dexieProvider) {
      DexieYProvider.release(entry.ydoc);
    }
    if (entry.ydoc) {
      entry.ydoc.destroy();
    }
    connectionRegistry.delete(projectId);
    projectActionsStore._removeConnection(projectId);
    projectStore.setConnectionState(projectId, { connected: false, synced: false });
  }
}

/**
 * Clean up all local data for a project.
 * Called when user is removed from a project or when project is deleted.
 * This ensures no stale data remains on the client.
 * @param {string} projectId - The project ID to clean up
 */
export async function cleanupProjectLocalData(projectId) {
  if (!projectId) return;

  // 1. Force release connection regardless of refCount (handles removal while connected)
  if (connectionRegistry.has(projectId)) {
    const entry = connectionRegistry.get(projectId);
    // Force cleanup
    if (entry.connectionManager) {
      entry.connectionManager.destroy();
    }
    if (entry.dexieProvider) {
      DexieYProvider.release(entry.ydoc);
    }
    if (entry.ydoc) {
      entry.ydoc.destroy();
    }
    connectionRegistry.delete(projectId);
    projectActionsStore._removeConnection(projectId);
    projectStore.setConnectionState(projectId, { connected: false, synced: false });
  }

  // 2. Clear from unified Dexie database (project Y.Doc, PDF cache, etc.)
  try {
    await deleteProjectData(projectId);
  } catch (err) {
    console.error('Failed to clear Dexie data for project:', projectId, err);
  }

  // 3. Clear from projectStore (in-memory cache)
  projectStore.clearProject(projectId);

  // 4. Invalidate project list query
  queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
}

/**
 * Hook to connect to a project's Y.Doc and manage studies/checklists
 * Note: Y.js map key remains 'reviews' for backward compatibility with existing data
 * @param {string} projectId - The project ID to connect to
 * @returns {Object} Project state and operations
 */
export function useProject(projectId) {
  // Check if this is a local-only project
  const isLocalProject = () => projectId && projectId.startsWith('local-');

  // Get shared connection from registry
  const connectionEntry = getOrCreateConnection(projectId);

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

  // Helper to get the current Y.Doc from the shared connection
  const getYDoc = () => connectionEntry?.ydoc || null;

  // Connect to the project's WebSocket (or just IndexedDB for local projects)
  function connect() {
    if (!projectId || !connectionEntry) return;

    // If already initialized, just return - connection is shared
    if (connectionEntry.initialized) return;

    // Mark as initializing to prevent race conditions
    connectionEntry.initialized = true;

    // Set this as the active project
    projectStore.setActiveProject(projectId);
    projectStore.setConnectionState(projectId, { connecting: true, error: null });

    const { ydoc } = connectionEntry;

    // Initialize sync manager
    connectionEntry.syncManager = createSyncManager(projectId, getYDoc);

    // Initialize domain operation modules
    connectionEntry.studyOps = createStudyOperations(projectId, getYDoc, synced);
    connectionEntry.checklistOps = createChecklistOperations(projectId, getYDoc, synced);
    connectionEntry.pdfOps = createPdfOperations(projectId, getYDoc, synced);
    connectionEntry.reconciliationOps = createReconciliationOperations(projectId, getYDoc, synced);

    // Register operations with the global action store
    projectActionsStore._setConnection(projectId, {
      // Study operations
      createStudy: connectionEntry.studyOps.createStudy,
      updateStudy: connectionEntry.studyOps.updateStudy,
      deleteStudy: connectionEntry.studyOps.deleteStudy,
      renameProject: connectionEntry.studyOps.renameProject,
      updateDescription: connectionEntry.studyOps.updateDescription,
      updateProjectSettings: connectionEntry.studyOps.updateProjectSettings,
      // Checklist operations
      createChecklist: connectionEntry.checklistOps.createChecklist,
      updateChecklist: connectionEntry.checklistOps.updateChecklist,
      deleteChecklist: connectionEntry.checklistOps.deleteChecklist,
      getChecklistAnswersMap: connectionEntry.checklistOps.getChecklistAnswersMap,
      getChecklistData: connectionEntry.checklistOps.getChecklistData,
      updateChecklistAnswer: connectionEntry.checklistOps.updateChecklistAnswer,
      getQuestionNote: connectionEntry.checklistOps.getQuestionNote,
      getRobinsText: connectionEntry.checklistOps.getRobinsText,
      getRob2Text: connectionEntry.checklistOps.getRob2Text,
      // PDF operations
      addPdfToStudy: connectionEntry.pdfOps.addPdfToStudy,
      removePdfFromStudy: connectionEntry.pdfOps.removePdfFromStudy,
      removePdfByFileName: connectionEntry.pdfOps.removePdfByFileName,
      updatePdfTag: connectionEntry.pdfOps.updatePdfTag,
      updatePdfMetadata: connectionEntry.pdfOps.updatePdfMetadata,
      setPdfAsPrimary: connectionEntry.pdfOps.setPdfAsPrimary,
      setPdfAsProtocol: connectionEntry.pdfOps.setPdfAsProtocol,
      // Reconciliation operations
      saveReconciliationProgress: connectionEntry.reconciliationOps.saveReconciliationProgress,
      getReconciliationProgress: connectionEntry.reconciliationOps.getReconciliationProgress,
      getReconciliationNote: connectionEntry.reconciliationOps.getReconciliationNote,
      clearReconciliationProgress: connectionEntry.reconciliationOps.clearReconciliationProgress,
      applyReconciliationToChecklists:
        connectionEntry.reconciliationOps.applyReconciliationToChecklists,
    });

    // Listen for Y.Doc changes BEFORE setting up providers
    // This ensures we catch all updates including initial sync
    ydoc.on('update', () => {
      connectionEntry.syncManager?.syncFromYDoc();
    });

    // Set up Dexie persistence for offline support using y-dexie
    // First ensure the project row exists in Dexie, then load the Y.Doc
    db.projects.get(projectId).then(async existingProject => {
      if (!existingProject) {
        // Create a project row if it doesn't exist
        await db.projects.put({ id: projectId, updatedAt: Date.now() });
      }

      // Get the project row (which includes the ydoc property via y-dexie)
      const project = await db.projects.get(projectId);

      // Load the Dexie Y.Doc and apply its state to our ydoc
      connectionEntry.dexieProvider = DexieYProvider.load(project.ydoc);

      connectionEntry.dexieProvider.whenLoaded.then(() => {
        // Apply persisted state from Dexie Y.Doc to our Y.Doc
        const persistedState = Y.encodeStateAsUpdate(project.ydoc);
        Y.applyUpdate(ydoc, persistedState);

        // Subscribe to our ydoc updates to persist them to Dexie
        const updateHandler = (update, origin) => {
          // Don't persist updates that came from the Dexie doc itself
          if (origin !== 'dexie-sync') {
            Y.applyUpdate(project.ydoc, update, 'dexie-sync');
          }
        };
        ydoc.on('update', updateHandler);

        // Sync UI from locally persisted data immediately
        connectionEntry.syncManager.syncFromYDoc();

        // For local projects, we're "connected" and "synced" once Dexie is loaded
        if (isLocalProject()) {
          projectStore.setConnectionState(projectId, {
            connecting: false,
            connected: true,
            synced: true,
          });
        }
        // For online projects, synced: true is set when WebSocket syncs (in onSync callback)
      });
    });

    // For local projects, don't connect to WebSocket
    if (isLocalProject()) {
      return;
    }

    // Create and connect WebSocket manager
    // onSync is called when WebSocket has synced with server
    // onAccessDenied is called when connection is rejected due to access issues
    connectionEntry.connectionManager = createConnectionManager(projectId, ydoc, {
      onSync: () => {
        // Mark as synced only after WebSocket has synced with server
        projectStore.setConnectionState(projectId, { synced: true });
        connectionEntry.syncManager?.syncFromYDoc();
      },
      isLocalProject,
      onAccessDenied: async () => {
        // Clean up all local data when access is denied
        // This handles: removed from project, project deleted, never was a member
        await cleanupProjectLocalData(projectId);
      },
    });
    connectionEntry.connectionManager.connect();
  }

  // Disconnect this instance's reference to the connection
  function disconnect() {
    releaseConnection(projectId);
  }

  // Auto-connect when projectId changes
  createEffect(() => {
    if (projectId) {
      connect();
    }
  });

  // Reconnect when coming back online
  createEffect(() => {
    const cm = connectionEntry?.connectionManager;
    if (isOnline() && cm?.getShouldReconnect() && !connected() && !connecting()) {
      cm.setShouldReconnect(false);
      cm.reconnect();
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
    createStudy: (...args) => connectionEntry?.studyOps?.createStudy(...args),
    updateStudy: (...args) => connectionEntry?.studyOps?.updateStudy(...args),
    deleteStudy: (...args) => connectionEntry?.studyOps?.deleteStudy(...args),
    updateProjectSettings: (...args) => connectionEntry?.studyOps?.updateProjectSettings(...args),
    renameProject: (...args) => connectionEntry?.studyOps?.renameProject(...args),
    updateDescription: (...args) => connectionEntry?.studyOps?.updateDescription(...args),

    // Checklist operations
    createChecklist: (...args) => connectionEntry?.checklistOps?.createChecklist(...args),
    updateChecklist: (...args) => connectionEntry?.checklistOps?.updateChecklist(...args),
    deleteChecklist: (...args) => connectionEntry?.checklistOps?.deleteChecklist(...args),
    getChecklistAnswersMap: (...args) =>
      connectionEntry?.checklistOps?.getChecklistAnswersMap(...args),
    getChecklistData: (...args) => connectionEntry?.checklistOps?.getChecklistData(...args),
    updateChecklistAnswer: (...args) =>
      connectionEntry?.checklistOps?.updateChecklistAnswer(...args),
    getQuestionNote: (...args) => connectionEntry?.checklistOps?.getQuestionNote(...args),
    getRobinsText: (...args) => connectionEntry?.checklistOps?.getRobinsText(...args),
    getRob2Text: (...args) => connectionEntry?.checklistOps?.getRob2Text(...args),

    // PDF operations
    addPdfToStudy: (...args) => connectionEntry?.pdfOps?.addPdfToStudy(...args),
    removePdfFromStudy: (...args) => connectionEntry?.pdfOps?.removePdfFromStudy(...args),
    removePdfByFileName: (...args) => connectionEntry?.pdfOps?.removePdfByFileName(...args),
    updatePdfTag: (...args) => connectionEntry?.pdfOps?.updatePdfTag(...args),
    updatePdfMetadata: (...args) => connectionEntry?.pdfOps?.updatePdfMetadata(...args),
    setPdfAsPrimary: (...args) => connectionEntry?.pdfOps?.setPdfAsPrimary(...args),
    setPdfAsProtocol: (...args) => connectionEntry?.pdfOps?.setPdfAsProtocol(...args),

    // Reconciliation operations
    saveReconciliationProgress: (...args) =>
      connectionEntry?.reconciliationOps?.saveReconciliationProgress(...args),
    getReconciliationProgress: (...args) =>
      connectionEntry?.reconciliationOps?.getReconciliationProgress(...args),
    clearReconciliationProgress: (...args) =>
      connectionEntry?.reconciliationOps?.clearReconciliationProgress(...args),

    // Connection management
    connect,
    disconnect,
  };
}

export default useProject;

// Exported for testing purposes only
export {
  getOrCreateConnection as _getOrCreateConnection,
  releaseConnection as _releaseConnection,
  connectionRegistry as _connectionRegistry,
};
