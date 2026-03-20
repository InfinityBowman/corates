/**
 * ReconciliationWrapper - Handles loading checklists and managing reconciliation workflow
 * This component is rendered as a child route of ProjectView and shares its YDoc connection.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useProjectContext } from '@/components/project/ProjectContext';
import {
  useProjectStore,
  selectMembers,
  selectConnectionState,
  selectStudy,
} from '@/stores/projectStore';
import { useAuthStore, selectUser } from '@/stores/authStore';
import _projectActionsStore from '@/stores/projectActionsStore/index.js';
import { ACCESS_DENIED_ERRORS } from '@/constants/errors.js';
import { CHECKLIST_STATUS } from '@/constants/checklist-status.js';
import {
  findReconciledChecklistForOutcome,
  getInProgressReconciledChecklists,
} from '@/lib/checklist-domain.js';
import { downloadPdf, getPdfUrl } from '@/api/pdf-api';
import { getCachedPdf, cachePdf } from '@/primitives/pdfCache.js';
import { showToast } from '@/components/ui/toast';
import { CHECKLIST_TYPES } from '@/checklist-registry/types';
import { usePdfPreviewStore } from '@/stores/pdfPreviewStore';
import { ReconciliationEngine, registerReconciliationAdapter } from './engine';
import { amstar2Adapter } from './amstar2-reconcile/adapter';
import { rob2Adapter } from './rob2-reconcile/adapter';
import { robinsIAdapter } from './robins-i-reconcile/adapter';

// Register adapters
registerReconciliationAdapter('AMSTAR2', amstar2Adapter);
registerReconciliationAdapter('ROB2', rob2Adapter);
registerReconciliationAdapter('ROBINS_I', robinsIAdapter);

const projectActionsStore = _projectActionsStore as any;

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
  const { orgId, projectOps } = useProjectContext();
  const user = useAuthStore(selectUser);

  const [error, setError] = useState<string | null>(null);
  const closePreview = usePdfPreviewStore(s => s.closePreview);

  // Close any open PDF preview panel to avoid two viewers in memory simultaneously
  useEffect(() => {
    closePreview();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Destructure Y.js operations from parent ProjectView's connection
  const ops = projectOps as any;
  const {
    createChecklist: createProjectChecklist,
    updateChecklistAnswer,
    updateChecklist,
    getChecklistData,
    getReconciliationProgress,
    getQuestionNote,
    getRobinsText,
    getRob2Text,
    saveReconciliationProgress,
    getAwareness,
  } = ops || {};

  // Current user for presence features
  const currentUser = useMemo(() => {
    if (!user) return null;
    return {
      id: user.id,
      name: (user as any).name || (user as any).email || 'Unknown',
      image: (user as any).image,
    };
  }, [user]);

  // Set active project for action store
  useEffect(() => {
    if (projectId && orgId) {
      projectActionsStore._setActiveProject(projectId, orgId);
    }
  }, [projectId, orgId]);

  // Read data from store (use stable selectors to avoid infinite re-render loops)
  const connectionState = useProjectStore(s => selectConnectionState(s, projectId)) as any;
  const currentStudy = useProjectStore(s => selectStudy(s, projectId, studyId)) as any;
  const members = useProjectStore(s => selectMembers(s, projectId)) as any[];

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
    return studyPdfs.find((p: any) => p.tag === 'primary') || studyPdfs[0];
  }, [studyPdfs]);

  // The currently selected PDF (or default)
  const currentPdf = useMemo(() => {
    if (selectedPdfId) {
      return studyPdfs.find((p: any) => p.id === selectedPdfId) || defaultPdf;
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
      .then((cachedData: any) => {
        if (cachedData) {
          setPdfData(cachedData);
          setPdfFileName(fileName);
          setPdfLoading(false);
          return null;
        }
        return downloadPdf(orgId, projectId, studyId, fileName);
      })
      .then((cloudData: any) => {
        if (cloudData) {
          setPdfData(cloudData);
          setPdfFileName(fileName);
          cachePdf(projectId, studyId, fileName, cloudData);
        }
      })
      .catch((err: any) => {
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
    return currentStudy.checklists?.find((c: any) => c.id === checklist1Id);
  }, [currentStudy, checklist1Id]);

  const checklist2Meta = useMemo(() => {
    if (!currentStudy) return null;
    return currentStudy.checklists?.find((c: any) => c.id === checklist2Id);
  }, [currentStudy, checklist2Id]);

  // Get reviewer name from userId
  const getReviewerName = useCallback(
    (userId: string | null) => {
      if (!userId) return 'Unassigned';
      const member = members.find((m: any) => m.userId === userId);
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
      ...data.answers,
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
      ...data.answers,
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
  const checklistType = useMemo(() => checklist1Meta?.type || 'AMSTAR2', [checklist1Meta]);

  // Get or create reconciled checklist (with race condition prevention)
  useEffect(() => {
    if (
      !currentStudy ||
      !connectionState.synced ||
      reconciledChecklistId ||
      hasCheckedForReconciled ||
      !createProjectChecklist
    ) {
      return;
    }

    setHasCheckedForReconciled(true);
    setReconciledChecklistLoading(true);

    // Check if one already exists in reconciliation progress for this outcome
    const progress = getReconciliationProgress?.(studyId, outcomeId, checklistType);
    if (
      progress &&
      progress.checklist1Id === checklist1Id &&
      progress.checklist2Id === checklist2Id &&
      progress.reconciledChecklistId
    ) {
      const existingChecklist = currentStudy.checklists?.find(
        (c: any) =>
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
    ) as Record<string, any> | null;
    if (existingReconciled && existingReconciled.status !== CHECKLIST_STATUS.FINALIZED) {
      saveReconciliationProgress?.(studyId, outcomeId, checklistType, {
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

    updateChecklist?.(studyId, newChecklistId, {
      status: CHECKLIST_STATUS.RECONCILING,
      title: 'Reconciled Checklist',
    });

    saveReconciliationProgress?.(studyId, outcomeId, checklistType, {
      checklist1Id,
      checklist2Id,
      reconciledChecklistId: newChecklistId,
    });

    setReconciledChecklistId(newChecklistId);
    setReconciledChecklistLoading(false);
  }, [
    currentStudy,
    connectionState.synced,
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
      (c: any) => c.outcomeId === outcomeId && c.type === checklistType,
    );

    if (allReconciled.length > 1) {
      allReconciled.sort((a: any, b: any) => (a.createdAt || 0) - (b.createdAt || 0));
      const firstCreated = allReconciled[0];

      if (firstCreated.id !== reconciledChecklistId) {
        saveReconciliationProgress?.(studyId, outcomeId, checklistType, {
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
    return currentStudy.checklists?.find((c: any) => c.id === reconciledChecklistId);
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
      ...data.answers,
    };
  }, [reconciledChecklistId, getChecklistData, studyId, reconciledChecklistMeta]);

  const isRobinsI = checklistType === CHECKLIST_TYPES.ROBINS_I || checklistType === 'ROBINS_I';
  const isRob2 = checklistType === CHECKLIST_TYPES.ROB2 || checklistType === 'ROB2';

  // Build project path
  const getProjectPath = useCallback(() => `/projects/${projectId}`, [projectId]);

  // Handle saving the reconciled checklist
  const handleSaveReconciled = useCallback(
    async (reconciledName?: string) => {
      try {
        if (!reconciledChecklistId) {
          throw new Error('No reconciled checklist found');
        }
        updateChecklist?.(studyId, reconciledChecklistId, {
          status: CHECKLIST_STATUS.FINALIZED,
          title: reconciledName || 'Reconciled Checklist',
        });
        navigate({ to: `${getProjectPath()}?tab=completed` as string });
      } catch (err: any) {
        console.error('Error saving reconciled checklist:', err);
        setError(err.message);
      }
    },
    [reconciledChecklistId, studyId, updateChecklist, navigate, getProjectPath],
  );

  // Handle cancel
  const handleCancel = useCallback(() => {
    navigate({ to: `${getProjectPath()}?tab=reconcile` as string });
  }, [navigate, getProjectPath]);

  // Unified getTextRef that routes to the correct Yjs text accessor per type
  const getTextRef = useCallback(
    (...args: unknown[]) => {
      if (isRobinsI) {
        return getRobinsText?.(studyId, reconciledChecklistId, ...args);
      }
      if (isRob2) {
        return getRob2Text?.(studyId, reconciledChecklistId, ...args);
      }
      // AMSTAR2: getQuestionNote takes just the question key
      return getQuestionNote?.(studyId, reconciledChecklistId, args[0]);
    },
    [
      isRobinsI,
      isRob2,
      studyId,
      reconciledChecklistId,
      getRobinsText,
      getRob2Text,
      getQuestionNote,
    ],
  );

  // Shared props for all reconciliation types
  const sharedProps = {
    checklist1: checklist1Data,
    checklist2: checklist2Data,
    reconciledChecklist: reconciledChecklistData,
    reconciledChecklistId,
    reviewer1Name: getReviewerName(checklist1Meta?.assignedTo),
    reviewer2Name: getReviewerName(checklist2Meta?.assignedTo),
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
          <h2 className='mb-2 text-xl font-bold text-destructive'>Error</h2>
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
      updateChecklistAnswer={(sectionKey: string, data: any) => {
        if (!reconciledChecklistId) return;
        updateChecklistAnswer?.(studyId, reconciledChecklistId, sectionKey, data);
      }}
      getTextRef={getTextRef}
    />
  );
}
