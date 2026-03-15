/**
 * AddStudiesForm - Unified component for adding studies to a project
 * Supports four methods: PDF uploads, reference file imports, DOI/PMID lookups, and Google Drive.
 * Can be used both during project creation and when adding studies to existing projects.
 *
 * Three UI modes:
 * 1. Collapsible card (hasExistingStudies && !alwaysExpanded) - toggle between collapsed header and expanded form
 * 2. Always expanded (!hasExistingStudies && !alwaysExpanded) - dashed dropzone or expanded form
 * 3. Always expanded (alwaysExpanded) - standalone card, optionally bare in collectMode
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  PlusIcon,
  XIcon,
  CloudUploadIcon,
  UploadIcon,
  FileTextIcon,
  LinkIcon,
  FolderIcon,
} from 'lucide-react';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { showToast } from '@/components/ui/toast';
import { useProjectStore } from '@/stores/projectStore';
import { useAddStudies } from '@/hooks/useAddStudies/index.js';

import { PdfUploadSection } from './PdfUploadSection';
import { ReferenceImportSection } from './ReferenceImportSection';
import { DoiLookupSection } from './DoiLookupSection';
import { GoogleDriveSection } from './GoogleDriveSection';
import { StagedStudiesSection } from './StagedStudiesSection';

/* eslint-disable no-unused-vars */
interface AddStudiesFormProps {
  projectId?: string;
  onAddStudies?: (studies: any[]) => Promise<void>;
  alwaysExpanded?: boolean;
  collectMode?: boolean;
  onStudiesChange?: (data: {
    pdfs: any[];
    refs: any[];
    lookups: any[];
    driveFiles: any[];
  }) => void;
  formType?: 'createProject' | 'addStudies';
  initialState?: any;
  getExternalState?: () => Record<string, unknown>;
  onSaveState?: (state: any) => Promise<void>;
}
/* eslint-enable no-unused-vars */

