/**
 * ReconciliationWrapper - Handles loading checklists and managing reconciliation workflow
 * This component is used both for project-based (Y.js) and local checklists
 */

import { createSignal, createMemo, createEffect, Show } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import useProject from '@/primitives/useProject/index.js';
import { useProjectOrgId } from '@primitives/useProjectOrgId.js';
import projectStore from '@/stores/projectStore.js';
import projectActionsStore from '@/stores/projectActionsStore';
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
import { RobinsIReconciliationWithPdf } from '../robins-i-reconcile/index.js';
import { CHECKLIST_TYPES } from '@/checklist-registry/types.js';

/**
 * ReconciliationWrapper - Handles loading checklists and managing reconciliation workflow
 * This component is used both for project-based (Y.js) and local checklists
 * @returns {JSX.Element}
 */
export default function ReconciliationWrapper() {
  const params = useParams();
  const navigate = useNavigate();

  // Get orgId from project data (for API calls)
  const orgId = useProjectOrgId(params.projectId);

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
    getRobinsText,
    saveReconciliationProgress,
  } = useProject(params.projectId);

  // Set active project for action store
  createEffect(() => {
    const pid = params.projectId;
    const oid = orgId();
    if (pid) {
      if (oid) {
        projectActionsStore._setActiveProject(pid, oid);
      }
    }
  });

  // Read data from store
  const connectionState = () => projectStore.getConnectionState(params.projectId);

  // Watch for access-denied errors and redirect to projects
  createEffect(() => {
    const state = connectionState();
    if (state.error && ACCESS_DENIED_ERRORS.includes(state.error)) {
      showToast.error('Access Denied', state.error);
      navigate('/dashboard', { replace: true });
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
    const oid = orgId();

    // Skip if no PDF, no orgId, already loaded this file, or currently loading
    if (!fileName || !oid || attemptedPdfFile() === fileName || pdfLoading()) {
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
        // Not in cache - fetch from cloud with orgId
        return downloadPdf(oid, params.projectId, params.studyId, fileName);
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
    const oid = orgId();
    if (!fileName || !oid) return null;
    return getPdfUrl(oid, params.projectId, params.studyId, fileName);
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
      // Verify it still exists and is not finalized
      const existingChecklist = study.checklists?.find(
        c => c.id === progress.reconciledChecklistId && c.status !== CHECKLIST_STATUS.FINALIZED,
      );
      if (existingChecklist) {
        setReconciledChecklistId(progress.reconciledChecklistId);
        setReconciledChecklistLoading(false);
        return;
      }
    }

    // Check if a reconciled checklist already exists (another client may have created it)
    const existingReconciled = findReconciledChecklist(study);
    if (existingReconciled && existingReconciled.status !== CHECKLIST_STATUS.FINALIZED) {
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

    // Mark it as reconciling (reconciled checklist starts as reconciling)
    updateChecklist(params.studyId, newChecklistId, {
      status: CHECKLIST_STATUS.RECONCILING,
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

  // Detect checklist type for routing to appropriate reconciliation component
  const checklistType = createMemo(() => {
    const meta = checklist1Meta();
    return meta?.type || 'AMSTAR2';
  });

  // Check if this is a ROBINS-I checklist
  const isRobinsI = createMemo(() => {
    const type = checklistType();
    return type === CHECKLIST_TYPES.ROBINS_I || type === 'ROBINS_I';
  });

  // Get reviewer name from userId
  function getReviewerName(userId) {
    if (!userId) return 'Unassigned';
    const member = members().find(m => m.userId === userId);
    return member?.displayName || member?.name || member?.email || 'Unknown';
  }

  // Build project path
  const getProjectPath = () => {
    return `/projects/${params.projectId}`;
  };

  // Handle saving the reconciled checklist
  async function handleSaveReconciled(reconciledName) {
    try {
      const id = reconciledChecklistId();
      if (!id) {
        throw new Error('No reconciled checklist found');
      }

      // Mark the reconciled checklist as finalized
      updateChecklist(params.studyId, id, {
        status: CHECKLIST_STATUS.FINALIZED,
        title: reconciledName || 'Reconciled Checklist',
      });

      // Navigate back to the project view (completed tab)
      navigate(`${getProjectPath()}?tab=completed`);
    } catch (err) {
      console.error('Error saving reconciled checklist:', err);
      setError(err.message);
    }
  }

  // Handle cancel
  function handleCancel() {
    navigate(`${getProjectPath()}?tab=reconcile`);
  }

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
        <Show
          when={isRobinsI()}
          fallback={
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
          }
        >
          <RobinsIReconciliationWithPdf
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
            updateChecklistAnswer={(questionKey, questionData) => {
              const id = reconciledChecklistId();
              if (!id) return;
              updateChecklistAnswer(params.studyId, id, questionKey, questionData);
            }}
            getRobinsText={(sectionKey, fieldKey, questionKey) =>
              getRobinsText(
                params.studyId,
                reconciledChecklistId(),
                sectionKey,
                fieldKey,
                questionKey,
              )
            }
          />
        </Show>
      </Show>
    </Show>
  );
}
