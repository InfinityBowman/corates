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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddStudy();
      }
    },
    [handleAddStudy],
  );

  return (
    <div className="border-border bg-card overflow-hidden rounded-lg border">
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        {/* Header */}
        <div
          className="flex cursor-pointer items-center justify-between px-4 py-3 select-none"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-2">
            <PlusIcon className="text-primary h-5 w-5" />
            <span className="text-foreground font-medium">Add Studies</span>
          </div>
          <button
            onClick={e => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              expanded
                ? 'text-muted-foreground hover:bg-muted'
                : 'bg-primary/10 text-primary hover:bg-primary/20'
            }`}
          >
            {expanded ? <XIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
            {expanded ? 'Close' : 'Add'}
          </button>
        </div>

        <CollapsibleContent>
          <div className="border-border space-y-4 border-t px-4 py-4">
            {/* Quick add by name */}
            <div>
              <label className="text-secondary-foreground mb-1 block text-sm font-medium">
                Study Name
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={studyName}
                  onChange={e => setStudyName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter study name or title..."
                  className="border-border focus:border-primary focus:ring-primary flex-1 rounded-lg border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
                  disabled={isSubmitting}
                />
                <button
                  onClick={handleAddStudy}
                  disabled={!studyName.trim() || isSubmitting}
                  className="bg-primary hover:bg-primary/90 shrink-0 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? 'Adding...' : 'Add'}
                </button>
              </div>
            </div>

            {/* Advanced features notice */}
            <div className="border-border bg-muted/50 rounded-lg border p-3">
              <p className="text-muted-foreground text-xs">
                Advanced import options (PDF upload with metadata extraction, DOI/PMID lookup,
                reference file import, Google Drive) will be available after full migration.
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
