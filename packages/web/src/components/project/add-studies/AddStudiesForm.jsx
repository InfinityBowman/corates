/**
 * AddStudiesForm - Unified component for adding studies to a project
 * Supports four methods: PDF uploads, reference file imports, DOI/PMID lookups, and Google Drive
 * Can be used both during project creation and when adding studies to existing projects
 */

import { createSignal, createEffect, Show, onMount, onCleanup } from 'solid-js';
import { BiRegularPlus } from 'solid-icons/bi';
import { AiOutlineCloudUpload } from 'solid-icons/ai';
import { FiChevronUp } from 'solid-icons/fi';
import { Tabs, showToast } from '@corates/ui';
import projectStore from '@/stores/projectStore.js';

import { useAddStudies } from '@primitives/useAddStudies.js';
import PdfUploadSection from './PdfUploadSection.jsx';
import ReferenceImportSection from './ReferenceImportSection.jsx';
import DoiLookupSection from './DoiLookupSection.jsx';
import GoogleDriveSection from './GoogleDriveSection.jsx';

/**
 * @param {Object} props
 * @param {string} [props.projectId] - Project ID to read existing studies from store (not used in collectMode)
 * @param {Function} [props.onAddStudies] - Called with studies to add: async (studies: Array) => void (not used in collectMode)
 * @param {boolean} [props.alwaysExpanded] - If true, the form is always shown expanded (typically used with collectMode)
 * @param {boolean} [props.collectMode] - If true, hides submit button and calls onStudiesChange with raw data
 * @param {Function} [props.onStudiesChange] - Called with collected data in collectMode: ({ pdfs, refs, lookups, driveFiles }) => void
 * @param {'createProject' | 'addStudies'} [props.formType] - Form type for OAuth state persistence
 * @param {Object} [props.initialState] - Initial state to restore (from OAuth redirect)
 * @param {() => Object} [props.getExternalState] - Gets additional state to save (e.g., project name/description)
 * @param {(state: Object) => void} [props.onSaveState] - Called when state should be saved (before OAuth redirect)
 */
