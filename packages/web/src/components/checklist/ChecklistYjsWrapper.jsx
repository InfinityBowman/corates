import { createSignal, createEffect, createMemo, Show } from 'solid-js';
import { useParams, useNavigate, useLocation } from '@solidjs/router';
import ChecklistWithPdf from '@/components/checklist/ChecklistWithPdf.jsx';
import useProject from '@/primitives/useProject/index.js';
import { useOrgContext } from '@primitives/useOrgContext.js';
import projectStore from '@/stores/projectStore.js';
import projectActionsStore from '@/stores/projectActionsStore';
import { ACCESS_DENIED_ERRORS } from '@/constants/errors.js';
import { CHECKLIST_STATUS, isEditable } from '@/constants/checklist-status.js';
import { getNextStatusForCompletion } from '@/lib/checklist-domain.js';
import { downloadPdf, uploadPdf, deletePdf, getPdfUrl } from '@api/pdf-api.js';
import { getCachedPdf, cachePdf } from '@primitives/pdfCache.js';
import { showToast, useConfirmDialog } from '@corates/ui';
import { useBetterAuth } from '@api/better-auth-store.js';
import { getChecklistTypeFromState, scoreChecklistOfType } from '@/checklist-registry';
import { IoChevronBack } from 'solid-icons/io';
import ScoreTag from '@/components/checklist/ScoreTag.jsx';
import { isAMSTAR2Complete } from '@/AMSTAR2/checklist.js';

