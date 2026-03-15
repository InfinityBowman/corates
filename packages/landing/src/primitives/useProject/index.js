/**
 * useProject hook - Manages Y.js connection and operations for a single project
 *
 * React version of the SolidJS useProject hook.
 * Uses useEffect for lifecycle, Zustand for state, and the same
 * module-level connectionRegistry for ref-counted connections.
 */

import { useEffect, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import { DexieYProvider } from 'y-dexie';
import { shallow } from 'zustand/shallow';
import { useProjectStore } from '@/stores/projectStore';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import projectActionsStore from '@/stores/projectActionsStore';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { createConnectionManager } from './connection.js';
import { createSyncManager } from './sync.js';
import { createStudyOperations } from './studies.js';
import { createChecklistOperations } from './checklists/index.js';
import { createPdfOperations } from './pdfs.js';
import { createReconciliationOperations } from './reconciliation.js';
import { createAnnotationOperations } from './annotations.js';
import { createOutcomeOperations } from './outcomes.js';
import { db, deleteProjectData } from '../db.js';

const DEFAULT_CONNECTION_STATE = {
  connected: false,
  connecting: false,
  synced: false,
  error: null,
};
const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};

/**
 * Global connection registry to prevent multiple connections to the same project.
 */
const connectionRegistry = new Map();

function getOrCreateConnection(projectId) {
  if (!projectId) return null;

  if (connectionRegistry.has(projectId)) {
    const entry = connectionRegistry.get(projectId);
    entry.refCount++;
    return entry;
  }

  const entry = {
    ydoc: new Y.Doc(),
    dexieProvider: null,
    connectionManager: null,
    syncManager: null,
    studyOps: null,
    checklistOps: null,
    pdfOps: null,
    reconciliationOps: null,
    annotationOps: null,
    outcomeOps: null,
    refCount: 1,
    initialized: false,
    // Cleanup functions registered during async setup
    _cleanupHandlers: [],
  };

  connectionRegistry.set(projectId, entry);
  return entry;
}

function releaseConnection(projectId) {
  if (!projectId || !connectionRegistry.has(projectId)) return;

  const entry = connectionRegistry.get(projectId);
  entry.refCount--;

  if (entry.refCount <= 0) {
    // Run any registered cleanup handlers (Dexie update listeners, etc.)
    for (const cleanup of entry._cleanupHandlers) {
      try {
        cleanup();
      } catch (_) {
        /* ignore cleanup errors */
      }
    }
    entry._cleanupHandlers = [];

    if (entry.connectionManager) entry.connectionManager.destroy();
    if (entry.dexieProvider) DexieYProvider.release(entry.ydoc);
    if (entry.ydoc) entry.ydoc.destroy();
    connectionRegistry.delete(projectId);
    projectActionsStore._removeConnection(projectId);
    useProjectStore.getState().setConnectionState(projectId, { connected: false, synced: false });
  }
}

/**
 * Clean up all local data for a project.
 */
export async function cleanupProjectLocalData(projectId) {
  if (!projectId) return;

  if (connectionRegistry.has(projectId)) {
    const entry = connectionRegistry.get(projectId);
    for (const cleanup of entry._cleanupHandlers) {
      try {
        cleanup();
      } catch (_) {
        /* ignore */
      }
    }
    entry._cleanupHandlers = [];
    if (entry.connectionManager) entry.connectionManager.destroy();
    if (entry.dexieProvider) DexieYProvider.release(entry.ydoc);
    if (entry.ydoc) entry.ydoc.destroy();
    connectionRegistry.delete(projectId);
    projectActionsStore._removeConnection(projectId);
    useProjectStore.getState().setConnectionState(projectId, { connected: false, synced: false });
  }

  try {
    await deleteProjectData(projectId);
  } catch (err) {
    console.error('Failed to clear Dexie data for project:', projectId, err);
  }

  useProjectStore.getState().clearProject(projectId);
  queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
}

/**
 * React hook to connect to a project's Y.Doc and manage studies/checklists
 */