export default function AddStudiesForm(props) {
  const [expanded, setExpanded] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal('pdfs');
  const [isDraggingOver, setIsDraggingOver] = createSignal(false);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  let containerRef;

  // Use the add studies primitive for all state management
  const studies = useAddStudies({
    collectMode: () => props.collectMode,
    onStudiesChange: data => props.onStudiesChange?.(data),
  });

  // Track if we've already restored state to avoid duplicate restores
  let hasRestoredState = false;

  // Restore state if initialState provided (after OAuth redirect)
  // Use createEffect instead of onMount because initialState may be set asynchronously
  createEffect(() => {
    const initialState = props.initialState;
    if (initialState?.studiesState && !hasRestoredState) {
      hasRestoredState = true;
      studies.restoreState(initialState.studiesState);
      // If we have restored state, ensure the form is expanded
      if (studies.hasAnyStudies()) {
        setExpanded(true);
        // Switch to Google Drive tab since that's where the user was
        setActiveTab('drive');
      }
    }
  });

  // Handler to save form state before OAuth redirect
  const handleSaveFormState = async () => {
    const studiesState = studies.getSerializableState();
    const externalState = props.getExternalState?.() || {};

    // Call the parent's save handler with combined state
    await props.onSaveState?.({
      studiesState,
      ...externalState,
    });
  };

  // Read from store if projectId provided, otherwise assume no existing studies
  const hasExistingStudies = () => {
    if (props.collectMode) return false;
    if (!props.projectId) return false;
    return projectStore.getStudies(props.projectId).length > 0;
  };

  const isExpanded = () => {
    if (props.alwaysExpanded) return true;
    return expanded() || studies.hasAnyStudies();
  };

  const handleExpand = () => setExpanded(true);
  const handleCollapse = () => setExpanded(false);

  // Global drag-and-drop for collapsed state
  onMount(() => {
    if (props.alwaysExpanded) return;

    const handleDragEnter = e => {
      if (hasExistingStudies() && !isExpanded() && e.dataTransfer?.types?.includes('Files')) {
        setIsDraggingOver(true);
      }
    };

    const handleDragLeave = e => {
      if (containerRef && !containerRef.contains(e.relatedTarget)) {
        setIsDraggingOver(false);
      }
    };

    const handleDragOver = e => {
      if (hasExistingStudies() && !isExpanded() && isDraggingOver()) {
        e.preventDefault();
      }
    };

    const handleDrop = async e => {
      if (hasExistingStudies() && !isExpanded() && isDraggingOver()) {
        e.preventDefault();
        setIsDraggingOver(false);
        const files = Array.from(e.dataTransfer?.files || []);
        if (files.length > 0) {
          handleExpand();
          await handlePdfSelect(files);
        }
      }
    };

    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);

    onCleanup(() => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDrop);
    });
  });

  // PDF handlers - delegate to primitive with UI state updates
  const handlePdfSelect = async files => {
    handleExpand();
    setActiveTab('pdfs');
    await studies.handlePdfSelect(files);
  };

  // Submit handler - awaits onAddStudies and auto-collapses on success
  const handleSubmit = async () => {
    const studiesToAdd = studies.getStudiesToSubmit();

    if (studiesToAdd.length === 0) {
      showToast.warning('No Studies', 'Please add at least one study to import.');
      return;
    }

    setIsSubmitting(true);
    try {
      await props.onAddStudies(studiesToAdd);
      // Clear state and collapse on success
      studies.clearAll();
      setExpanded(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    studies.clearAll();
    setExpanded(false);
  };

  const tabs = [
    { value: 'pdfs', label: 'Upload PDFs' },
    { value: 'references', label: 'Import References' },
    { value: 'lookup', label: 'DOI / PMID' },
    { value: 'drive', label: 'Google Drive' },
  ];

  return (
    <div ref={containerRef} class='relative'>
      {/* Drag overlay */}
      <Show when={isDraggingOver() && hasExistingStudies() && !isExpanded()}>
        <div class='pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-blue-500/10'>
          <div class='rounded-xl border-2 border-dashed border-blue-500 bg-white p-8 shadow-lg'>
            <p class='text-lg font-medium text-blue-600'>Drop PDFs to add studies</p>
          </div>
        </div>
      </Show>

      {/* Collapsed button */}
      <Show when={!isExpanded() && hasExistingStudies()}>
        <div class='flex justify-end'>
          <button
            type='button'
            onClick={handleExpand}
            class='inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700'
          >
            <BiRegularPlus class='h-4 w-4' />
            Add Studies
          </button>
        </div>
      </Show>

      {/* Expanded form */}
      <Show when={isExpanded()}>
        <div
          class={`${props.collectMode ? '' : 'rounded-lg border border-gray-200 bg-white p-6 shadow-sm'}`}
        >
          <Show when={!props.alwaysExpanded && !props.collectMode}>
            <div class='mb-4 flex items-center justify-between'>
              <h3 class='text-lg font-semibold text-gray-900'>Add Studies</h3>
              <button
                type='button'
                onClick={handleCollapse}
                class='rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600'
              >
                <FiChevronUp class='h-5 w-5' />
              </button>
            </div>
          </Show>

          <Tabs
            variant='underline'
            value={activeTab()}
            onValueChange={v => setActiveTab(v)}
            tabs={tabs.map(t => ({
              ...t,
              label: (
                <span class='flex items-center gap-2'>
                  {t.label}
                  <Show
                    when={
                      (t.value === 'pdfs' && studies.pdfCount() > 0) ||
                      (t.value === 'references' && studies.refCount() > 0) ||
                      (t.value === 'lookup' && studies.lookupCount() > 0) ||
                      (t.value === 'drive' && studies.driveCount() > 0)
                    }
                  >
                    <span class='inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-100 px-1.5 text-xs font-medium text-blue-700'>
                      {t.value === 'pdfs' ?
                        studies.pdfCount()
                      : t.value === 'references' ?
                        studies.refCount()
                      : t.value === 'lookup' ?
                        studies.lookupCount()
                      : studies.driveCount()}
                    </span>
                  </Show>
                </span>
              ),
            }))}
          />

          <div class='mt-4'>
            <Show when={activeTab() === 'pdfs'}>
              <PdfUploadSection studies={studies} />
            </Show>

            <Show when={activeTab() === 'references'}>
              <ReferenceImportSection studies={studies} onSaveFormState={handleSaveFormState} />
            </Show>

            <Show when={activeTab() === 'lookup'}>
              <DoiLookupSection studies={studies} onSaveFormState={handleSaveFormState} />
            </Show>

            <Show when={activeTab() === 'drive'}>
              <GoogleDriveSection
                studies={studies}
                formType={props.formType}
                projectId={props.projectId}
                onSaveFormState={handleSaveFormState}
              />
            </Show>
          </div>

          {/* Summary and Actions - hidden in collect mode since parent handles submission */}
          <Show when={studies.totalStudyCount() > 0 && !props.collectMode}>
            <div class='mt-4 border-t border-gray-200 pt-4'>
              <div class='flex items-center justify-between'>
                <div class='text-sm text-gray-600'>
                  <span class='font-medium'>{studies.totalStudyCount()}</span>{' '}
                  {studies.totalStudyCount() === 1 ? 'study' : 'studies'} ready to add
                  <span class='ml-2 text-gray-400'>
                    (
                    {[
                      studies.pdfCount() > 0 ?
                        `${studies.pdfCount()} PDF${studies.pdfCount() > 1 ? 's' : ''}`
                      : null,
                      studies.refCount() > 0 ? `${studies.refCount()} imported` : null,
                      studies.lookupCount() > 0 ? `${studies.lookupCount()} from lookup` : null,
                      studies.driveCount() > 0 ? `${studies.driveCount()} from Drive` : null,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                    )
                  </span>
                </div>
                <div class='flex items-center gap-2'>
                  <Show when={!props.alwaysExpanded}>
                    <button
                      type='button'
                      onClick={handleCancel}
                      class='rounded-lg px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-800'
                    >
                      Cancel
                    </button>
                  </Show>
                  <button
                    type='button'
                    onClick={handleSubmit}
                    disabled={isSubmitting() || studies.totalStudyCount() === 0}
                    class='inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'
                  >
                    <Show
                      when={!isSubmitting()}
                      fallback={
                        <>
                          <div class='h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent' />
                          Adding...
                        </>
                      }
                    >
                      Add {studies.totalStudyCount()}{' '}
                      {studies.totalStudyCount() === 1 ? 'Study' : 'Studies'}
                    </Show>
                  </button>
                </div>
              </div>
            </div>
          </Show>
        </div>
      </Show>

      {/* Initial drop zone for empty projects */}
      <Show when={!isExpanded() && !hasExistingStudies()}>
        <div
          class='cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-8 text-center transition-colors hover:border-blue-500 hover:bg-blue-50/50'
          onClick={handleExpand}
        >
          <AiOutlineCloudUpload class='mx-auto mb-3 h-12 w-12 text-gray-400' />
          <p class='font-medium text-gray-600'>Add Studies to Your Project</p>
          <p class='mt-1 text-sm text-gray-500'>
            Upload PDFs, import from reference managers, or look up by DOI/PMID
          </p>
        </div>
      </Show>
    </div>
  );
}
