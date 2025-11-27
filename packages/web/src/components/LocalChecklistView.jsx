/**
 * LocalChecklistView - Wrapper component for viewing/editing local checklists
 * Loads checklist from IndexedDB and saves changes back automatically
 */

import { createSignal, createEffect, Show, onCleanup } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import AMSTAR2Checklist from '@components/AMSTAR2Checklist.jsx';
import useLocalChecklists from '@primitives/useLocalChecklists.js';

export default function LocalChecklistView() {
  const params = useParams();
  const navigate = useNavigate();
  const { getChecklist, updateChecklist } = useLocalChecklists();

  const [checklist, setChecklist] = createSignal(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal(null);
  const [saveStatus, setSaveStatus] = createSignal('saved');

  // Debounce timer for auto-save
  let saveTimeout = null;

  // Load the checklist on mount
  createEffect(async () => {
    const checklistId = params.checklistId;
    if (!checklistId) {
      setError('No checklist ID provided');
      setLoading(false);
      return;
    }

    // Verify it's a local checklist
    if (!checklistId.startsWith('local-')) {
      setError('Invalid local checklist ID');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const loaded = await getChecklist(checklistId);
      if (!loaded) {
        setError('Checklist not found');
        setLoading(false);
        return;
      }
      setChecklist(loaded);
      setLoading(false);
    } catch (err) {
      console.error('Error loading checklist:', err);
      setError(err.message || 'Failed to load checklist');
      setLoading(false);
    }
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

  const handleBack = () => {
    navigate('/dashboard');
  };

  return (
    <div class='min-h-screen bg-blue-50'>
      {/* Navigation bar */}
      <div class='bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10'>
        <div class='max-w-5xl mx-auto flex items-center justify-between'>
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
            Back to Checklists
          </button>

          <div class='flex items-center gap-3'>
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
          </div>
        </div>
      </div>

      {/* Content */}
      <Show
        when={!loading()}
        fallback={
          <div class='flex items-center justify-center min-h-[50vh]'>
            <div class='text-gray-500'>Loading checklist...</div>
          </div>
        }
      >
        <Show
          when={!error()}
          fallback={
            <div class='flex flex-col items-center justify-center min-h-[50vh] gap-4'>
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
            <AMSTAR2Checklist externalChecklist={checklist()} onExternalUpdate={handleUpdate} />
          </Show>
        </Show>
      </Show>
    </div>
  );
}
