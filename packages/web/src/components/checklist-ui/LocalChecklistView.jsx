/**
 * LocalChecklistView - Wrapper component for viewing/editing local checklists
 * Loads checklist from IndexedDB and saves changes back automatically
 * Supports split-screen PDF viewing with persistent PDF storage
 * Shows create form when no checklistId is provided
 */

import { createSignal, createEffect, Show, onCleanup } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import ChecklistWithPdf from '@checklist-ui/ChecklistWithPdf.jsx';
import CreateLocalChecklist from '@checklist-ui/CreateLocalChecklist.jsx';
import useLocalChecklists from '@primitives/useLocalChecklists.js';

export default function LocalChecklistView() {
  const params = useParams();
  const navigate = useNavigate();
  const { getChecklist, updateChecklist, getPdf, savePdf, deletePdf } = useLocalChecklists();

  const [checklist, setChecklist] = createSignal(null);
  const [pdfData, setPdfData] = createSignal(null);
  const [pdfFileName, setPdfFileName] = createSignal(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal(null);
  const [saveStatus, setSaveStatus] = createSignal('saved');

  // Debounce timer for auto-save
  let saveTimeout = null;

  // Load the checklist and PDF on mount
  createEffect(() => {
    const checklistId = params.checklistId;

    // If no checklistId, show create form (handled in render)
    if (!checklistId) {
      setLoading(false);
      return;
    }

    // Verify it's a local checklist
    if (!checklistId.startsWith('local-')) {
      setError('Invalid local checklist ID');
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

        setChecklist(loaded);

        // Load saved PDF if exists
        if (pdfRecord) {
          setPdfData(pdfRecord.data);
          setPdfFileName(pdfRecord.fileName);
        }

        setLoading(false);
      } catch (err) {
        console.error('Error loading checklist:', err);
        setError(err.message || 'Failed to load checklist');
        setLoading(false);
      }
    })();
  });

  // Cleanup on unmount
  onCleanup(() => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
  });

  // Handle updates from the AMSTAR2Checklist component
  const handleUpdate = updates => {
    // Optimistically update local state
    setChecklist(prev => {
      if (!prev) return prev;
      return { ...prev, ...updates };
    });

    // Debounce the save to IndexedDB
    setSaveStatus('saving');
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    saveTimeout = setTimeout(async () => {
      try {
        const checklistId = params.checklistId;
        await updateChecklist(checklistId, updates);
        setSaveStatus('saved');
      } catch (err) {
        console.error('Error saving checklist:', err);
        setSaveStatus('error');
      }
    }, 500);
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

  // Header content for the toolbar (merged with layout controls)
  const headerContent = (
    <>
      <button
        onClick={handleBack}
        class='inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors'
      >
        <svg
          xmlns='http://www.w3.org/2000/svg'
          class='h-5 w-5'
          fill='none'
          viewBox='0 0 24 24'
          stroke='currentColor'
          stroke-width='2'
        >
          <path stroke-linecap='round' stroke-linejoin='round' d='M15 19l-7-7 7-7' />
        </svg>
        Back
      </button>

      <div class='h-4 w-px bg-gray-300' />

      {/* Local badge */}
      <span class='inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600'>
        Local Only
      </span>

      {/* Save status indicator */}
      <Show when={saveStatus() === 'saving'}>
        <span class='text-sm text-gray-500'>Saving...</span>
      </Show>
      <Show when={saveStatus() === 'saved'}>
        <span class='text-sm text-green-600'>Saved</span>
      </Show>
      <Show when={saveStatus() === 'error'}>
        <span class='text-sm text-red-600'>Save failed</span>
      </Show>
    </>
  );

  return (
    <Show when={params.checklistId} fallback={<CreateLocalChecklist />}>
      <Show
        when={!loading()}
        fallback={
          <div class='flex items-center justify-center min-h-screen bg-blue-50'>
            <div class='text-gray-500'>Loading checklist...</div>
          </div>
        }
      >
        <Show
          when={!error()}
          fallback={
            <div class='flex flex-col items-center justify-center min-h-screen bg-blue-50 gap-4'>
              <div class='text-red-600'>{error()}</div>
              <button
                onClick={handleBack}
                class='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors'
              >
                Go Back
              </button>
            </div>
          }
        >
          <Show when={checklist()}>
            <ChecklistWithPdf
              checklist={checklist()}
              onUpdate={handleUpdate}
              headerContent={headerContent}
              pdfData={pdfData()}
              pdfFileName={pdfFileName()}
              onPdfChange={handlePdfChange}
              onPdfClear={handlePdfClear}
            />
          </Show>
        </Show>
      </Show>
    </Show>
  );
}
