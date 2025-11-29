import { createSignal, createEffect, createMemo, Show, onCleanup } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import ChecklistWithPdf from '@checklist-ui/ChecklistWithPdf.jsx';
import useProject from '@primitives/useProject.js';
import projectStore from '@primitives/projectStore.js';
import { downloadPdf, uploadPdf, deletePdf } from '@api/pdf-api.js';

export default function ChecklistYjsWrapper() {
  const params = useParams();
  const navigate = useNavigate();

  const [pdfData, setPdfData] = createSignal(null);
  const [pdfFileName, setPdfFileName] = createSignal(null);
  const [pdfLoading, setPdfLoading] = createSignal(false);

  // Use full hook for write operations
  const { error, updateChecklistAnswer, getChecklistData } = useProject(params.projectId);

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

  // Load PDF when study has one
  createEffect(() => {
    const pdf = studyPdf();
    if (pdf && !pdfData() && !pdfLoading()) {
      setPdfLoading(true);
      downloadPdf(params.projectId, params.studyId, pdf.fileName)
        .then(data => {
          setPdfData(data);
          setPdfFileName(pdf.fileName);
        })
        .catch(err => {
          console.error('Failed to load PDF:', err);
        })
        .finally(() => {
          setPdfLoading(false);
        });
    }
  });

  // Handle PDF change (upload new PDF)
  const handlePdfChange = async (data, fileName) => {
    try {
      await uploadPdf(params.projectId, params.studyId, data, fileName);
      setPdfData(data);
      setPdfFileName(fileName);
    } catch (err) {
      console.error('Failed to upload PDF:', err);
      alert('Failed to upload PDF');
    }
  };

  // Handle PDF clear (delete PDF)
  const handlePdfClear = async () => {
    const fileName = pdfFileName();
    if (!fileName) return;

    try {
      await deletePdf(params.projectId, params.studyId, fileName);
      setPdfData(null);
      setPdfFileName(null);
    } catch (err) {
      console.error('Failed to delete PDF:', err);
      alert('Failed to delete PDF');
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

  // Header content for the split screen toolbar (left side)
  const headerContent = (
    <>
      <button
        onClick={() => navigate(`/projects/${params.projectId}`)}
        class='text-gray-400 hover:text-gray-700 transition-colors'
      >
        <svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
          <path
            stroke-linecap='round'
            stroke-linejoin='round'
            stroke-width='2'
            d='M15 19l-7-7 7-7'
          />
        </svg>
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
      <Show when={connectionState().connected}>
        <span class='flex items-center gap-1 text-green-600 text-xs whitespace-nowrap'>
          <div class='w-2 h-2 bg-green-500 rounded-full'></div>
          Synced
        </span>
      </Show>
      <Show when={connectionState().connecting}>
        <span class='flex items-center gap-1 text-yellow-600 text-xs whitespace-nowrap'>
          <div class='w-2 h-2 bg-yellow-500 rounded-full animate-pulse'></div>
          Connecting...
        </span>
      </Show>
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
