/**
 * ReconciliationWrapper - Handles loading checklists and managing reconciliation workflow
 * This component is used both for project-based (Y.js) and local checklists
 */

import { createSignal, createMemo, createEffect, Show } from 'solid-js';
import { useParams, useNavigate } from '@tanstack/solid-router';
import useProject from '@/primitives/useProject/index.js';
import projectStore from '@/stores/projectStore.js';
import { ACCESS_DENIED_ERRORS } from '@/constants/errors.js';
import { CHECKLIST_STATUS } from '@/constants/checklist-status.js';
import {
  findReconciledChecklist,
  getInProgressReconciledChecklists,
} from '@/lib/checklist-domain.js';
import { downloadPdf, getPdfUrl } from '@api/pdf-api.js';
import { getCachedPdf, cachePdf } from '@primitives/pdfCache.js';
import { showToast } from '@corates/ui';
import ReconciliationWithPdf from './ReconciliationWithPdf.jsx';

export default function ReconciliationWrapper() {
  const params = useParams();
  const navigate = useNavigate();

  // params.projectId, params.studyId, params.checklist1Id, params.checklist2Id

  const [error, setError] = createSignal(null);

  // Use project hook for Y.js operations
  const {
    createChecklist: createProjectChecklist,
    updateChecklistAnswer,
    updateChecklist,
    getChecklistData,
    getReconciliationProgress,
    getQuestionNote,
    saveReconciliationProgress,
    connect,
  } = useProject(params.projectId);

  // Read data from store
  const connectionState = () => projectStore.getConnectionState(params.projectId);

  // Watch for access-denied errors and redirect to dashboard
  createEffect(() => {
    const state = connectionState();
    if (state.error && ACCESS_DENIED_ERRORS.includes(state.error)) {
      showToast.error('Access Denied', state.error);
      navigate({ to: '/dashboard', replace: true });
    }
  });

  const currentStudy = createMemo(() => {
    return projectStore.getStudy(params.projectId, params.studyId);
  });

  const members = () => projectStore.getMembers(params.projectId);

  // PDF state
  const [pdfData, setPdfData] = createSignal(null);
  const [pdfFileName, setPdfFileName] = createSignal(null);
  const [pdfLoading, setPdfLoading] = createSignal(false);
  const [selectedPdfId, setSelectedPdfId] = createSignal(null);

  // Get all PDFs from the study
  const studyPdfs = createMemo(() => {
    const study = currentStudy();
    return study?.pdfs || [];
  });

  // Get the primary PDF or first PDF as default selection
  const defaultPdf = createMemo(() => {
    const pdfs = studyPdfs();
    if (!pdfs.length) return null;
    // Prefer primary, then first available
    return pdfs.find(p => p.tag === 'primary') || pdfs[0];
  });

  // The currently selected PDF (or default)
  const currentPdf = createMemo(() => {
    const pdfs = studyPdfs();
    const selected = selectedPdfId();
    if (selected) {
      return pdfs.find(p => p.id === selected) || defaultPdf();
    }
    return defaultPdf();
  });

  // Track which PDF we've attempted to load (to prevent infinite retries)
  const [attemptedPdfFile, setAttemptedPdfFile] = createSignal(null);

  // Auto-select primary PDF when study loads
  createEffect(() => {
    const pdf = defaultPdf();
    if (pdf && !selectedPdfId()) {
      setSelectedPdfId(pdf.id);
    }
  });

  // Load PDF when selection changes - try cache first, then cloud
  createEffect(() => {
    const pdf = currentPdf();
    const fileName = pdf?.fileName;

    // Skip if no PDF, already loaded this file, or currently loading
    if (!fileName || attemptedPdfFile() === fileName || pdfLoading()) {
      return;
    }

    // Don't clear previous PDF - keep it visible until new one loads
    // This prevents flashing empty state during transitions

    setAttemptedPdfFile(fileName);
    setPdfLoading(true);

    // Try cache first, then fall back to cloud
    getCachedPdf(params.projectId, params.studyId, fileName)
      .then(cachedData => {
        if (cachedData) {
          // Found in cache - use it immediately
          setPdfData(cachedData);
          setPdfFileName(fileName);
          setPdfLoading(false);
          return null; // Skip cloud fetch
        }
        // Not in cache - fetch from cloud
        return downloadPdf(params.projectId, params.studyId, fileName);
      })
      .then(cloudData => {
        if (cloudData) {
          // Got from cloud - save to cache and use it
          setPdfData(cloudData);
          setPdfFileName(fileName);
          // Cache it for next time (fire and forget)
          cachePdf(params.projectId, params.studyId, fileName, cloudData);
        }
      })
      .catch(err => {
        console.error('Failed to load PDF:', err);
      })
      .finally(() => {
        setPdfLoading(false);
      });
  });

  // Handle PDF selection change
  const handlePdfSelect = pdfId => {
    setSelectedPdfId(pdfId);
    // Reset attempted file to trigger reload
    setAttemptedPdfFile(null);
  };

  // Generate PDF URL for opening in new tab
  const pdfUrl = createMemo(() => {
    const fileName = pdfFileName();
    if (!fileName) return null;
    return getPdfUrl(params.projectId, params.studyId, fileName);
  });

  // Get checklist metadata from store
  const checklist1Meta = createMemo(() => {
    const study = currentStudy();
    if (!study) return null;
    return study.checklists?.find(c => c.id === params.checklist1Id);
  });

  const checklist2Meta = createMemo(() => {
    const study = currentStudy();
    if (!study) return null;
    return study.checklists?.find(c => c.id === params.checklist2Id);
  });

  // Get full checklist data including answers
  const checklist1Data = createMemo(() => {
    const meta = checklist1Meta();
    if (!meta) return null;

    const data = getChecklistData(params.studyId, params.checklist1Id);
    if (!data) return null;

    // Flatten answers into the checklist object (expected format)
    const result = {
      id: meta.id,
      name: currentStudy()?.name || 'Checklist 1',
      reviewerName: getReviewerName(meta.assignedTo),
      createdAt: meta.createdAt,
      ...data.answers,
    };

    return result;
  });

  const checklist2Data = createMemo(() => {
    const meta = checklist2Meta();
    if (!meta) return null;

    const data = getChecklistData(params.studyId, params.checklist2Id);
    if (!data) return null;

    const result = {
      id: meta.id,
      name: currentStudy()?.name || 'Checklist 2',
      reviewerName: getReviewerName(meta.assignedTo),
      createdAt: meta.createdAt,
      ...data.answers,
    };

    return result;
  });

  // State for reconciled checklist
  const [reconciledChecklistId, setReconciledChecklistId] = createSignal(null);
  const [reconciledChecklistLoading, setReconciledChecklistLoading] = createSignal(false);
  const [hasCheckedForReconciled, setHasCheckedForReconciled] = createSignal(false);

  // Get or create reconciled checklist (with race condition prevention)
  createEffect(() => {
    const state = connectionState();
    if (!state.synced || reconciledChecklistId() || hasCheckedForReconciled()) return;

    setHasCheckedForReconciled(true);
    setReconciledChecklistLoading(true);

    const study = currentStudy();
    if (!study) {
      setReconciledChecklistLoading(false);
      setHasCheckedForReconciled(false); // Allow retry
      return;
    }

    // First, check if one already exists in reconciliation progress
    const progress = getReconciliationProgress(params.studyId);
    if (
      progress &&
      progress.checklist1Id === params.checklist1Id &&
      progress.checklist2Id === params.checklist2Id &&
      progress.reconciledChecklistId
    ) {
      // Verify it still exists and is not completed
      const existingChecklist = study.checklists?.find(
        c => c.id === progress.reconciledChecklistId && c.status !== CHECKLIST_STATUS.COMPLETED,
      );
      if (existingChecklist) {
        setReconciledChecklistId(progress.reconciledChecklistId);
        setReconciledChecklistLoading(false);
        return;
      }
    }

    // Check if a reconciled checklist already exists (another client may have created it)
    const existingReconciled = findReconciledChecklist(study);
    if (existingReconciled && existingReconciled.status !== CHECKLIST_STATUS.COMPLETED) {
      // Found existing - save reference in progress and use it
      saveReconciliationProgress(params.studyId, {
        checklist1Id: params.checklist1Id,
        checklist2Id: params.checklist2Id,
        reconciledChecklistId: existingReconciled.id,
      });
      setReconciledChecklistId(existingReconciled.id);
      setReconciledChecklistLoading(false);
      return;
    }

    // Need to create one - detect checklist type from checklist1
    const checklist1 = checklist1Meta();
    const checklistType = checklist1?.type || 'AMSTAR2';

    // Create the reconciled checklist
    const newChecklistId = createProjectChecklist(params.studyId, checklistType, null);
    if (!newChecklistId) {
      setError('Failed to create reconciled checklist');
      setReconciledChecklistLoading(false);
      return;
    }

    // Mark it as in-progress (reconciled checklist starts as in-progress)
    updateChecklist(params.studyId, newChecklistId, {
      status: CHECKLIST_STATUS.IN_PROGRESS,
      title: 'Reconciled Checklist',
    });

    // Save reference in reconciliation progress
    saveReconciliationProgress(params.studyId, {
      checklist1Id: params.checklist1Id,
      checklist2Id: params.checklist2Id,
      reconciledChecklistId: newChecklistId,
    });

    // Set the ID - if another client created one, the store will update reactively
    // and we'll see it in the next effect run
    setReconciledChecklistId(newChecklistId);
    setReconciledChecklistLoading(false);
  });

  // Watch for race condition: if another client created a reconciled checklist,
  // use the one created first (check happens reactively via store updates)
  createEffect(() => {
    if (!connectionState().synced || !reconciledChecklistId() || reconciledChecklistLoading())
      return;

    const study = currentStudy();
    const currentId = reconciledChecklistId();
    if (!study || !currentId) return;

    // Get all in-progress reconciled checklists
    const allReconciled = getInProgressReconciledChecklists(study);

    if (allReconciled.length > 1) {
      // Multiple reconciled checklists exist - use the one created first
      allReconciled.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      const firstCreated = allReconciled[0];

      if (firstCreated.id !== currentId) {
        // Another one was created first - use it instead
        saveReconciliationProgress(params.studyId, {
          checklist1Id: params.checklist1Id,
          checklist2Id: params.checklist2Id,
          reconciledChecklistId: firstCreated.id,
        });
        setReconciledChecklistId(firstCreated.id);
      }
    }
  });

  // Get reconciled checklist metadata
  const reconciledChecklistMeta = createMemo(() => {
    const study = currentStudy();
    const id = reconciledChecklistId();
    if (!study || !id) return null;
    return study.checklists?.find(c => c.id === id);
  });

  // Get reconciled checklist data
  const reconciledChecklistData = createMemo(() => {
    const id = reconciledChecklistId();
    if (!id) return null;

    const data = getChecklistData(params.studyId, id);
    if (!data) return null;

    // Flatten answers into the checklist object (expected format)
    const result = {
      id,
      name: 'Reconciled Checklist',
      reviewerName: 'Consensus',
      createdAt: reconciledChecklistMeta()?.createdAt || Date.now(),
      ...data.answers,
    };

    return result;
  });

  // Get reviewer name from userId
  function getReviewerName(userId) {
    if (!userId) return 'Unassigned';
    const member = members().find(m => m.userId === userId);
    return member?.displayName || member?.name || member?.email || 'Unknown';
  }

  // Handle saving the reconciled checklist
  async function handleSaveReconciled(reconciledName) {
    try {
      const id = reconciledChecklistId();
      if (!id) {
        throw new Error('No reconciled checklist found');
      }

      // Mark the reconciled checklist as completed
      updateChecklist(params.studyId, id, {
        status: CHECKLIST_STATUS.COMPLETED,
        title: reconciledName || 'Reconciled Checklist',
      });

      // Mark the individual reviewer checklists as completed
      updateChecklist(params.studyId, params.checklist1Id, {
        status: CHECKLIST_STATUS.COMPLETED,
      });
      updateChecklist(params.studyId, params.checklist2Id, {
        status: CHECKLIST_STATUS.COMPLETED,
      });

      // Keep reconciliation progress (checklist1Id and checklist2Id) so users can view previous reviewers
      // The progress data is needed for the "View Previous" button in the completed tab

      // Navigate back to the project view (completed tab)
      navigate({ to: `/projects/${params.projectId}?tab=completed` });
    } catch (err) {
      console.error('Error saving reconciled checklist:', err);
      setError(err.message);
    }
  }

  // Handle cancel
  function handleCancel() {
    navigate({ to: `/projects/${params.projectId}?tab=reconcile` });
  }

  // Connect on mount
  createEffect(() => {
    if (params.projectId) {
      connect();
    }
  });

  return (
    <Show
      when={!error()}
      fallback={
        <div class='flex min-h-screen items-center justify-center bg-blue-50'>
          <div class='max-w-md rounded-lg bg-white p-8 shadow-lg'>
            <h2 class='mb-2 text-xl font-bold text-red-600'>Error</h2>
            <p class='text-gray-600'>{error()}</p>
            <button
              onClick={handleCancel}
              class='mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none'
            >
              Go Back
            </button>
          </div>
        </div>
      }
    >
      <Show
        when={
          connectionState().synced &&
          checklist1Data() &&
          checklist2Data() &&
          !reconciledChecklistLoading() &&
          reconciledChecklistId()
        }
        fallback={
          <div class='flex min-h-screen items-center justify-center bg-blue-50'>
            <div class='text-center'>
              <div class='mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent' />
              <p class='text-gray-600'>
                {reconciledChecklistLoading() ?
                  'Setting up reconciliation...'
                : 'Loading checklists...'}
              </p>
            </div>
          </div>
        }
      >
        <ReconciliationWithPdf
          checklist1={checklist1Data()}
          checklist2={checklist2Data()}
          reconciledChecklist={reconciledChecklistData()}
          reconciledChecklistId={reconciledChecklistId()}
          reviewer1Name={getReviewerName(checklist1Meta()?.assignedTo)}
          reviewer2Name={getReviewerName(checklist2Meta()?.assignedTo)}
          onSaveReconciled={handleSaveReconciled}
          onCancel={handleCancel}
          pdfData={pdfData()}
          pdfFileName={pdfFileName()}
          pdfUrl={pdfUrl()}
          pdfLoading={pdfLoading()}
          pdfs={studyPdfs()}
          selectedPdfId={selectedPdfId()}
          onPdfSelect={handlePdfSelect}
          getQuestionNote={questionKey =>
            getQuestionNote(params.studyId, reconciledChecklistId(), questionKey)
          }
          updateChecklistAnswer={(questionKey, questionData) => {
            const id = reconciledChecklistId();
            if (!id) return;
            updateChecklistAnswer(params.studyId, id, questionKey, questionData);
          }}
        />
      </Show>
    </Show>
  );
}
