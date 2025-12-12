import { createSignal, createEffect, createMemo, Show } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import ChecklistWithPdf from '@checklist-ui/ChecklistWithPdf.jsx';
import useProject from '@/primitives/useProject/index.js';
import projectStore from '@primitives/projectStore.js';
import { downloadPdf, uploadPdf, deletePdf } from '@api/pdf-api.js';
import { getCachedPdf, cachePdf, removeCachedPdf } from '@primitives/pdfCache.js';
import { showToast } from '@components/zag/Toast.jsx';
import { useBetterAuth } from '@api/better-auth-store.js';
import { scoreChecklist } from '@/AMSTAR2/checklist.js';
import { IoChevronBack } from 'solid-icons/io';
import ScoreTag from '@/components/checklist-ui/ScoreTag.jsx';

export default function ChecklistYjsWrapper() {
  const params = useParams();
  const navigate = useNavigate();
  const { user } = useBetterAuth();

  const [pdfData, setPdfData] = createSignal(null);
  const [pdfFileName, setPdfFileName] = createSignal(null);
  const [pdfLoading, setPdfLoading] = createSignal(false);

  // Use full hook for write operations
  const {
    error,
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

  // Get the first PDF from the study (if any)
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

  // Handle PDF change (upload new PDF)
  const handlePdfChange = async (data, fileName) => {
    try {
      // Remove any existing PDFs first
      const study = currentStudy();
      if (study?.pdfs?.length > 0) {
        for (const existingPdf of study.pdfs) {
          try {
            await deletePdf(params.projectId, params.studyId, existingPdf.fileName);
            removePdfFromStudy(params.studyId, existingPdf.fileName);
            // Also remove from cache
            removeCachedPdf(params.projectId, params.studyId, existingPdf.fileName);
          } catch (deleteErr) {
            console.warn('Failed to delete old PDF:', deleteErr);
            // Continue anyway - the new PDF will still be uploaded
          }
        }
      }

      const result = await uploadPdf(params.projectId, params.studyId, data, fileName);
      // Update Y.js with PDF metadata
      addPdfToStudy(params.studyId, {
        key: result.key,
        fileName: result.fileName,
        size: result.size,
        uploadedBy: user()?.id,
        uploadedAt: Date.now(),
      });
      setPdfData(data);
      setPdfFileName(fileName);
      // Cache the uploaded PDF locally
      cachePdf(params.projectId, params.studyId, fileName, data);
    } catch (err) {
      console.error('Failed to upload PDF:', err);
      showToast.error('Upload Failed', 'Failed to upload PDF');
    }
  };

  // Handle PDF clear (delete PDF)
  const handlePdfClear = async () => {
    const fileName = pdfFileName();
    if (!fileName) return;

    try {
      await deletePdf(params.projectId, params.studyId, fileName);
      // Update Y.js to remove PDF metadata
      removePdfFromStudy(params.studyId, fileName);
      // Remove from cache
      removeCachedPdf(params.projectId, params.studyId, fileName);
      setPdfData(null);
      setPdfFileName(null);
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

  // Handle partial updates from AMSTAR2Checklist
  function handlePartialUpdate(patch) {
    // Filter to only update answer keys (q1, q2, etc.)
    Object.entries(patch).forEach(([key, value]) => {
      if (/^q\d+[a-z]*$/i.test(key)) {
        updateChecklistAnswer(params.studyId, params.checklistId, key, value);
      }
    });
  }

  // Toggle checklist completion status
  function handleToggleComplete() {
    const checklist = currentChecklist();
    if (!checklist) return;

    const newStatus = checklist.status === 'completed' ? 'in-progress' : 'completed';
    updateChecklist(params.studyId, params.checklistId, { status: newStatus });

    if (newStatus === 'completed') {
      showToast.success(
        'Checklist Completed',
        'This checklist has been marked as completed',
      );
    } else {
      showToast.info('Status Updated', 'Checklist marked as in-progress');
    }
  }

  // Compute the current score based on checklist answers
  const currentScore = createMemo(() => {
    const checklist = checklistForUI();
    if (!checklist) return null;
    return scoreChecklist(checklist);
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
        <Show when={currentStudy()}>
          <span class='truncate'>{currentStudy().name}</span>
          <span class='mx-2 text-gray-400'>/</span>
        </Show>
        <span class='text-gray-900 font-medium'>
          {currentChecklist()?.type || 'AMSTAR2'} Checklist
        </span>
      </div>
      <div class='ml-auto flex items-center gap-3'>
        <ScoreTag currentScore={currentScore()} />
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
      </div>
    </>
  );

  return (
    <>
      <Show when={error()}>
        <div class='bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 m-4'>
          Error: {error()}
        </div>
      </Show>

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
          checklist={checklistForUI()}
          onUpdate={handlePartialUpdate}
          headerContent={headerContent}
          pdfData={pdfData()}
          pdfFileName={pdfFileName()}
          onPdfChange={handlePdfChange}
          onPdfClear={handlePdfClear}
        />
      </Show>
    </>
  );
}
