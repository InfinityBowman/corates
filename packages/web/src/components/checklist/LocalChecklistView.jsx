/**
 * LocalChecklistView - Wrapper component for viewing/editing local checklists
 * Loads checklist from IndexedDB and saves changes back automatically
 * Supports split-screen PDF viewing with persistent PDF storage
 * Shows create form when no checklistId is provided
 * Supports multiple checklist types via the registry
 */

import { createSignal, createEffect, Show, onCleanup, createMemo } from 'solid-js';
import { debounce } from '@solid-primitives/scheduled';
import { useParams, useNavigate, useSearchParams } from '@solidjs/router';
import ChecklistWithPdf from '@/components/checklist/ChecklistWithPdf.jsx';
import CreateLocalChecklist from '@/components/checklist/CreateLocalChecklist.jsx';
import localChecklistsStore from '@/stores/localChecklistsStore';
import { getChecklistTypeFromState, scoreChecklistOfType } from '@/checklist-registry';
import { IoChevronBack } from 'solid-icons/io';
import ScoreTag from '@/components/checklist/ScoreTag.jsx';
import { createLocalAdapterFactories } from '@/components/checklist/common/LocalTextAdapter.js';

export default function LocalChecklistView() {
  const params = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { getChecklist, updateChecklist, getPdf, savePdf, deletePdf } = localChecklistsStore;

  const [checklist, setChecklist] = createSignal(null);
  const [pdfData, setPdfData] = createSignal(null);
  const [pdfFileName, setPdfFileName] = createSignal(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal(null);

  // Debounced save function always saves the full current checklist state
  // to avoid race conditions where rapid partial updates could overwrite each other.
  // Ignores arguments and reads checklist() when it fires to get the latest merged state.
  // eslint-disable-next-line solid/reactivity
  const debouncedSave = debounce(async () => {
    try {
      const current = checklist();
      if (current) {
        await updateChecklist(params.checklistId, current);
      }
    } catch (err) {
      console.error('Error saving checklist:', err);
    }
  }, 500);

  // Create adapter factories for text fields
  const { getRob2Text, getQuestionNote, getRobinsText, clearCache } = createLocalAdapterFactories(
    // eslint-disable-next-line solid/reactivity
    () => checklist(),
    setChecklist,
    debouncedSave,
  );

  // Load the checklist and PDF on mount
  createEffect(() => {
    const checklistId = params.checklistId;

    // If no checklistId, show create form (handled in render)
    if (!checklistId) {
      setLoading(false);
      return;
    }

    // Handle async loading inside the effect
    (async () => {
      try {
        setLoading(true);

        // Load checklist and PDF in parallel
        const [loaded, pdfRecord] = await Promise.all([
          getChecklist(checklistId),
          getPdf(checklistId),
        ]);

        if (!loaded) {
          setError('Checklist not found');
          setLoading(false);
          return;
        }

        // Clear adapter cache when loading new data to prevent stale values
        clearCache();
        setChecklist(loaded);

        // Load saved PDF if exists
        if (pdfRecord) {
          setPdfData(pdfRecord.data);
          setPdfFileName(pdfRecord.fileName);
        }

        setLoading(false);
      } catch (err) {
        const { handleError } = await import('@/lib/error-utils.js');
        await handleError(err, {
          setError,
          showToast: false,
        });
        setLoading(false);
      }
    })();
  });

  // Cleanup on unmount
  onCleanup(() => {
    debouncedSave.clear();
    clearCache();
  });

  // Handle updates from checklist components (answers, judgements, etc.)
  const handleUpdate = updates => {
    setChecklist(prev => {
      if (!prev) return prev;
      return { ...prev, ...updates };
    });

    // Clear adapter cache to ensure text fields sync with new state
    clearCache();

    // Trigger debounced save - it will read checklist() when it fires
    debouncedSave();
  };

  // Handle PDF change
  const handlePdfChange = async (data, fileName) => {
    const checklistId = params.checklistId;
    if (!checklistId) return;

    // Update local state immediately
    setPdfData(data);
    setPdfFileName(fileName);

    // Save to IndexedDB
    try {
      await savePdf(checklistId, data, fileName);
    } catch (err) {
      console.error('Error saving PDF:', err);
    }
  };

  // Handle PDF clear
  const handlePdfClear = async () => {
    const checklistId = params.checklistId;
    if (!checklistId) return;

    // Update local state immediately
    setPdfData(null);
    setPdfFileName(null);

    // Delete from IndexedDB
    try {
      await deletePdf(checklistId);
    } catch (err) {
      console.error('Error deleting PDF:', err);
    }
  };

  const handleBack = () => {
    navigate('/dashboard');
  };

  // Get the checklist type from the loaded checklist
  const checklistType = () => {
    const curr = checklist();
    if (!curr) return null;
    return getChecklistTypeFromState(curr);
  };

  // Compute the current score based on checklist answers
  const currentScore = createMemo(() => {
    const curr = checklist();
    const type = checklistType();
    if (!curr || !type) return null;
    return scoreChecklistOfType(type, curr);
  });

  // Header content for the toolbar
  const headerContent = (
    <>
      <button
        onClick={handleBack}
        class='text-muted-foreground hover:text-foreground inline-flex items-center gap-2 transition-colors'
      >
        <IoChevronBack size={20} />
        Back
      </button>

      <div class='bg-border h-4 w-px' />

      <span class='bg-secondary text-muted-foreground inline-flex items-center rounded px-2 py-0.5 text-xs font-medium'>
        Local Only
      </span>
      <ScoreTag currentScore={currentScore()} checklistType={checklistType()} />
    </>
  );

  return (
    <Show when={params.checklistId} fallback={<CreateLocalChecklist type={searchParams.type} />}>
      <Show
        when={!loading()}
        fallback={
          <div class='flex min-h-screen items-center justify-center bg-blue-50'>
            <div class='text-muted-foreground'>Loading checklist...</div>
          </div>
        }
      >
        <Show
          when={!error()}
          fallback={
            <div class='flex min-h-screen flex-col items-center justify-center gap-4 bg-blue-50'>
              <div class='text-red-600'>{error()}</div>
              <button
                onClick={handleBack}
                class='rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700'
              >
                Go Back
              </button>
            </div>
          }
        >
          <Show when={checklist()}>
            <ChecklistWithPdf
              checklistType={checklistType()}
              checklist={checklist()}
              onUpdate={handleUpdate}
              headerContent={headerContent}
              pdfData={pdfData()}
              pdfFileName={pdfFileName()}
              onPdfChange={handlePdfChange}
              onPdfClear={handlePdfClear}
              allowDelete={true}
              getQuestionNote={getQuestionNote}
              getRob2Text={getRob2Text}
              getRobinsText={getRobinsText}
            />
          </Show>
        </Show>
      </Show>
    </Show>
  );
}