export function useProject(projectId) {
  const isLocalProject = projectId ? projectId.startsWith('local-') : false;
  const isOnline = useOnlineStatus();
  const connectionEntryRef = useRef(null);

  // Read connection state from Zustand with shallow comparison to avoid
  // re-renders from new fallback object references
  const connectionState = useProjectStore(
    state => state.connections[projectId] || DEFAULT_CONNECTION_STATE,
    shallow,
  );

  // Read project data reactively
  const studies = useProjectStore(state => state.projects[projectId]?.studies || EMPTY_ARRAY);
  const meta = useProjectStore(state => state.projects[projectId]?.meta || EMPTY_OBJECT);
  const members = useProjectStore(state => state.projects[projectId]?.members || EMPTY_ARRAY);

  // Connect/disconnect lifecycle
  useEffect(() => {
    if (!projectId) return;

    // Cancellation flag for async operations (handles StrictMode double-mount
    // and unmount-before-Dexie-resolves)
    let cancelled = false;

    const connectionEntry = getOrCreateConnection(projectId);
    connectionEntryRef.current = connectionEntry;

    // If already initialized, connection is shared -- just return
    if (connectionEntry.initialized) {
      return () => {
        cancelled = true;
        releaseConnection(projectId);
      };
    }

    connectionEntry.initialized = true;

    const store = useProjectStore.getState();
    store.setActiveProject(projectId);
    store.setConnectionState(projectId, { connecting: true, error: null });

    const { ydoc } = connectionEntry;
    const getYDoc = () => connectionEntry.ydoc;
    const isSynced = () => useProjectStore.getState().connections[projectId]?.synced || false;

    // Initialize sync manager and domain operations
    connectionEntry.syncManager = createSyncManager(projectId, getYDoc);
    connectionEntry.studyOps = createStudyOperations(projectId, getYDoc, isSynced);
    connectionEntry.checklistOps = createChecklistOperations(projectId, getYDoc, isSynced);
    connectionEntry.pdfOps = createPdfOperations(projectId, getYDoc, isSynced);
    connectionEntry.reconciliationOps = createReconciliationOperations(
      projectId,
      getYDoc,
      isSynced,
    );
    connectionEntry.annotationOps = createAnnotationOperations(projectId, getYDoc, isSynced);
    connectionEntry.outcomeOps = createOutcomeOperations(projectId, getYDoc, isSynced);

    // Register operations with the global action store
    projectActionsStore._setConnection(projectId, {
      createStudy: connectionEntry.studyOps.createStudy,
      updateStudy: connectionEntry.studyOps.updateStudy,
      deleteStudy: connectionEntry.studyOps.deleteStudy,
      renameProject: connectionEntry.studyOps.renameProject,
      updateDescription: connectionEntry.studyOps.updateDescription,
      updateProjectSettings: connectionEntry.studyOps.updateProjectSettings,
      createChecklist: connectionEntry.checklistOps.createChecklist,
      updateChecklist: connectionEntry.checklistOps.updateChecklist,
      deleteChecklist: connectionEntry.checklistOps.deleteChecklist,
      getChecklistAnswersMap: connectionEntry.checklistOps.getChecklistAnswersMap,
      getChecklistData: connectionEntry.checklistOps.getChecklistData,
      updateChecklistAnswer: connectionEntry.checklistOps.updateChecklistAnswer,
      getQuestionNote: connectionEntry.checklistOps.getQuestionNote,
      getRobinsText: connectionEntry.checklistOps.getRobinsText,
      getRob2Text: connectionEntry.checklistOps.getRob2Text,
      addPdfToStudy: connectionEntry.pdfOps.addPdfToStudy,
      removePdfFromStudy: connectionEntry.pdfOps.removePdfFromStudy,
      removePdfByFileName: connectionEntry.pdfOps.removePdfByFileName,
      updatePdfTag: connectionEntry.pdfOps.updatePdfTag,
      updatePdfMetadata: connectionEntry.pdfOps.updatePdfMetadata,
      setPdfAsPrimary: connectionEntry.pdfOps.setPdfAsPrimary,
      setPdfAsProtocol: connectionEntry.pdfOps.setPdfAsProtocol,
      saveReconciliationProgress: connectionEntry.reconciliationOps.saveReconciliationProgress,
      getReconciliationProgress: connectionEntry.reconciliationOps.getReconciliationProgress,
      getAllReconciliationProgress: connectionEntry.reconciliationOps.getAllReconciliationProgress,
      clearReconciliationProgress: connectionEntry.reconciliationOps.clearReconciliationProgress,
      addAnnotation: connectionEntry.annotationOps.addAnnotation,
      addAnnotations: connectionEntry.annotationOps.addAnnotations,
      updateAnnotation: connectionEntry.annotationOps.updateAnnotation,
      deleteAnnotation: connectionEntry.annotationOps.deleteAnnotation,
      getAnnotations: connectionEntry.annotationOps.getAnnotations,
      getAllAnnotationsForPdf: connectionEntry.annotationOps.getAllAnnotationsForPdf,
      clearAnnotationsForChecklist: connectionEntry.annotationOps.clearAnnotationsForChecklist,
      mergeAnnotations: connectionEntry.annotationOps.mergeAnnotations,
      getOutcomes: connectionEntry.outcomeOps.getOutcomes,
      getOutcome: connectionEntry.outcomeOps.getOutcome,
      createOutcome: connectionEntry.outcomeOps.createOutcome,
      updateOutcome: connectionEntry.outcomeOps.updateOutcome,
      deleteOutcome: connectionEntry.outcomeOps.deleteOutcome,
      isOutcomeInUse: connectionEntry.outcomeOps.isOutcomeInUse,
    });

    // Named sync handler (so it can be cleaned up)
    let isLoadingPersistedState = false;
    const syncUpdateHandler = () => {
      if (!isLoadingPersistedState) {
        connectionEntry.syncManager?.syncFromYDoc();
      }
    };
    ydoc.on('update', syncUpdateHandler);
    connectionEntry._cleanupHandlers.push(() => ydoc.off('update', syncUpdateHandler));

    // Set up Dexie persistence
    db.projects.get(projectId).then(async existingProject => {
      // Guard: if component unmounted or StrictMode re-mounted, bail out
      if (cancelled) return;

      if (!existingProject) {
        await db.projects.put({ id: projectId, updatedAt: Date.now() });
      }

      if (cancelled) return;

      const project = await db.projects.get(projectId);

      if (cancelled) return;

      connectionEntry.dexieProvider = DexieYProvider.load(project.ydoc);

      connectionEntry.dexieProvider.whenLoaded.then(() => {
        if (cancelled) return;

        isLoadingPersistedState = true;
        try {
          const persistedState = Y.encodeStateAsUpdate(project.ydoc);
          Y.applyUpdate(ydoc, persistedState);
        } catch (err) {
          console.error('Corrupted persisted state, clearing local data:', err);
          deleteProjectData(projectId).catch(() => {});
        } finally {
          isLoadingPersistedState = false;
        }

        // Named handler for Dexie write-back (registered for cleanup)
        const dexieUpdateHandler = (update, origin) => {
          if (origin !== 'dexie-sync') {
            Y.applyUpdate(project.ydoc, update, 'dexie-sync');
          }
        };
        ydoc.on('update', dexieUpdateHandler);
        connectionEntry._cleanupHandlers.push(() => ydoc.off('update', dexieUpdateHandler));

        connectionEntry.syncManager.syncFromYDoc();

        if (isLocalProject) {
          useProjectStore.getState().setConnectionState(projectId, {
            connecting: false,
            connected: true,
            synced: true,
          });
        }
      });
    });

    // For online projects, connect WebSocket
    if (!isLocalProject) {
      connectionEntry.connectionManager = createConnectionManager(projectId, ydoc, {
        onSync: () => {
          useProjectStore.getState().setConnectionState(projectId, { synced: true });
          connectionEntry.syncManager?.syncFromYDoc();
        },
        isLocalProject: () => isLocalProject,
        onAccessDenied: async () => {
          await cleanupProjectLocalData(projectId);
        },
      });
      connectionEntry.connectionManager.connect();
    }

    return () => {
      cancelled = true;
      releaseConnection(projectId);
    };
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reconnect when coming back online
  useEffect(() => {
    const cm = connectionEntryRef.current?.connectionManager;
    if (
      isOnline &&
      cm?.getShouldReconnect() &&
      !connectionState.connected &&
      !connectionState.connecting
    ) {
      cm.setShouldReconnect(false);
      cm.reconnect();
    }
  }, [isOnline, connectionState.connected, connectionState.connecting]);

  // Stable operation reference getter
  const getEntry = useCallback(() => connectionEntryRef.current, []);

  return {
    // State (reactive from Zustand)
    connected: connectionState.connected,
    connecting: connectionState.connecting,
    synced: connectionState.synced,
    error: connectionState.error,
    studies,
    meta,
    members,
    isLocalProject,

    // Study operations
    createStudy: (...args) => getEntry()?.studyOps?.createStudy(...args),
    updateStudy: (...args) => getEntry()?.studyOps?.updateStudy(...args),
    deleteStudy: (...args) => getEntry()?.studyOps?.deleteStudy(...args),
    updateProjectSettings: (...args) => getEntry()?.studyOps?.updateProjectSettings(...args),
    renameProject: (...args) => getEntry()?.studyOps?.renameProject(...args),
    updateDescription: (...args) => getEntry()?.studyOps?.updateDescription(...args),

    // Checklist operations
    createChecklist: (...args) => getEntry()?.checklistOps?.createChecklist(...args),
    updateChecklist: (...args) => getEntry()?.checklistOps?.updateChecklist(...args),
    deleteChecklist: (...args) => getEntry()?.checklistOps?.deleteChecklist(...args),
    getChecklistAnswersMap: (...args) => getEntry()?.checklistOps?.getChecklistAnswersMap(...args),
    getChecklistData: (...args) => getEntry()?.checklistOps?.getChecklistData(...args),
    updateChecklistAnswer: (...args) => getEntry()?.checklistOps?.updateChecklistAnswer(...args),
    getQuestionNote: (...args) => getEntry()?.checklistOps?.getQuestionNote(...args),
    getRobinsText: (...args) => getEntry()?.checklistOps?.getRobinsText(...args),
    getRob2Text: (...args) => getEntry()?.checklistOps?.getRob2Text(...args),

    // PDF operations
    addPdfToStudy: (...args) => getEntry()?.pdfOps?.addPdfToStudy(...args),
    removePdfFromStudy: (...args) => getEntry()?.pdfOps?.removePdfFromStudy(...args),
    removePdfByFileName: (...args) => getEntry()?.pdfOps?.removePdfByFileName(...args),
    updatePdfTag: (...args) => getEntry()?.pdfOps?.updatePdfTag(...args),
    updatePdfMetadata: (...args) => getEntry()?.pdfOps?.updatePdfMetadata(...args),
    setPdfAsPrimary: (...args) => getEntry()?.pdfOps?.setPdfAsPrimary(...args),
    setPdfAsProtocol: (...args) => getEntry()?.pdfOps?.setPdfAsProtocol(...args),

    // Reconciliation operations
    saveReconciliationProgress: (...args) =>
      getEntry()?.reconciliationOps?.saveReconciliationProgress(...args),
    getReconciliationProgress: (...args) =>
      getEntry()?.reconciliationOps?.getReconciliationProgress(...args),
    getAllReconciliationProgress: (...args) =>
      getEntry()?.reconciliationOps?.getAllReconciliationProgress(...args),
    clearReconciliationProgress: (...args) =>
      getEntry()?.reconciliationOps?.clearReconciliationProgress(...args),

    // Annotation operations
    addAnnotation: (...args) => getEntry()?.annotationOps?.addAnnotation(...args),
    addAnnotations: (...args) => getEntry()?.annotationOps?.addAnnotations(...args),
    updateAnnotation: (...args) => getEntry()?.annotationOps?.updateAnnotation(...args),
    deleteAnnotation: (...args) => getEntry()?.annotationOps?.deleteAnnotation(...args),
    getAnnotations: (...args) => getEntry()?.annotationOps?.getAnnotations(...args),
    getAllAnnotationsForPdf: (...args) =>
      getEntry()?.annotationOps?.getAllAnnotationsForPdf(...args),
    clearAnnotationsForChecklist: (...args) =>
      getEntry()?.annotationOps?.clearAnnotationsForChecklist(...args),
    mergeAnnotations: (...args) => getEntry()?.annotationOps?.mergeAnnotations(...args),

    // Outcome operations
    getOutcomes: () => getEntry()?.outcomeOps?.getOutcomes() || [],
    getOutcome: (...args) => getEntry()?.outcomeOps?.getOutcome(...args),
    createOutcome: (...args) => getEntry()?.outcomeOps?.createOutcome(...args),
    updateOutcome: (...args) => getEntry()?.outcomeOps?.updateOutcome(...args),
    deleteOutcome: (...args) => getEntry()?.outcomeOps?.deleteOutcome(...args),
    isOutcomeInUse: (...args) => getEntry()?.outcomeOps?.isOutcomeInUse(...args),

    // Connection management
    connect: () => {},
    disconnect: () => releaseConnection(projectId),

    // Awareness (for presence features)
    getAwareness: () => getEntry()?.connectionManager?.getAwareness() || null,
  };
}

export default useProject;

export {
  getOrCreateConnection as _getOrCreateConnection,
  releaseConnection as _releaseConnection,
  connectionRegistry as _connectionRegistry,
};