export default function ChecklistYjsWrapper() {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useBetterAuth();
  const confirmDialog = useConfirmDialog();

  // Get org context for navigation and API calls
  const { orgSlug, orgId } = useOrgContext();

  const [pdfData, setPdfData] = createSignal(null);
  const [pdfFileName, setPdfFileName] = createSignal(null);
  const [pdfLoading, setPdfLoading] = createSignal(false);
  const [selectedPdfId, setSelectedPdfId] = createSignal(null);

  // Use full hook for write operations
  // orgId() is required for remote projects' WebSocket connection
  const {
    connect,
    updateChecklistAnswer,
    updateChecklist,
    getChecklistData,
    addPdfToStudy,
    getQuestionNote,
  } = useProject(orgId(), params.projectId);

  // Set active project for action store
  createEffect(() => {
    const pid = params.projectId;
    const oid = orgId();
    if (pid && oid) {
      projectActionsStore._setActiveProject(pid, oid);
      connect();
    }
  });

  // Read data directly from store for faster reactivity
  const connectionState = () => projectStore.getConnectionState(params.projectId);

  // Watch for access-denied errors and redirect to org projects
  createEffect(() => {
    const state = connectionState();
    if (state.error && ACCESS_DENIED_ERRORS.includes(state.error)) {
      showToast.error('Access Denied', state.error);
      const slug = orgSlug();
      navigate(slug ? `/orgs/${slug}` : '/dashboard', { replace: true });
    }
  });

  // Find the current study and checklist from the store
  const currentStudy = createMemo(() => {
    return projectStore.getStudy(params.projectId, params.studyId);
  });

  const currentChecklist = createMemo(() => {
    const study = currentStudy();
    if (!study) return null;
    return study.checklists?.find(c => c.id === params.checklistId);
  });

  const isReadOnly = () => {
    const checklist = currentChecklist();
    if (!checklist) return false;
    return !isEditable(checklist.status);
  };

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
    selectedPdfId(); // Explicitly track selection changes

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

  // Handle PDF change (upload new PDF)
  const handlePdfChange = async (data, fileName) => {
    const oid = orgId();
    if (!oid) {
      showToast.error('Error', 'No organization context');
      return;
    }

    let uploadResult = null;
    try {
      // Determine tag: if no PDFs exist, set as primary
      const hasPdfs = studyPdfs().length > 0;
      const tag = hasPdfs ? 'secondary' : 'primary';

      uploadResult = await uploadPdf(oid, params.projectId, params.studyId, data, fileName);
      // Update Y.js with PDF metadata
      const pdfId = addPdfToStudy(
        params.studyId,
        {
          key: uploadResult.key,
          fileName: uploadResult.fileName,
          size: uploadResult.size,
          uploadedBy: user()?.id,
          uploadedAt: Date.now(),
        },
        tag,
      );

      setPdfData(data);
      setPdfFileName(fileName);
      setSelectedPdfId(pdfId);
      // Cache the uploaded PDF locally
      cachePdf(params.projectId, params.studyId, fileName, data);
    } catch (err) {
      console.error('Failed to upload PDF:', err);
      // Clean up uploaded file if metadata save failed
      if (uploadResult?.fileName) {
        deletePdf(oid, params.projectId, params.studyId, uploadResult.fileName).catch(cleanupErr =>
          console.warn('Failed to clean up orphaned PDF:', cleanupErr),
        );
      }
      const { handleError } = await import('@/lib/error-utils.js');
      await handleError(err, {
        toastTitle: 'Upload Failed',
      });
    }
  };

  // Build the checklist object in the format AMSTAR2Checklist expects
  const checklistForUI = createMemo(() => {
    const checklist = currentChecklist();
    const study = currentStudy();
    if (!checklist) return null;

    // The answers are stored in Y.js, merge with checklist metadata
    const data = getChecklistData(params.studyId, params.checklistId);
    if (!data) return null;

    return {
      id: checklist.id,
      name: study?.name || 'Checklist',
      reviewerName: '',
      createdAt: checklist.createdAt,
      ...data.answers, // Spread the q1, q2, etc. answer data
    };
  });

  // Valid keys for each checklist type
  const AMSTAR2_KEY_PATTERN = /^q\d+[a-z]*$/i;
  const ROBINS_I_KEYS = new Set([
    'planning',
    'sectionA',
    'sectionB',
    'sectionC',
    'sectionD',
    'confoundingEvaluation',
    'domain1a',
    'domain1b',
    'domain2',
    'domain3',
    'domain4',
    'domain5',
    'domain6',
    'overall',
  ]);

  // Handle partial updates from checklist components (AMSTAR2 or ROBINS-I)
  // Both use object-style API: onUpdate({ key: value })
  function handlePartialUpdate(patch) {
    if (isReadOnly()) return;
    const type = checklistType();

    Object.entries(patch).forEach(([key, value]) => {
      // AMSTAR2: keys like q1, q2a, etc. | ROBINS-I: section and domain keys
      const isValidKey =
        (type === 'AMSTAR2' && AMSTAR2_KEY_PATTERN.test(key)) ||
        (type === 'ROBINS_I' && ROBINS_I_KEYS.has(key));
      if (isValidKey) {
        updateChecklistAnswer(params.studyId, params.checklistId, key, value);
      }
    });
  }

  // Toggle checklist completion status
  async function handleToggleComplete() {
    if (isReadOnly()) return;
    const checklist = currentChecklist();
    const study = currentStudy();
    if (!checklist || !study) return;

    // If already finalized, don't allow toggle back (checklist is locked)
    if (checklist.status === CHECKLIST_STATUS.FINALIZED) {
      showToast.info('Checklist Locked', 'Completed checklists cannot be edited.');
      return;
    }

    // Safety check: validate checklist before allowing completion
    if (!isChecklistValid()) {
      showToast.error(
        'Incomplete Checklist',
        'All questions must have a final answer before marking the checklist as complete.',
      );
      return;
    }

    // Show confirmation dialog before marking complete
    const confirmed = await confirmDialog.open({
      title: 'Mark Checklist as Complete?',
      description:
        'Once marked complete, this checklist will be locked and cannot be edited. Are you sure you want to proceed?',
      confirmText: 'Mark Complete',
      cancelText: 'Cancel',
      variant: 'warning',
    });

    if (!confirmed) return;

    // Determine the appropriate status based on reviewer count
    const nextStatus = getNextStatusForCompletion(study);
    updateChecklist(params.studyId, params.checklistId, { status: nextStatus });

    const statusLabel =
      nextStatus === CHECKLIST_STATUS.FINALIZED ? 'completed' : 'awaiting reconciliation';
    showToast.success(
      'Checklist Completed',
      `This checklist has been marked as ${statusLabel} and is now locked.`,
    );
  }

  // Get the checklist type from metadata or detect from state
  const checklistType = createMemo(() => {
    const checklist = currentChecklist();
    if (checklist?.type) return checklist.type;
    const ui = checklistForUI();
    if (ui) return getChecklistTypeFromState(ui);
    return 'AMSTAR2';
  });

  // Compute the current score based on checklist answers
  const currentScore = createMemo(() => {
    const checklist = checklistForUI();
    const type = checklistType();
    if (!checklist || !type) return null;
    return scoreChecklistOfType(type, checklist);
  });

  // Validate checklist completion - only for AMSTAR2 checklists
  const isChecklistValid = createMemo(() => {
    const type = checklistType();
    const checklist = checklistForUI();

    // For non-AMSTAR2 checklists, allow completion (no validation)
    if (type !== 'AMSTAR2') return true;

    // For AMSTAR2, check if all questions have final answers
    if (!checklist) return false;
    return isAMSTAR2Complete(checklist);
  });

  // Generate PDF URL for opening in new tab
  const pdfUrl = createMemo(() => {
    const fileName = pdfFileName();
    const oid = orgId();
    if (!fileName || !oid) return null;
    return getPdfUrl(oid, params.projectId, params.studyId, fileName);
  });

  // Determine back button navigation from tab query param
  const getBackTab = () => {
    const tabFromUrl = new URLSearchParams(location.search).get('tab');
    return tabFromUrl || 'overview';
  };

  // Build back path with org context
  const getBackPath = () => {
    const slug = orgSlug();
    const tab = getBackTab();
    if (slug) {
      return `/orgs/${slug}/projects/${params.projectId}?tab=${tab}`;
    }
    return `/projects/${params.projectId}?tab=${tab}`;
  };

  // Header content for the split screen toolbar (left side)
  const headerContent = (
    <>
      <confirmDialog.ConfirmDialogComponent />
      <button
        onClick={() => navigate(getBackPath())}
        class='text-gray-400 transition-colors hover:text-gray-700'
      >
        <IoChevronBack size={20} />
      </button>
      <div class='truncate text-sm text-gray-600'>
        <span class='font-medium text-gray-900'>
          {currentChecklist()?.type || 'AMSTAR2'} Checklist
        </span>
      </div>
      <div class='ml-auto flex items-center gap-3'>
        <ScoreTag currentScore={currentScore()} checklistType={checklistType()} />
        <Show
          when={!isReadOnly()}
          fallback={
            <span
              class={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                currentChecklist()?.status === CHECKLIST_STATUS.FINALIZED ?
                  'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-700'
              }`}
            >
              {currentChecklist()?.status === CHECKLIST_STATUS.FINALIZED ?
                'Completed'
              : 'Read-only'}
            </span>
          }
        >
          <button
            onClick={handleToggleComplete}
            disabled={!isChecklistValid()}
            title={
              !isChecklistValid() ?
                'All questions must have a final answer before marking complete'
              : undefined
            }
            class={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              currentChecklist()?.status === CHECKLIST_STATUS.FINALIZED ?
                'bg-green-100 text-green-700 hover:bg-green-200'
              : !isChecklistValid() ? 'cursor-not-allowed bg-gray-300 text-gray-500 opacity-60'
              : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {currentChecklist()?.status === CHECKLIST_STATUS.FINALIZED ?
              'Completed'
            : 'Mark Complete'}
          </button>
        </Show>
      </div>
    </>
  );

  return (
    <>
      <Show
        when={checklistForUI()}
        fallback={
          <div class='flex min-h-screen items-center justify-center bg-blue-50'>
            <div class='text-gray-500'>
              <Show
                when={connectionState().connecting || pdfLoading()}
                fallback='Checklist not found'
              >
                Loading...
              </Show>
            </div>
          </div>
        }
      >
        <ChecklistWithPdf
          checklistType={checklistType()}
          checklist={checklistForUI()}
          onUpdate={handlePartialUpdate}
          headerContent={headerContent}
          pdfData={pdfData()}
          pdfFileName={pdfFileName()}
          pdfUrl={pdfUrl()}
          onPdfChange={handlePdfChange}
          readOnly={isReadOnly()}
          allowDelete={false}
          pdfs={studyPdfs()}
          selectedPdfId={selectedPdfId()}
          onPdfSelect={handlePdfSelect}
          getQuestionNote={questionKey =>
            getQuestionNote(params.studyId, params.checklistId, questionKey)
          }
        />
      </Show>
    </>
  );
}
