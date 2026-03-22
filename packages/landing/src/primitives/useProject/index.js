import { useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { shallow } from 'zustand/shallow';
import { useProjectStore } from '@/stores/projectStore';
import { phaseToLegacy } from '@/project/connectionReducer';
import { connectionPool } from '@/project/ConnectionPool';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

const DEFAULT_CONNECTION_STATE = { phase: 'idle', error: null };
const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};

export function useProject(projectId) {
  const isLocalProject = projectId ? projectId.startsWith('local-') : false;
  const isOnline = useOnlineStatus();
  const connectionEntryRef = useRef(null);

  const connectionState = useProjectStore(
    state => state.connections[projectId] || DEFAULT_CONNECTION_STATE,
    shallow,
  );
  const studies = useProjectStore(state => state.projects[projectId]?.studies || EMPTY_ARRAY);
  const meta = useProjectStore(state => state.projects[projectId]?.meta || EMPTY_OBJECT);
  const members = useProjectStore(state => state.projects[projectId]?.members || EMPTY_ARRAY);

  useLayoutEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    const entry = connectionPool.acquire(projectId);
    connectionEntryRef.current = entry;

    if (entry && !entry.initialized) {
      connectionPool.initializeConnection(projectId, entry, {
        isLocal: isLocalProject,
        cancelled: () => cancelled,
      });
    }

    return () => {
      cancelled = true;
      connectionPool.release(projectId);
    };
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reconnect on online transition
  const wasOnlineRef = useRef(isOnline);
  useEffect(() => {
    const wasOffline = !wasOnlineRef.current;
    wasOnlineRef.current = isOnline;
    if (isOnline && wasOffline) {
      connectionPool.reconnectIfNeeded(projectId);
    }
  }, [isOnline, projectId]);

  const getEntry = useCallback(() => connectionEntryRef.current, []);
  const legacyState = phaseToLegacy(connectionState);

  return {
    connected: legacyState.connected,
    connecting: legacyState.connecting,
    synced: legacyState.synced,
    error: legacyState.error,
    studies,
    meta,
    members,
    isLocalProject,

    // Operations via lazy getters
    createStudy: (...args) => getEntry()?.studyOps?.createStudy(...args),
    updateStudy: (...args) => getEntry()?.studyOps?.updateStudy(...args),
    deleteStudy: (...args) => getEntry()?.studyOps?.deleteStudy(...args),
    updateProjectSettings: (...args) => getEntry()?.studyOps?.updateProjectSettings(...args),
    renameProject: (...args) => getEntry()?.studyOps?.renameProject(...args),
    updateDescription: (...args) => getEntry()?.studyOps?.updateDescription(...args),

    createChecklist: (...args) => getEntry()?.checklistOps?.createChecklist(...args),
    updateChecklist: (...args) => getEntry()?.checklistOps?.updateChecklist(...args),
    deleteChecklist: (...args) => getEntry()?.checklistOps?.deleteChecklist(...args),
    getChecklistAnswersMap: (...args) => getEntry()?.checklistOps?.getChecklistAnswersMap(...args),
    getChecklistData: (...args) => getEntry()?.checklistOps?.getChecklistData(...args),
    updateChecklistAnswer: (...args) => getEntry()?.checklistOps?.updateChecklistAnswer(...args),
    getQuestionNote: (...args) => getEntry()?.checklistOps?.getQuestionNote(...args),
    getRobinsText: (...args) => getEntry()?.checklistOps?.getRobinsText(...args),
    getRob2Text: (...args) => getEntry()?.checklistOps?.getRob2Text(...args),
    getTextRef: (...args) => getEntry()?.checklistOps?.getTextRef(...args),
    setTextValue: (...args) => getEntry()?.checklistOps?.setTextValue(...args),

    addPdfToStudy: (...args) => getEntry()?.pdfOps?.addPdfToStudy(...args),
    removePdfFromStudy: (...args) => getEntry()?.pdfOps?.removePdfFromStudy(...args),
    removePdfByFileName: (...args) => getEntry()?.pdfOps?.removePdfByFileName(...args),
    updatePdfTag: (...args) => getEntry()?.pdfOps?.updatePdfTag(...args),
    updatePdfMetadata: (...args) => getEntry()?.pdfOps?.updatePdfMetadata(...args),
    setPdfAsPrimary: (...args) => getEntry()?.pdfOps?.setPdfAsPrimary(...args),
    setPdfAsProtocol: (...args) => getEntry()?.pdfOps?.setPdfAsProtocol(...args),

    saveReconciliationProgress: (...args) =>
      getEntry()?.reconciliationOps?.saveReconciliationProgress(...args),
    getReconciliationProgress: (...args) =>
      getEntry()?.reconciliationOps?.getReconciliationProgress(...args),
    getAllReconciliationProgress: (...args) =>
      getEntry()?.reconciliationOps?.getAllReconciliationProgress(...args),
    clearReconciliationProgress: (...args) =>
      getEntry()?.reconciliationOps?.clearReconciliationProgress(...args),

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

    getOutcomes: () => getEntry()?.outcomeOps?.getOutcomes() || [],
    getOutcome: (...args) => getEntry()?.outcomeOps?.getOutcome(...args),
    createOutcome: (...args) => getEntry()?.outcomeOps?.createOutcome(...args),
    updateOutcome: (...args) => getEntry()?.outcomeOps?.updateOutcome(...args),
    deleteOutcome: (...args) => getEntry()?.outcomeOps?.deleteOutcome(...args),
    isOutcomeInUse: (...args) => getEntry()?.outcomeOps?.isOutcomeInUse(...args),

    connect: () => {},
    disconnect: () => connectionPool.release(projectId),
    getAwareness: () => connectionPool.getAwareness(projectId),
  };
}

export default useProject;

// Re-export cleanupProjectLocalData from the pool
export const cleanupProjectLocalData = projectId =>
  connectionPool.cleanupProjectLocalData(projectId);
