/**
 * AddStudiesForm - Unified component for adding studies to a project
 * Supports four methods: PDF uploads, reference file imports, DOI/PMID lookups, and Google Drive
 * Can be used both during project creation and when adding studies to existing projects
 */

import { createSignal, createEffect, Show, onMount, onCleanup } from 'solid-js';
import { BiRegularPlus } from 'solid-icons/bi';
import { AiOutlineCloudUpload } from 'solid-icons/ai';
import { FiChevronUp } from 'solid-icons/fi';
import { Tabs } from '@components/zag/Tabs.jsx';
import { showToast } from '@components/zag/Toast.jsx';
import projectStore from '@/stores/projectStore.js';

import { useAddStudies } from '@primitives/useAddStudies.js';
import { AddStudiesProvider } from './add-studies/AddStudiesContext.jsx';
import PdfUploadSection from './add-studies/PdfUploadSection.jsx';
import ReferenceImportSection from './add-studies/ReferenceImportSection.jsx';
import DoiLookupSection from './add-studies/DoiLookupSection.jsx';
import GoogleDriveSection from './add-studies/GoogleDriveSection.jsx';

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
        <div class='fixed inset-0 bg-blue-500/10 z-50 flex items-center justify-center pointer-events-none'>
          <div class='bg-white border-2 border-dashed border-blue-500 rounded-xl p-8 shadow-lg'>
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
            class='inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm'
          >
            <BiRegularPlus class='w-4 h-4' />
            Add Studies
          </button>
        </div>
      </Show>

      {/* Expanded form */}
      <Show when={isExpanded()}>
        <div
          class={`${props.collectMode ? '' : 'bg-white border border-gray-200 rounded-lg shadow-sm p-6'}`}
        >
          <Show when={!props.alwaysExpanded && !props.collectMode}>
            <div class='flex items-center justify-between mb-4'>
              <h3 class='text-lg font-semibold text-gray-900'>Add Studies</h3>
              <button
                type='button'
                onClick={handleCollapse}
                class='p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors'
              >
                <FiChevronUp class='w-5 h-5' />
              </button>
            </div>
          </Show>

          <Tabs
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
                    <span class='inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full'>
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

          <AddStudiesProvider
            studies={studies}
            formType={props.formType}
            projectId={props.projectId}
            onSaveFormState={handleSaveFormState}
          >
            <div class='mt-4'>
              <Show when={activeTab() === 'pdfs'}>
                <PdfUploadSection />
              </Show>

              <Show when={activeTab() === 'references'}>
                <ReferenceImportSection />
              </Show>

              <Show when={activeTab() === 'lookup'}>
                <DoiLookupSection />
              </Show>

              <Show when={activeTab() === 'drive'}>
                <GoogleDriveSection />
              </Show>
            </div>
          </AddStudiesProvider>

          {/* Summary and Actions - hidden in collect mode since parent handles submission */}
          <Show when={studies.totalStudyCount() > 0 && !props.collectMode}>
            <div class='mt-4 pt-4 border-t border-gray-200'>
              <div class='flex items-center justify-between'>
                <div class='text-sm text-gray-600'>
                  <span class='font-medium'>{studies.totalStudyCount()}</span>{' '}
                  {studies.totalStudyCount() === 1 ? 'study' : 'studies'} ready to add
                  <span class='text-gray-400 ml-2'>
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
                      class='px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors'
                    >
                      Cancel
                    </button>
                  </Show>
                  <button
                    type='button'
                    onClick={handleSubmit}
                    disabled={isSubmitting() || studies.totalStudyCount() === 0}
                    class='inline-flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors'
                  >
                    <Show
                      when={!isSubmitting()}
                      fallback={
                        <>
                          <div class='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin' />
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
          class='border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 hover:bg-blue-50/50 transition-colors cursor-pointer'
          onClick={handleExpand}
        >
          <AiOutlineCloudUpload class='w-12 h-12 text-gray-400 mx-auto mb-3' />
          <p class='text-gray-600 font-medium'>Add Studies to Your Project</p>
          <p class='text-sm text-gray-500 mt-1'>
            Upload PDFs, import from reference managers, or look up by DOI/PMID
          </p>
        </div>
      </Show>
    </div>
  );
}
