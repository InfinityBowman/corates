/**
 * ReconciliationWrapper - Handles loading checklists and managing reconciliation workflow
 * This component is rendered as a child route of ProjectView and shares its
 * pooled engine session. Consolidated text is co-edited on Yjs fields
 * (ReconcileFieldsContext); everything else reads rows and writes mutations.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useProjectContext } from '@/components/project/ProjectContext';
import { connectionPool } from '@/project/ConnectionPool';
import { applyLocalMutation } from '@/project/localWrites';
import {
  ReconcileFieldsContext,
  ReconciledFieldStore,
  serializeFieldsIntoRows,
  useReconciledTextMap,
} from './fields';
import { buildChecklistAnswerInput, type TextRef } from './engine/types';
import { useProjectStore, selectConnectionPhase } from '@/stores/projectStore';
import {
  useChecklistAnswerMap,
  useAnswerWriters,
  useReconciliationProgress,
  useStudy,
  useProjectMembers,
} from '@/project/workspace-data';
import { serializeAnswerRows, textFieldKey, type ChecklistAnswerInput } from '@corates/shared/sync';
import { useAuthStore, selectUser } from '@/stores/authStore';
import { ACCESS_DENIED_ERRORS } from '@/constants/errors.js';
import {
  CHECKLIST_STATUS,
  findReconciledChecklistForOutcome,
  getInProgressReconciledChecklists,
  type ChecklistStatus,
} from '@corates/shared/checklists';
import { downloadPdf, getPdfUrl } from '@/api/pdf-api';
import { getCachedPdf, cachePdf } from '@/primitives/pdfCache.js';
import { Button } from '@/components/ui/button';
import { showToast } from '@/lib/toast';
import { Spinner } from '@/components/ui/spinner';
import { usePdfPreviewStore } from '@/stores/pdfPreviewStore';
import { track } from '@/lib/analytics';
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

  // Fire-and-forget mutations: optimistic apply is immediate, and rejections
  // surface through the pool's global onMutationRejected toast.
  const client = connectionPool.getClient(projectId);

  // Current user for presence features
  const currentUser = useMemo(() => {
    if (!user) return null;
    return {
      id: user.id,
      name: user.name || user.email || 'Unknown',
      image: user.image,
    };
  }, [user]);

  const connectionState = useProjectStore(s => selectConnectionPhase(s, projectId));
  const currentStudy = useStudy(projectId, studyId);
  const members = useProjectMembers(projectId);

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
      .catch(async (err: unknown) => {
        const { handleError } = await import('@/lib/error-utils');
        await handleError(err, { toastTitle: 'PDF Load Failed' });
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

  // Extract outcomeId and type from checklist1 metadata
  const outcomeId = checklist1Meta?.outcomeId || null;
  const checklistType = useMemo(
    () => (checklist1Meta?.type || 'AMSTAR2') as import('./engine/types').SupportedChecklistType,
    [checklist1Meta],
  );

  // Reconciliation progress for this outcome group, reactively from the
  // reconciliations collection (gates the setup effect below).
  const progress = useReconciliationProgress(projectId, studyId, outcomeId, checklistType);

  // Mode-aware writes: online through the outbox, local practice through the
  // same shared mutators applied directly — mirroring useAnswerWriters.
  const updateChecklist = useCallback(
    (checklistId: string, updates: { title?: string; status?: ChecklistStatus }) => {
      const args = { checklistId, updates, now: Date.now() };
      if (client) void client.mutate.checklist.update(args);
      else applyLocalMutation(projectId, 'checklist.update', args);
    },
    [client, projectId],
  );

  const saveReconciliationProgress = useCallback(
    (data: {
      checklist1Id: string;
      checklist2Id: string;
      reconciledChecklistId?: string;
      currentPage?: number;
      viewMode?: string;
    }) => {
      const args = { studyId, outcomeId, type: checklistType, data, now: Date.now() };
      if (client) void client.mutate.reconciliation.saveProgress(args);
      else applyLocalMutation(projectId, 'reconciliation.saveProgress', args);
    },
    [client, projectId, studyId, outcomeId, checklistType],
  );

  // Get full checklist data including answers, reactively from answer rows
  const flat1 = useChecklistAnswerMap(projectId, checklist1Id ?? '');
  const flat2 = useChecklistAnswerMap(projectId, checklist2Id ?? '');

  const checklist1Data = useMemo(() => {
    if (!checklist1Meta) return null;
    return {
      id: checklist1Meta.id,
      name: currentStudy?.name || 'Checklist 1',
      reviewerName: getReviewerName(checklist1Meta.assignedTo),
      createdAt: checklist1Meta.createdAt,
      ...serializeAnswerRows(checklistType, flat1),
    };
  }, [checklist1Meta, checklistType, flat1, currentStudy?.name, getReviewerName]);

  const checklist2Data = useMemo(() => {
    if (!checklist2Meta) return null;
    return {
      id: checklist2Meta.id,
      name: currentStudy?.name || 'Checklist 2',
      reviewerName: getReviewerName(checklist2Meta.assignedTo),
      createdAt: checklist2Meta.createdAt,
      ...serializeAnswerRows(checklistType, flat2),
    };
  }, [checklist2Meta, checklistType, flat2, currentStudy?.name, getReviewerName]);

  // State for reconciled checklist
  const [reconciledChecklistId, setReconciledChecklistId] = useState<string | null>(null);
  const [reconciledChecklistLoading, setReconciledChecklistLoading] = useState(false);
  const [hasCheckedForReconciled, setHasCheckedForReconciled] = useState(false);

  // Get or create reconciled checklist (with race condition prevention).
  // The phase gate covers both modes: online sessions reach synced/cached
  // once the client exists, local practice reaches synced once its rows load.
  useEffect(() => {
    if (
      !currentStudy ||
      (connectionState.phase !== 'synced' && connectionState.phase !== 'cached') ||
      reconciledChecklistId ||
      hasCheckedForReconciled
    ) {
      return;
    }

    setHasCheckedForReconciled(true);
    setReconciledChecklistLoading(true);

    // Check if one already exists in reconciliation progress for this outcome
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
      saveReconciliationProgress({
        checklist1Id,
        checklist2Id,
        reconciledChecklistId: existingReconciled.id,
      });
      setReconciledChecklistId(existingReconciled.id);
      setReconciledChecklistLoading(false);
      return;
    }

    // Need to create one — the optimistic apply makes the row exist locally
    // immediately, so the generated id is usable right away.
    const newChecklistId = crypto.randomUUID();
    const createArgs = {
      id: newChecklistId,
      studyId,
      type: checklistType,
      assignedTo: null,
      outcomeId,
      now: Date.now(),
    };
    if (client) void client.mutate.checklist.create(createArgs);
    else applyLocalMutation(projectId, 'checklist.create', createArgs);

    updateChecklist(newChecklistId, {
      status: CHECKLIST_STATUS.RECONCILING,
      title: 'Reconciled Checklist',
    });

    saveReconciliationProgress({
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
    projectId,
    studyId,
    outcomeId,
    checklistType,
    checklist1Id,
    checklist2Id,
    client,
    progress,
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
        saveReconciliationProgress({
          checklist1Id,
          checklist2Id,
          reconciledChecklistId: firstCreated.id,
        });
        setReconciledChecklistId(firstCreated.id);
      }
      return;
    }

    // The latched id may point at nothing: our optimistic create lost a
    // concurrent-creation race (the server rejected it as DuplicateChecklist
    // and rolled the row back), which the >1 branch never sees because only
    // the winner's row remains. Adopt the surviving checklist instead of
    // rendering a wedged page against a dead id.
    if (allReconciled.length === 1 && allReconciled[0].id !== reconciledChecklistId) {
      saveReconciliationProgress({
        checklist1Id,
        checklist2Id,
        reconciledChecklistId: allReconciled[0].id,
      });
      setReconciledChecklistId(allReconciled[0].id);
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

  // The session's Yjs field store (online only): one shared handle per text
  // field of the reconciled checklist, alive for the whole session so
  // editors and programmatic writes converge on the same doc. Local practice
  // has no fields — the hook and setTextValue fall back to answer rows.
  const yfields = connectionPool.getYjsFields(projectId);
  const fieldStore = useMemo(
    () =>
      yfields && reconciledChecklistId ?
        new ReconciledFieldStore(yfields, reconciledChecklistId)
      : null,
    [yfields, reconciledChecklistId],
  );
  useEffect(() => {
    if (!fieldStore) return;
    return () => fieldStore.dispose();
  }, [fieldStore]);

  const flatReconciled = useChecklistAnswerMap(projectId, reconciledChecklistId ?? '');

  // Mid-session, the reconciled checklist's prose lives in Yjs fields, not
  // rows — overlay the live field text so derivations over the serialized
  // shape (the summary's answered-gating, note displays) see it.
  const fieldTextOverlay = useReconciledTextMap(fieldStore, checklistType);

  const reconciledChecklistData = useMemo(() => {
    if (!reconciledChecklistId || !reconciledChecklistMeta) return null;
    return {
      id: reconciledChecklistId,
      name: 'Reconciled Checklist',
      reviewerName: 'Consensus',
      createdAt: reconciledChecklistMeta.createdAt || 0,
      ...serializeAnswerRows(checklistType, { ...flatReconciled, ...fieldTextOverlay }),
    };
  }, [
    reconciledChecklistId,
    reconciledChecklistMeta,
    checklistType,
    flatReconciled,
    fieldTextOverlay,
  ]);

  // Build project path
  const getProjectPath = useCallback(() => `/projects/${projectId}`, [projectId]);

  const writers = useAnswerWriters(projectId, studyId, reconciledChecklistId ?? '');

  const fieldsContextValue = useMemo(
    () => (reconciledChecklistId ? { projectId, reconciledChecklistId, store: fieldStore } : null),
    [projectId, reconciledChecklistId, fieldStore],
  );

  const setTextValue = useCallback(
    (ref: TextRef, text: string) => {
      const key = textFieldKey({ ...ref, type: checklistType });
      if (fieldStore) fieldStore.setText(key, text);
      else writers.setText(key, text);
    },
    [fieldStore, writers, checklistType],
  );

  // Handle saving the reconciled checklist. Online, the co-edited field text
  // is serialized into answer rows first — the finalized checklist must read
  // entirely from rows — and finalize aborts if the fields cannot be read.
  const handleSaveReconciled = useCallback(
    async (reconciledName?: string) => {
      try {
        if (!reconciledChecklistId) {
          throw new Error('No reconciled checklist found');
        }
        if (fieldStore) {
          const serialized = await serializeFieldsIntoRows(
            fieldStore,
            checklistType,
            flatReconciled,
            writers.setText,
          );
          if (!serialized) {
            showToast.error(
              'Connection required',
              'Could not read the consolidated notes — check your connection and try again.',
            );
            return;
          }
        }
        updateChecklist(reconciledChecklistId, {
          status: CHECKLIST_STATUS.FINALIZED,
          title: reconciledName || 'Reconciled Checklist',
        });
        track('Checklist:Completed', { type: checklistType });
        navigate({ to: `${getProjectPath()}?tab=completed` as string });
      } catch (err) {
        const { handleError } = await import('@/lib/error-utils');
        await handleError(err, { setError, showToast: false });
      }
    },
    [
      reconciledChecklistId,
      fieldStore,
      flatReconciled,
      writers,
      checklistType,
      updateChecklist,
      navigate,
      getProjectPath,
    ],
  );

  // Handle cancel
  const handleCancel = useCallback(() => {
    navigate({ to: `${getProjectPath()}?tab=reconcile` as string });
  }, [navigate, getProjectPath]);

  // Shared props for all reconciliation types
  const sharedProps = {
    checklist1: checklist1Data,
    checklist2: checklist2Data,
    reconciledChecklist: reconciledChecklistData,
    reconciledChecklistId,
    studyName: currentStudy?.name,
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
    client,
    currentUser,
  };

  // Error state
  if (error) {
    return (
      <div className='bg-secondary flex min-h-screen items-center justify-center'>
        <div className='bg-card max-w-md rounded-lg p-8 shadow-lg'>
          <h2 className='text-destructive mb-2 text-xl font-bold'>Error</h2>
          <p className='text-secondary-foreground'>{error}</p>
          <Button onClick={handleCancel} className='mt-4'>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // Loading state
  if (!checklist1Data || !checklist2Data || reconciledChecklistLoading || !reconciledChecklistId) {
    return (
      <div className='bg-secondary flex min-h-screen items-center justify-center'>
        <div className='text-center'>
          <Spinner size='lg' className='mx-auto mb-4' />
          <p className='text-secondary-foreground'>
            {reconciledChecklistLoading ? 'Setting up reconciliation...' : 'Loading checklists...'}
          </p>
        </div>
      </div>
    );
  }

  // All types now route through the engine
  return (
    <ReconcileFieldsContext.Provider value={fieldsContextValue}>
      <ReconciliationEngine
        {...sharedProps}
        checklistType={checklistType}
        updateChecklistAnswer={(sectionKey: string, data: unknown) => {
          if (!reconciledChecklistId) return;
          const input = buildChecklistAnswerInput(checklistType, sectionKey, data);
          if (!input) return;
          writers.updateAnswer(input as ChecklistAnswerInput);
        }}
        setTextValue={setTextValue}
      />
    </ReconcileFieldsContext.Provider>
  );
}