export function AddStudiesForm({
  projectId,
  onAddStudies,
  alwaysExpanded = false,
  collectMode = false,
  onStudiesChange,
  formType,
  initialState,
  getExternalState,
  onSaveState,
}: AddStudiesFormProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('pdfs');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasRestoredRef = useRef(false);

  const studies = useAddStudies({
    collectMode,
    onStudiesChange,
  });

  // Check if project has existing studies via store
  const existingStudyCount = useProjectStore(
    s => (projectId ? s.projects[projectId]?.studies?.length ?? 0 : 0),
  );
  const hasExistingStudies = !collectMode && !!projectId && existingStudyCount > 0;

  const isExpanded = alwaysExpanded || expanded || studies.hasAnyStudies();

  // Refs for drag-and-drop handlers to avoid stale closures
  const hasExistingStudiesRef = useRef(hasExistingStudies);
  hasExistingStudiesRef.current = hasExistingStudies;
  const isExpandedRef = useRef(isExpanded);
  isExpandedRef.current = isExpanded;
  const isDraggingOverRef = useRef(isDraggingOver);
  isDraggingOverRef.current = isDraggingOver;
  const handlePdfSelectRef = useRef(studies.handlePdfSelect);
  handlePdfSelectRef.current = studies.handlePdfSelect;

  // Restore state from OAuth redirect.
  // Expand unconditionally since restoreState enqueues React state updates
  // that haven't committed yet - hasAnyStudies() would read stale (empty) state.
  useEffect(() => {
    if (!initialState?.studiesState || hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    studies.restoreState(initialState.studiesState);
    setExpanded(true);
    setActiveTab('drive');
  }, [initialState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save form state before OAuth redirect
  const handleSaveFormState = useCallback(async () => {
    const studiesState = studies.getSerializableState();
    const externalState = getExternalState?.() || {};
    await onSaveState?.({ studiesState, ...externalState });
  }, [studies, getExternalState, onSaveState]);

  // Global drag-and-drop for collapsed state.
  // Uses refs to read current values inside handlers, registered once to avoid
  // listener churn that causes stale closures during rapid state changes.
  useEffect(() => {
    if (alwaysExpanded) return;

    const handleDragEnter = (e: Event) => {
      const de = e as globalThis.DragEvent;
      if (hasExistingStudiesRef.current && !isExpandedRef.current && de.dataTransfer?.types?.includes('Files')) {
        setIsDraggingOver(true);
      }
    };

    const handleDragLeave = (e: Event) => {
      if (containerRef.current && !containerRef.current.contains((e as any).relatedTarget)) {
        setIsDraggingOver(false);
      }
    };

    const handleDragOver = (e: Event) => {
      if (hasExistingStudiesRef.current && !isExpandedRef.current && isDraggingOverRef.current) {
        e.preventDefault();
      }
    };

    const handleDrop = async (e: Event) => {
      if (hasExistingStudiesRef.current && !isExpandedRef.current && isDraggingOverRef.current) {
        e.preventDefault();
        setIsDraggingOver(false);
        const de = e as globalThis.DragEvent;
        const files = Array.from(de.dataTransfer?.files || []);
        if (files.length > 0) {
          setExpanded(true);
          setActiveTab('pdfs');
          await handlePdfSelectRef.current(files);
        }
      }
    };

    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDrop);
    };
  }, [alwaysExpanded]);

  const handleSubmit = useCallback(async () => {
    const studiesToAdd = studies.getStudiesToSubmit();
    if (studiesToAdd.length === 0) {
      showToast.warning('No Studies', 'Please add at least one study to import.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddStudies?.(studiesToAdd);
      studies.clearAll();
      setExpanded(false);
    } finally {
      setIsSubmitting(false);
    }
  }, [studies, onAddStudies]);

  const handleCancel = useCallback(() => {
    studies.clearAll();
    setExpanded(false);
  }, [studies]);

  // Shared tab content renderer
  const tabContent = (
    <>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList variant="line" className="relative flex gap-1 overflow-x-auto pb-px">
          {TABS.map(tab => {
            const count = getTabCount(tab.value, studies);
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="group text-muted-foreground hover:bg-muted hover:text-secondary-foreground data-active:text-foreground relative gap-2 rounded-t-lg px-4 py-2.5 transition-all"
              >
                <span className="opacity-60 transition-opacity group-data-active:opacity-100">
                  <tab.icon className="h-4 w-4" />
                </span>
                <span className="font-medium">{tab.label}</span>
                {count > 0 && (
                  <span className="bg-secondary text-secondary-foreground group-data-active:bg-primary/10 group-data-active:text-primary min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs font-medium tabular-nums transition-colors">
                    {count}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <div className="mt-4">
          <TabsContent value="pdfs" className="mt-0">
            <PdfUploadSection studies={studies} />
          </TabsContent>
          <TabsContent value="references" className="mt-0">
            <ReferenceImportSection studies={studies} />
          </TabsContent>
          <TabsContent value="lookup" className="mt-0">
            <DoiLookupSection studies={studies} />
          </TabsContent>
          <TabsContent value="drive" className="mt-0">
            <GoogleDriveSection
              studies={studies}
              formType={formType}
              projectId={projectId}
              onSaveFormState={handleSaveFormState}
            />
          </TabsContent>
        </div>
      </Tabs>

      <StagedStudiesSection studies={studies} />

      {studies.totalStudyCount > 0 && !collectMode && (
        <div className="border-border mt-4 flex items-center justify-end gap-2 border-t pt-4">
          {!alwaysExpanded && (
            <button
              type="button"
              onClick={handleCancel}
              className="text-secondary-foreground hover:bg-secondary hover:text-foreground rounded-lg px-3 py-1.5 text-sm transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || studies.totalStudyCount === 0}
            className="bg-primary hover:bg-primary/90 focus:ring-primary inline-flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium text-white transition-colors focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Adding...
              </>
            ) : (
              <>
                Add {studies.totalStudyCount}{' '}
                {studies.totalStudyCount === 1 ? 'Study' : 'Studies'}
              </>
            )}
          </button>
        </div>
      )}
    </>
  );

  return (
    <div ref={containerRef} className="relative">
      {/* Drag overlay */}
      {isDraggingOver && hasExistingStudies && !isExpanded && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-blue-500/10">
          <div className="bg-card rounded-xl border-2 border-dashed border-blue-500 p-8">
            <p className="text-lg font-medium text-blue-600">Drop PDFs to add studies</p>
          </div>
        </div>
      )}

      {/* Mode 1: Collapsible card (has existing studies) */}
      {hasExistingStudies && !alwaysExpanded && (
        <div className="border-border bg-card overflow-hidden rounded-lg border">
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-lg">
                <PlusIcon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-foreground text-base font-semibold">Add Studies</h3>
                <p className="text-muted-foreground text-sm">
                  {studies.totalStudyCount > 0
                    ? `${studies.totalStudyCount} staged`
                    : 'Upload PDFs, import references, or look up by DOI'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isExpanded
                  ? 'bg-primary text-white'
                  : 'bg-primary/10 text-primary hover:bg-primary/20'
              }`}
            >
              {isExpanded ? (
                <XIcon className="h-4 w-4" />
              ) : (
                <PlusIcon className="h-4 w-4" />
              )}
              {isExpanded ? 'Close' : 'Add'}
            </button>
          </div>

          <Collapsible open={isExpanded} onOpenChange={setExpanded}>
            <CollapsibleContent>
              <div className="border-border border-t px-6 pt-4 pb-6">{tabContent}</div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}

      {/* Mode 2: Always expanded standalone card */}
      {alwaysExpanded && (
        <div className={collectMode ? '' : 'border-border bg-card rounded-lg border p-6 shadow-sm'}>
          {tabContent}
        </div>
      )}

      {/* Mode 3: Empty project - dashed dropzone or expanded form */}
      {!hasExistingStudies && !alwaysExpanded && (
        <>
          {!isExpanded ? (
            <div
              className="border-border cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors hover:border-blue-500 hover:bg-blue-50/50"
              onClick={() => setExpanded(true)}
            >
              <CloudUploadIcon className="text-muted-foreground/70 mx-auto mb-3 h-12 w-12" />
              <p className="text-secondary-foreground font-medium">Add Studies to Your Project</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Upload PDFs, import from reference managers, or look up by DOI/PMID
              </p>
            </div>
          ) : (
            <div className="border-border bg-card overflow-hidden rounded-lg border shadow-sm">
              <div className="p-6">{tabContent}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const TABS = [
  { value: 'pdfs', label: 'Upload PDFs', icon: UploadIcon },
  { value: 'references', label: 'Import References', icon: FileTextIcon },
  { value: 'lookup', label: 'DOI / PMID', icon: LinkIcon },
  { value: 'drive', label: 'Google Drive', icon: FolderIcon },
] as const;

function getTabCount(tabValue: string, studies: any): number {
  switch (tabValue) {
    case 'pdfs':
      return studies.pdfCount;
    case 'references':
      return studies.refCount;
    case 'lookup':
      return studies.lookupCount;
    case 'drive':
      return studies.driveCount;
    default:
      return 0;
  }
}
