import { createSignal, createEffect, createMemo, Show } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import ChecklistWithPdf from '@checklist-ui/ChecklistWithPdf.jsx';
import useProject from '@/primitives/useProject/index.js';
import projectStore from '@/stores/projectStore.js';
import { downloadPdf, uploadPdf, deletePdf } from '@api/pdf-api.js';
import { getCachedPdf, cachePdf, removeCachedPdf } from '@primitives/pdfCache.js';
import { showToast } from '@corates/ui';
import { useBetterAuth } from '@api/better-auth-store.js';
import { getChecklistTypeFromState, scoreChecklistOfType } from '@/checklist-registry';
import { IoChevronBack } from 'solid-icons/io';
import ScoreTag from '@/components/checklist-ui/ScoreTag.jsx';
import { PdfSelector } from '@checklist-ui/pdf/index.js';

export default function ChecklistYjsWrapper() {
  const params = useParams();
  const navigate = useNavigate();
  const { user } = useBetterAuth();

  const [pdfData, setPdfData] = createSignal(null);
  const [pdfFileName, setPdfFileName] = createSignal(null);
  const [pdfLoading, setPdfLoading] = createSignal(false);
  const [selectedPdfId, setSelectedPdfId] = createSignal(null);

  // Use full hook for write operations
  const {
    updateChecklistAnswer,
    updateChecklist,
    getChecklistData,
    addPdfToStudy,
    removePdfFromStudy,
  } = useProject(params.projectId);

  // Read data directly from store for faster reactivity
  const connectionState = () => projectStore.getConnectionState(params.projectId);

  // Find the current study and checklist from the store
  const currentStudy = createMemo(() => {
    return projectStore.getStudy(params.projectId, params.studyId);
  });

  const currentChecklist = createMemo(() => {
    const study = currentStudy();
    if (!study) return null;
    return study.checklists?.find(c => c.id === params.checklistId);
  });

  const isReadOnly = () => currentChecklist()?.isReconciled === true;

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

    // Clear previous PDF data when switching
    if (attemptedPdfFile() && attemptedPdfFile() !== fileName) {
      setPdfData(null);
      setPdfFileName(null);
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

  // Handle PDF selection change
  const handlePdfSelect = pdfId => {
    setSelectedPdfId(pdfId);
    // Reset attempted file to trigger reload
    setAttemptedPdfFile(null);
  };

  // Handle PDF change (upload new PDF)
  const handlePdfChange = async (data, fileName) => {
    let uploadResult = null;
    try {
      // Determine tag: if no PDFs exist, set as primary
      const hasPdfs = studyPdfs().length > 0;
      const tag = hasPdfs ? 'secondary' : 'primary';

      uploadResult = await uploadPdf(params.projectId, params.studyId, data, fileName);
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
        deletePdf(params.projectId, params.studyId, uploadResult.fileName).catch(cleanupErr =>
          console.warn('Failed to clean up orphaned PDF:', cleanupErr),
        );
      }
      showToast.error('Upload Failed', 'Failed to upload PDF');
    }
  };

  // Handle PDF clear (delete current PDF)
  const handlePdfClear = async () => {
    const pdf = currentPdf();
    if (!pdf) return;

    try {
      await deletePdf(params.projectId, params.studyId, pdf.fileName);
      // Update Y.js to remove PDF metadata
      removePdfFromStudy(params.studyId, pdf.id);
      // Remove from cache
      removeCachedPdf(params.projectId, params.studyId, pdf.fileName);
      setPdfData(null);
      setPdfFileName(null);
      setSelectedPdfId(null);
      setAttemptedPdfFile(null);
    } catch (err) {
      console.error('Failed to delete PDF:', err);
      showToast.error('Delete Failed', 'Failed to delete PDF');
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
      // AMSTAR2: keys like q1, q2a, etc.
      if (type === 'AMSTAR2' && AMSTAR2_KEY_PATTERN.test(key)) {
        updateChecklistAnswer(params.studyId, params.checklistId, key, value);
      }
      // ROBINS-I: section and domain keys
      else if (type === 'ROBINS_I' && ROBINS_I_KEYS.has(key)) {
        updateChecklistAnswer(params.studyId, params.checklistId, key, value);
      }
    });
  }

  // Toggle checklist completion status
  function handleToggleComplete() {
    if (isReadOnly()) return;
    const checklist = currentChecklist();
    if (!checklist) return;

    const newStatus = checklist.status === 'completed' ? 'in-progress' : 'completed';
    updateChecklist(params.studyId, params.checklistId, { status: newStatus });

    if (newStatus === 'completed') {
      showToast.success('Checklist Completed', 'This checklist has been marked as completed');
    } else {
      showToast.info('Status Updated', 'Checklist marked as in-progress');
    }
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

  // Header content for the split screen toolbar (left side)
  const headerContent = (
    <>
      <button
        onClick={() => navigate(`/projects/${params.projectId}?tab=todo`)}
        class='text-gray-400 hover:text-gray-700 transition-colors'
      >
        <IoChevronBack size={20} />
      </button>
      <div class='text-sm text-gray-600 truncate'>
        <span class='text-gray-900 font-medium'>
          {currentChecklist()?.type || 'AMSTAR2'} Checklist
        </span>
      </div>
      {/* PDF Selector - only shown when multiple PDFs exist */}
      <Show when={studyPdfs().length > 1}>
        <PdfSelector
          pdfs={studyPdfs()}
          selectedPdfId={selectedPdfId()}
          onSelect={handlePdfSelect}
        />
      </Show>
      <div class='ml-auto flex items-center gap-3'>
        <ScoreTag currentScore={currentScore()} checklistType={checklistType()} />
        <Show
          when={!isReadOnly()}
          fallback={
            <span class='px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 text-gray-700'>
              Read-only
            </span>
          }
        >
          <button
            onClick={handleToggleComplete}
            class={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              currentChecklist()?.status === 'completed' ?
                'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {currentChecklist()?.status === 'completed' ? 'Completed' : 'Mark Complete'}
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
          <div class='flex items-center justify-center min-h-screen bg-blue-50'>
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
          onPdfChange={handlePdfChange}
          onPdfClear={handlePdfClear}
          readOnly={isReadOnly()}
        />
      </Show>
    </>
  );
}
