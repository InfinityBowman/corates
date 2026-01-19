import { createSignal, createEffect, Show, onMount, onCleanup, For } from 'solid-js';
import { BiRegularPlus } from 'solid-icons/bi';
import { AiOutlineCloudUpload } from 'solid-icons/ai';
import { FiUpload, FiLink, FiFileText, FiFolder, FiX } from 'solid-icons/fi';
import { showToast } from '@/components/ui/toast';
import { Tabs, TabsList, TabsTrigger, TabsIndicator } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import projectStore from '@/stores/projectStore.js';

import { useAddStudies } from '@primitives/useAddStudies.js';
import PdfUploadSection from './PdfUploadSection.jsx';
import ReferenceImportSection from './ReferenceImportSection.jsx';
import DoiLookupSection from './DoiLookupSection.jsx';
import GoogleDriveSection from './GoogleDriveSection.jsx';
import StagedStudiesSection from './StagedStudiesSection.jsx';

/**
 * AddStudiesForm - Unified component for adding studies to a project
 * Supports four methods: PDF uploads, reference file imports, DOI/PMID lookups, and Google Drive
 * Can be used both during project creation and when adding studies to existing projects
 *
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
    { value: 'pdfs', label: 'Upload PDFs', icon: <FiUpload class='h-4 w-4' /> },
    { value: 'references', label: 'Import References', icon: <FiFileText class='h-4 w-4' /> },
    { value: 'lookup', label: 'DOI / PMID', icon: <FiLink class='h-4 w-4' /> },
    { value: 'drive', label: 'Google Drive', icon: <FiFolder class='h-4 w-4' /> },
  ];

  return (
    <div ref={containerRef} class='relative'>
      {/* Drag overlay */}
      <Show when={isDraggingOver() && hasExistingStudies() && !isExpanded()}>
        <div class='pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-blue-500/10'>
          <div class='bg-card rounded-xl border-2 border-dashed border-blue-500 p-8 shadow-lg'>
            <p class='text-lg font-medium text-blue-600'>Drop PDFs to add studies</p>
          </div>
        </div>
      </Show>

      {/* Card container when has existing studies */}
      <Show when={hasExistingStudies() && !props.alwaysExpanded}>
        <div class='border-border bg-card overflow-hidden rounded-lg border shadow-sm'>
          {/* Header */}
          <div class='flex items-center justify-between px-4 py-3'>
            <div class='flex items-center gap-3'>
              <div class='bg-primary-subtle text-primary flex h-9 w-9 items-center justify-center rounded-lg'>
                <BiRegularPlus class='h-5 w-5' />
              </div>
              <div>
                <h3 class='text-foreground text-sm font-semibold'>Add Studies</h3>
                <p class='text-muted-foreground text-xs'>
                  {studies.totalStudyCount() > 0 ?
                    `${studies.totalStudyCount()} staged`
                  : 'Upload PDFs, import references, or look up by DOI'}
                </p>
              </div>
            </div>
            <button
              type='button'
              onClick={() => setExpanded(!expanded())}
              class='flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors'
              classList={{
                'bg-primary text-white': isExpanded(),
                'bg-primary-subtle text-primary hover:bg-primary/20': !isExpanded(),
              }}
            >
              <Show when={isExpanded()} fallback={<BiRegularPlus class='h-4 w-4' />}>
                <FiX class='h-4 w-4' />
              </Show>
              {isExpanded() ? 'Close' : 'Add'}
            </button>
          </div>

          {/* Collapsible content */}
          <Collapsible open={isExpanded()} onOpenChange={setExpanded}>
            <CollapsibleContent>
              <div class='border-border border-t px-6 pt-4 pb-6'>
                <Tabs value={activeTab()} onValueChange={v => setActiveTab(v)}>
                  <TabsList class='relative flex gap-1 overflow-x-auto pb-px'>
                    <For each={tabs}>
                      {tab => {
                        const getCount = () => {
                          if (tab.value === 'pdfs') return studies.pdfCount();
                          if (tab.value === 'references') return studies.refCount();
                          if (tab.value === 'lookup') return studies.lookupCount();
                          if (tab.value === 'drive') return studies.driveCount();
                          return 0;
                        };
                        return (
                          <TabsTrigger
                            value={tab.value}
                            class='group text-muted-foreground hover:bg-muted hover:text-secondary-foreground data-selected:text-foreground relative gap-2 rounded-t-lg px-4 py-2.5 transition-all'
                          >
                            <span class='opacity-60 transition-opacity group-data-selected:opacity-100'>
                              {tab.icon}
                            </span>
                            <span class='font-medium'>{tab.label}</span>
                            <Show when={getCount() > 0}>
                              <span class='bg-secondary text-secondary-foreground group-data-selected:bg-primary-subtle group-data-selected:text-primary min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs font-medium tabular-nums transition-colors'>
                                {getCount()}
                              </span>
                            </Show>
                          </TabsTrigger>
                        );
                      }}
                    </For>
                    <TabsIndicator class='bg-primary h-0.5 rounded-full' />
                  </TabsList>
                </Tabs>

                <div class='mt-4'>
                  <Show when={activeTab() === 'pdfs'}>
                    <PdfUploadSection studies={studies} />
                  </Show>

                  <Show when={activeTab() === 'references'}>
                    <ReferenceImportSection
                      studies={studies}
                      onSaveFormState={handleSaveFormState}
                    />
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

                {/* Unified Staged Studies Section */}
                <StagedStudiesSection studies={studies} />

                {/* Actions - hidden in collect mode since parent handles submission */}
                <Show when={studies.totalStudyCount() > 0 && !props.collectMode}>
                  <div class='border-border mt-4 flex items-center justify-end gap-2 border-t pt-4'>
                    <button
                      type='button'
                      onClick={handleCancel}
                      class='text-secondary-foreground hover:bg-secondary hover:text-foreground rounded-lg px-3 py-1.5 text-sm transition-colors'
                    >
                      Cancel
                    </button>
                    <button
                      type='button'
                      onClick={handleSubmit}
                      disabled={isSubmitting() || studies.totalStudyCount() === 0}
                      class='bg-primary hover:bg-primary/90 focus:ring-primary inline-flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium text-white transition-colors focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'
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
                </Show>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </Show>

      {/* Always expanded mode - standalone card */}
      <Show when={props.alwaysExpanded}>
        <div
          class={props.collectMode ? '' : 'border-border bg-card rounded-lg border p-6 shadow-sm'}
        >
          <Tabs value={activeTab()} onValueChange={v => setActiveTab(v)}>
            <TabsList class='relative flex gap-1 overflow-x-auto pb-px'>
              <For each={tabs}>
                {tab => {
                  const getCount = () => {
                    if (tab.value === 'pdfs') return studies.pdfCount();
                    if (tab.value === 'references') return studies.refCount();
                    if (tab.value === 'lookup') return studies.lookupCount();
                    if (tab.value === 'drive') return studies.driveCount();
                    return 0;
                  };
                  return (
                    <TabsTrigger
                      value={tab.value}
                      class='group text-muted-foreground hover:bg-muted hover:text-secondary-foreground data-selected:text-foreground relative gap-2 rounded-t-lg px-4 py-2.5 transition-all'
                    >
                      <span class='opacity-60 transition-opacity group-data-selected:opacity-100'>
                        {tab.icon}
                      </span>
                      <span class='font-medium'>{tab.label}</span>
                      <Show when={getCount() > 0}>
                        <span class='bg-secondary text-secondary-foreground group-data-selected:bg-primary-subtle group-data-selected:text-primary min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs font-medium tabular-nums transition-colors'>
                          {getCount()}
                        </span>
                      </Show>
                    </TabsTrigger>
                  );
                }}
              </For>
              <TabsIndicator class='bg-primary h-0.5 rounded-full' />
            </TabsList>
          </Tabs>

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

          <StagedStudiesSection studies={studies} />

          <Show when={studies.totalStudyCount() > 0 && !props.collectMode}>
            <div class='border-border mt-4 flex items-center justify-end gap-2 border-t pt-4'>
              <button
                type='button'
                onClick={handleSubmit}
                disabled={isSubmitting() || studies.totalStudyCount() === 0}
                class='bg-primary hover:bg-primary/90 focus:ring-primary inline-flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium text-white transition-colors focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'
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
          </Show>
        </div>
      </Show>

      {/* Empty project - drop zone or expanded form */}
      <Show when={!hasExistingStudies() && !props.alwaysExpanded}>
        <Show
          when={!isExpanded()}
          fallback={
            <div class='border-border bg-card overflow-hidden rounded-lg border shadow-sm'>
              <div class='p-6'>
                <Tabs value={activeTab()} onValueChange={v => setActiveTab(v)}>
                  <TabsList class='relative flex gap-1 overflow-x-auto pb-px'>
                    <For each={tabs}>
                      {tab => {
                        const getCount = () => {
                          if (tab.value === 'pdfs') return studies.pdfCount();
                          if (tab.value === 'references') return studies.refCount();
                          if (tab.value === 'lookup') return studies.lookupCount();
                          if (tab.value === 'drive') return studies.driveCount();
                          return 0;
                        };
                        return (
                          <TabsTrigger
                            value={tab.value}
                            class='group text-muted-foreground hover:bg-muted hover:text-secondary-foreground data-selected:text-foreground relative gap-2 rounded-t-lg px-4 py-2.5 transition-all'
                          >
                            <span class='opacity-60 transition-opacity group-data-selected:opacity-100'>
                              {tab.icon}
                            </span>
                            <span class='font-medium'>{tab.label}</span>
                            <Show when={getCount() > 0}>
                              <span class='bg-secondary text-secondary-foreground group-data-selected:bg-primary-subtle group-data-selected:text-primary min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs font-medium tabular-nums transition-colors'>
                                {getCount()}
                              </span>
                            </Show>
                          </TabsTrigger>
                        );
                      }}
                    </For>
                    <TabsIndicator class='bg-primary h-0.5 rounded-full' />
                  </TabsList>
                </Tabs>

                <div class='mt-4'>
                  <Show when={activeTab() === 'pdfs'}>
                    <PdfUploadSection studies={studies} />
                  </Show>
                  <Show when={activeTab() === 'references'}>
                    <ReferenceImportSection
                      studies={studies}
                      onSaveFormState={handleSaveFormState}
                    />
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

                <StagedStudiesSection studies={studies} />

                <Show when={studies.totalStudyCount() > 0 && !props.collectMode}>
                  <div class='border-border mt-4 flex items-center justify-end gap-2 border-t pt-4'>
                    <button
                      type='button'
                      onClick={handleCancel}
                      class='text-secondary-foreground hover:bg-secondary hover:text-foreground rounded-lg px-3 py-1.5 text-sm transition-colors'
                    >
                      Cancel
                    </button>
                    <button
                      type='button'
                      onClick={handleSubmit}
                      disabled={isSubmitting() || studies.totalStudyCount() === 0}
                      class='bg-primary hover:bg-primary/90 focus:ring-primary inline-flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium text-white transition-colors focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'
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
                </Show>
              </div>
            </div>
          }
        >
          <div
            class='border-border cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors hover:border-blue-500 hover:bg-blue-50/50'
            onClick={handleExpand}
          >
            <AiOutlineCloudUpload class='text-muted-foreground/70 mx-auto mb-3 h-12 w-12' />
            <p class='text-secondary-foreground font-medium'>Add Studies to Your Project</p>
            <p class='text-muted-foreground mt-1 text-sm'>
              Upload PDFs, import from reference managers, or look up by DOI/PMID
            </p>
          </div>
        </Show>
      </Show>
    </div>
  );
}
