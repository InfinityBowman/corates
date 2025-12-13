/**
 * ReconciliationWrapper - Handles loading checklists and managing reconciliation workflow
 * This component is used both for project-based (Y.js) and local checklists
 */

import { createSignal, createMemo, createEffect, Show } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import useProject from '@/primitives/useProject/index.js';
import projectStore from '@primitives/projectStore.js';
import { downloadPdf } from '@api/pdf-api.js';
import { getCachedPdf, cachePdf } from '@primitives/pdfCache.js';
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
    getChecklistData,
    getReconciliationProgress,
    saveReconciliationProgress,
    clearReconciliationProgress,
    connect,
  } = useProject(params.projectId);

  // Read data from store
  const connectionState = () => projectStore.getConnectionState(params.projectId);

  const currentStudy = createMemo(() => {
    return projectStore.getStudy(params.projectId, params.studyId);
  });

  const members = () => projectStore.getMembers(params.projectId);

  // PDF state
  const [pdfData, setPdfData] = createSignal(null);
  const [pdfFileName, setPdfFileName] = createSignal(null);
  const [pdfLoading, setPdfLoading] = createSignal(false);

  // Get study PDF info
  const studyPdf = createMemo(() => {
    const study = currentStudy();
    if (!study || !study.pdfs || study.pdfs.length === 0) return null;
    return study.pdfs[0]; // Use the first PDF
  });

  // Track which PDF we've attempted to load (to prevent infinite retries)
  const [attemptedPdfFile, setAttemptedPdfFile] = createSignal(null);

  // Load PDF when study has one - try cache first, then cloud
  createEffect(() => {
    const pdf = studyPdf();
    const fileName = pdf?.fileName;

    // Skip if no PDF, already loaded, currently loading, or already attempted this file
    if (!fileName || pdfData() || pdfLoading() || attemptedPdfFile() === fileName) {
      return;
    }

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

  // Get saved reconciliation progress
  const savedProgress = createMemo(() => {
    // Make sure we're synced before trying to read progress
    if (!connectionState().synced) return null;

    // Only return progress if it matches the current checklists being reconciled
    const progress = getReconciliationProgress(params.studyId);
    if (!progress) return null;
    if (
      progress.checklist1Id === params.checklist1Id &&
      progress.checklist2Id === params.checklist2Id
    ) {
      return progress;
    }
    return null;
  });

  // Get reviewer name from userId
  function getReviewerName(userId) {
    if (!userId) return 'Unassigned';
    const member = members().find(m => m.userId === userId);
    return member?.displayName || member?.name || member?.email || 'Unknown';
  }

  // Handle saving reconciliation progress
  function handleSaveProgress(progressData) {
    saveReconciliationProgress(params.studyId, {
      checklist1Id: params.checklist1Id,
      checklist2Id: params.checklist2Id,
      currentPage: progressData.currentPage,
      viewMode: progressData.viewMode,
      finalAnswers: progressData.finalAnswers,
    });
  }

  // Handle saving the reconciled checklist
  async function handleSaveReconciled(reconciledChecklist) {
    try {
      // Create a new checklist in the study
      const newChecklistId = createProjectChecklist(params.studyId, 'AMSTAR2', null);

      if (!newChecklistId) {
        throw new Error('Failed to create reconciled checklist');
      }

      // Update each question's answer
      const questionKeys = Object.keys(reconciledChecklist).filter(k => /^q\d+[a-z]*$/i.test(k));

      for (const key of questionKeys) {
        updateChecklistAnswer(params.studyId, newChecklistId, key, reconciledChecklist[key]);
      }

      // Clear the reconciliation progress since we've completed it
      clearReconciliationProgress(params.studyId);

      // Navigate back to the project view (ready-to-reconcile tab)
      navigate(`/projects/${params.projectId}?tab=ready-to-reconcile`);
    } catch (err) {
      console.error('Error saving reconciled checklist:', err);
      setError(err.message);
    }
  }

  // Handle cancel
  function handleCancel() {
    navigate(`/projects/${params.projectId}?tab=ready-to-reconcile`);
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
        <div class='min-h-screen bg-blue-50 flex items-center justify-center'>
          <div class='bg-white rounded-lg shadow-lg p-8 max-w-md'>
            <h2 class='text-xl font-bold text-red-600 mb-2'>Error</h2>
            <p class='text-gray-600'>{error()}</p>
            <button
              onClick={handleCancel}
              class='mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700'
            >
              Go Back
            </button>
          </div>
        </div>
      }
    >
      <Show
        when={connectionState().synced && checklist1Data() && checklist2Data()}
        fallback={
          <div class='min-h-screen bg-blue-50 flex items-center justify-center'>
            <div class='text-center'>
              <div class='animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4' />
              <p class='text-gray-600'>Loading checklists...</p>
            </div>
          </div>
        }
      >
        <ReconciliationWithPdf
          checklist1={checklist1Data()}
          checklist2={checklist2Data()}
          reviewer1Name={getReviewerName(checklist1Meta()?.assignedTo)}
          reviewer2Name={getReviewerName(checklist2Meta()?.assignedTo)}
          savedProgress={savedProgress()}
          onSaveProgress={handleSaveProgress}
          onSaveReconciled={handleSaveReconciled}
          onCancel={handleCancel}
          pdfData={pdfData()}
          pdfFileName={pdfFileName()}
          pdfLoading={pdfLoading()}
        />
      </Show>
    </Show>
  );
}
