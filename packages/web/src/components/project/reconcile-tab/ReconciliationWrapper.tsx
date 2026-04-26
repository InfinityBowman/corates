/**
 * ReconciliationWrapper - Handles loading checklists and managing reconciliation workflow
 * This component is rendered as a child route of ProjectView and shares its YDoc connection.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useProjectContext } from '@/components/project/ProjectContext';
import { connectionPool } from '@/project/ConnectionPool';
import { buildChecklistAnswerInput, type TextRef } from '@/primitives/useProject/checklists';
import {
  useProjectStore,
  selectMembers,
  selectConnectionPhase,
  selectStudy,
} from '@/stores/projectStore';
import { useAuthStore, selectUser } from '@/stores/authStore';
import { ACCESS_DENIED_ERRORS } from '@/constants/errors.js';
import {
  CHECKLIST_STATUS,
  findReconciledChecklistForOutcome,
  getInProgressReconciledChecklists,
} from '@corates/shared/checklists';
import { downloadPdf, getPdfUrl } from '@/api/pdf-api';
import { getCachedPdf, cachePdf } from '@/primitives/pdfCache.js';
import { showToast } from '@/components/ui/toast';
import { usePdfPreviewStore } from '@/stores/pdfPreviewStore';
import { ReconciliationEngine, registerReconciliationAdapter } from './engine';
import { amstar2Adapter } from './amstar2-reconcile/adapter';
import { rob2Adapter } from './rob2-reconcile/adapter';
import { robinsIAdapter } from './robins-i-reconcile/adapter';

// Register adapters
registerReconciliationAdapter('AMSTAR2', amstar2Adapter);
registerReconciliationAdapter('ROB2', rob2Adapter);
registerReconciliationAdapter('ROBINS_I', robinsIAdapter);

interface ReconciliationWrapperProps {
  projectId: string;
  studyId: string;
  checklist1Id: string;
  checklist2Id: string;
}

export function ReconciliationWrapper({
  projectId,
  studyId,
  checklist1Id,
  checklist2Id,
}: ReconciliationWrapperProps) {
  const navigate = useNavigate();
  const { orgId } = useProjectContext();
  const user = useAuthStore(selectUser);

  const [error, setError] = useState<string | null>(null);
  const closePreview = usePdfPreviewStore(s => s.closePreview);

  // Close any open PDF preview panel to avoid two viewers in memory simultaneously
  useEffect(() => {
    closePreview();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ops = connectionPool.getOps(projectId);
  if (!ops) throw new Error(`No connection for project ${projectId}`);
  const {
    createChecklist: createProjectChecklist,
    updateChecklistAnswer,
    updateChecklist,
    getChecklistData,
    getTextRef: opsGetTextRef,
    setTextValue: opsSetTextValue,
  } = ops.checklist;
  const { getReconciliationProgress, saveReconciliationProgress } = ops.reconciliation;
  const getAwareness = ops.getAwareness;

  // Current user for presence features
  const currentUser = useMemo(() => {
    if (!user) return null;
    return {
      id: user.id,
      name: user.name || user.email || 'Unknown',
      image: user.image,
    };
  }, [user]);

  // Read data from store (use stable selectors to avoid infinite re-render loops)
  const connectionState = useProjectStore(s => selectConnectionPhase(s, projectId));
  const currentStudy = useProjectStore(s => selectStudy(s, projectId, studyId));
  const members = useProjectStore(s => selectMembers(s, projectId));

  // Watch for access-denied errors and redirect
  useEffect(() => {
    if (connectionState.error && ACCESS_DENIED_ERRORS.includes(connectionState.error)) {
      showToast.error('Access Denied', connectionState.error);
      navigate({ to: '/dashboard', replace: true });
    }
  }, [connectionState.error, navigate]);

  // PDF state
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [selectedPdfId, setSelectedPdfId] = useState<string | null>(null);
  const [attemptedPdfFile, setAttemptedPdfFile] = useState<string | null>(null);

  // Get all PDFs from the study
  const studyPdfs = useMemo(() => currentStudy?.pdfs || [], [currentStudy]);

  // Get the primary PDF or first PDF as default selection
  const defaultPdf = useMemo(() => {
    if (!studyPdfs.length) return null;
    return studyPdfs.find(p => p.tag === 'primary') || studyPdfs[0];
  }, [studyPdfs]);

  // The currently selected PDF (or default)
  const currentPdf = useMemo(() => {
    if (selectedPdfId) {
      return studyPdfs.find(p => p.id === selectedPdfId) || defaultPdf;
    }
    return defaultPdf;
  }, [studyPdfs, selectedPdfId, defaultPdf]);

  // Auto-select primary PDF when study loads
  useEffect(() => {
    if (defaultPdf && !selectedPdfId) {
      setSelectedPdfId(defaultPdf.id);
    }
  }, [defaultPdf, selectedPdfId]);

  // Load PDF when selection changes - try cache first, then cloud
  useEffect(() => {
    const fileName = currentPdf?.fileName;
    if (!fileName || !orgId || attemptedPdfFile === fileName || pdfLoading) return;

    setAttemptedPdfFile(fileName);
    setPdfLoading(true);
    setPdfData(null);

    getCachedPdf(projectId, studyId, fileName)
      .then(cachedData => {
        if (cachedData) {
          setPdfData(cachedData);
          setPdfFileName(fileName);
          setPdfLoading(false);
          return null;
        }
        return downloadPdf(orgId, projectId, studyId, fileName);
      })
      .then(cloudData => {
        if (cloudData) {
          setPdfData(cloudData);
          setPdfFileName(fileName);
          cachePdf(projectId, studyId, fileName, cloudData);
        }
      })
      .catch((err: unknown) => {
        console.error('Failed to load PDF:', err);
      })
      .finally(() => {
        setPdfLoading(false);
      });
  }, [currentPdf?.fileName, orgId, attemptedPdfFile, pdfLoading, projectId, studyId]);

  // Handle PDF selection change
  const handlePdfSelect = useCallback((pdfId: string) => {
    setSelectedPdfId(pdfId);
    setAttemptedPdfFile(null);
  }, []);

  // Generate PDF URL for opening in new tab
  const pdfUrl = useMemo(() => {
    if (!pdfFileName || !orgId) return null;
    return getPdfUrl(orgId, projectId, studyId, pdfFileName);
  }, [pdfFileName, orgId, projectId, studyId]);

  // Get checklist metadata from store
  const checklist1Meta = useMemo(() => {
    if (!currentStudy) return null;
    return currentStudy.checklists?.find(c => c.id === checklist1Id);
  }, [currentStudy, checklist1Id]);

  const checklist2Meta = useMemo(() => {
    if (!currentStudy) return null;
    return currentStudy.checklists?.find(c => c.id === checklist2Id);
  }, [currentStudy, checklist2Id]);

  // Get reviewer name from userId
  const getReviewerName = useCallback(
    (userId: string | null) => {
      if (!userId) return 'Unassigned';
      const member = members.find(m => m.userId === userId);
      return member?.name || member?.email || 'Unknown';
    },
    [members],
  );

  // Get full checklist data including answers
  const checklist1Data = useMemo(() => {
    if (!checklist1Meta || !getChecklistData) return null;
    const data = getChecklistData(studyId, checklist1Id);
    if (!data) return null;
    return {
      id: checklist1Meta.id,
      name: currentStudy?.name || 'Checklist 1',
      reviewerName: getReviewerName(checklist1Meta.assignedTo),
      createdAt: checklist1Meta.createdAt,
      ...(data.answers ?? {}),
    };
  }, [
    checklist1Meta,
    getChecklistData,
    studyId,
    checklist1Id,
    currentStudy?.name,
    getReviewerName,
  ]);

  const checklist2Data = useMemo(() => {
    if (!checklist2Meta || !getChecklistData) return null;
    const data = getChecklistData(studyId, checklist2Id);
    if (!data) return null;
    return {
      id: checklist2Meta.id,
      name: currentStudy?.name || 'Checklist 2',
      reviewerName: getReviewerName(checklist2Meta.assignedTo),
      createdAt: checklist2Meta.createdAt,
      ...(data.answers ?? {}),
    };
  }, [
    checklist2Meta,
    getChecklistData,
    studyId,
    checklist2Id,
    currentStudy?.name,
    getReviewerName,
  ]);

  // State for reconciled checklist
  const [reconciledChecklistId, setReconciledChecklistId] = useState<string | null>(null);
  const [reconciledChecklistLoading, setReconciledChecklistLoading] = useState(false);
  const [hasCheckedForReconciled, setHasCheckedForReconciled] = useState(false);

  // Extract outcomeId and type from checklist1 metadata
  const outcomeId = checklist1Meta?.outcomeId || null;
  const checklistType = useMemo(
    () => (checklist1Meta?.type || 'AMSTAR2') as import('./engine/types').SupportedChecklistType,
    [checklist1Meta],
  );

  // Get or create reconciled checklist (with race condition prevention)
  useEffect(() => {
    if (
      !currentStudy ||
      connectionState.phase !== 'synced' ||
      reconciledChecklistId ||
      hasCheckedForReconciled ||
      !createProjectChecklist
    ) {
      return;
    }

    setHasCheckedForReconciled(true);
    setReconciledChecklistLoading(true);

    // Check if one already exists in reconciliation progress for this outcome
    const progress = getReconciliationProgress(studyId, outcomeId, checklistType);
    if (
      progress &&
      progress.checklist1Id === checklist1Id &&
      progress.checklist2Id === checklist2Id &&
      progress.reconciledChecklistId
    ) {
      const existingChecklist = currentStudy.checklists?.find(
        c =>
          c.id === progress.reconciledChecklistId &&
          c.status !== CHECKLIST_STATUS.FINALIZED &&
          c.outcomeId === outcomeId &&
          c.type === checklistType,
      );
      if (existingChecklist) {
        setReconciledChecklistId(progress.reconciledChecklistId);
        setReconciledChecklistLoading(false);
        return;
      }
    }

    // Check if a reconciled checklist already exists for this outcome
    const existingReconciled = findReconciledChecklistForOutcome(
      currentStudy,
      outcomeId,
      checklistType,
    );
    if (existingReconciled && existingReconciled.status !== CHECKLIST_STATUS.FINALIZED) {
      saveReconciliationProgress(studyId, outcomeId, checklistType, {
        checklist1Id,
        checklist2Id,
        reconciledChecklistId: existingReconciled.id,
      });
      setReconciledChecklistId(existingReconciled.id);
      setReconciledChecklistLoading(false);
      return;
    }

    // Need to create one
    const newChecklistId = createProjectChecklist(studyId, checklistType, null, outcomeId);
    if (!newChecklistId) {
      setError('Failed to create reconciled checklist');
      setReconciledChecklistLoading(false);
      return;
    }

    updateChecklist(studyId, newChecklistId, {
      status: CHECKLIST_STATUS.RECONCILING,
      title: 'Reconciled Checklist',
    });

    saveReconciliationProgress(studyId, outcomeId, checklistType, {
      checklist1Id,
      checklist2Id,
      reconciledChecklistId: newChecklistId,
    });

    setReconciledChecklistId(newChecklistId);
    setReconciledChecklistLoading(false);
  }, [
    currentStudy,
    connectionState.phase,
    reconciledChecklistId,
    hasCheckedForReconciled,
    studyId,
    outcomeId,
    checklistType,
    checklist1Id,
    checklist2Id,
    createProjectChecklist,
    getReconciliationProgress,
    saveReconciliationProgress,
    updateChecklist,
  ]);

  // Watch for race condition: if another client created a reconciled checklist,
  // use the one created first
  useEffect(() => {
    if (!reconciledChecklistId || reconciledChecklistLoading || !currentStudy) return;

    const allReconciled = getInProgressReconciledChecklists(currentStudy).filter(
      c => c.outcomeId === outcomeId && c.type === checklistType,
    );

    if (allReconciled.length > 1) {
      allReconciled.sort((a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0));
      const firstCreated = allReconciled[0];

      if (firstCreated.id !== reconciledChecklistId) {
        saveReconciliationProgress(studyId, outcomeId, checklistType, {
          checklist1Id,
          checklist2Id,
          reconciledChecklistId: firstCreated.id,
        });
        setReconciledChecklistId(firstCreated.id);
      }
    }
  }, [
    reconciledChecklistId,
    reconciledChecklistLoading,
    currentStudy,
    outcomeId,
    checklistType,
    studyId,
    checklist1Id,
    checklist2Id,
    saveReconciliationProgress,
  ]);

  // Get reconciled checklist metadata
  const reconciledChecklistMeta = useMemo(() => {
    if (!currentStudy || !reconciledChecklistId) return null;
    return currentStudy.checklists?.find(c => c.id === reconciledChecklistId);
  }, [currentStudy, reconciledChecklistId]);

  // Get reconciled checklist data
  const reconciledChecklistData = useMemo(() => {
    if (!reconciledChecklistId || !getChecklistData) return null;
    const data = getChecklistData(studyId, reconciledChecklistId);
    if (!data) return null;
    return {
      id: reconciledChecklistId,
      name: 'Reconciled Checklist',
      reviewerName: 'Consensus',
      createdAt: reconciledChecklistMeta?.createdAt || 0,
      ...(data.answers ?? {}),
    };
  }, [reconciledChecklistId, getChecklistData, studyId, reconciledChecklistMeta]);

  // Build project path
  const getProjectPath = useCallback(() => `/projects/${projectId}`, [projectId]);

  // Handle saving the reconciled checklist
  const handleSaveReconciled = useCallback(
    async (reconciledName?: string) => {
      try {
        if (!reconciledChecklistId) {
          throw new Error('No reconciled checklist found');
        }
        updateChecklist(studyId, reconciledChecklistId, {
          status: CHECKLIST_STATUS.FINALIZED,
          title: reconciledName || 'Reconciled Checklist',
        });
        navigate({ to: `${getProjectPath()}?tab=completed` as string });
      } catch (err) {
        console.error('Error saving reconciled checklist:', err);
        setError(err instanceof Error ? err.message : 'Failed to save');
      }
    },
    [reconciledChecklistId, studyId, updateChecklist, navigate, getProjectPath],
  );

  // Handle cancel
  const handleCancel = useCallback(() => {
    navigate({ to: `${getProjectPath()}?tab=reconcile` as string });
  }, [navigate, getProjectPath]);

  const getTextRef = useCallback(
    (ref: TextRef) => opsGetTextRef(studyId, reconciledChecklistId as string, ref),
    [opsGetTextRef, studyId, reconciledChecklistId],
  );

  const setTextValue = useCallback(
    (ref: TextRef, text: string) =>
      opsSetTextValue(studyId, reconciledChecklistId as string, ref, text),
    [opsSetTextValue, studyId, reconciledChecklistId],
  );

  // Shared props for all reconciliation types
  const sharedProps = {
    checklist1: checklist1Data,
    checklist2: checklist2Data,
    reconciledChecklist: reconciledChecklistData,
    reconciledChecklistId,
    reviewer1Name: getReviewerName(checklist1Meta?.assignedTo ?? null),
    reviewer2Name: getReviewerName(checklist2Meta?.assignedTo ?? null),
    onSaveReconciled: handleSaveReconciled,
    onCancel: handleCancel,
    pdfData,
    pdfFileName,
    pdfUrl,
    pdfLoading,
    pdfs: studyPdfs,
    selectedPdfId,
    onPdfSelect: handlePdfSelect,
    getAwareness,
    currentUser,
  };

  // Error state
  if (error) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-blue-50'>
        <div className='bg-card max-w-md rounded-lg p-8 shadow-lg'>
          <h2 className='text-destructive mb-2 text-xl font-bold'>Error</h2>
          <p className='text-secondary-foreground'>{error}</p>
          <button
            onClick={handleCancel}
            className='bg-primary hover:bg-primary/90 focus:ring-primary mt-4 rounded-lg px-4 py-2 text-white focus:ring-2 focus:outline-none'
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (!checklist1Data || !checklist2Data || reconciledChecklistLoading || !reconciledChecklistId) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-blue-50'>
        <div className='text-center'>
          <div className='mx-auto mb-4 size-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent' />
          <p className='text-secondary-foreground'>
            {reconciledChecklistLoading ? 'Setting up reconciliation...' : 'Loading checklists...'}
          </p>
        </div>
      </div>
    );
  }

  // All types now route through the engine
  return (
    <ReconciliationEngine
      {...sharedProps}
      checklistType={checklistType}
      updateChecklistAnswer={(sectionKey: string, data: unknown) => {
        if (!reconciledChecklistId) return;
        const input = buildChecklistAnswerInput(checklistType, sectionKey, data);
        if (!input) return;
        updateChecklistAnswer(studyId, reconciledChecklistId, input);
      }}
      getTextRef={getTextRef}
      setTextValue={setTextValue}
    />
  );
}
