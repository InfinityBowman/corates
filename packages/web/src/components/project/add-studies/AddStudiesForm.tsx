/**
 * AddStudiesForm - Unified component for adding studies to a project
 * Supports four methods: PDF uploads, reference file imports, DOI/PMID lookups, and Google Drive.
 * Can be used both during project creation and when adding studies to existing projects.
 *
 * The host owns the useAddStudies instance and passes it in, so staged studies
 * survive this component unmounting (e.g. the Add studies sheet closing).
 *
 * Two UI modes:
 * 1. Inline card (!alwaysExpanded) - empty-project form with its own submit/cancel
 * 2. Always expanded (alwaysExpanded) - standalone card, bare when hosted in a
 *    sheet (bare) or during project creation (collectMode)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { UploadIcon, FileTextIcon, LinkIcon, FolderIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsIndicator, TabsContent } from '@/components/ui/tabs';
import { showToast } from '@/lib/toast';
import { Spinner } from '@/components/ui/spinner';
import { useAddStudies } from '@/hooks/useAddStudies';
import type { MergedStudy } from '@/hooks/useAddStudies/deduplication';

import { PdfUploadSection } from './PdfUploadSection';
import { ReferenceImportSection } from './ReferenceImportSection';
import { DoiLookupSection } from './DoiLookupSection';
import { GoogleDriveSection } from './GoogleDriveSection';
import { StagedStudiesSection } from './StagedStudiesSection';

export interface AddStudiesFormState {
  studiesState: Record<string, unknown>;
  [key: string]: unknown;
}

interface AddStudiesFormProps {
  studies: ReturnType<typeof useAddStudies>;
  projectId?: string;
  onAddStudies?: (studies: MergedStudy[]) => Promise<void>;
  alwaysExpanded?: boolean;
  collectMode?: boolean;
  bare?: boolean;
  formType?: 'createProject' | 'addStudies';
  initialState?: AddStudiesFormState | null;
  getExternalState?: () => Record<string, unknown>;
  onSaveState?: (state: AddStudiesFormState) => Promise<void>;
}

export function AddStudiesForm({
  studies,
  projectId,
  onAddStudies,
  alwaysExpanded = false,
  collectMode = false,
  bare = false,
  formType,
  initialState,
  getExternalState,
  onSaveState,
}: AddStudiesFormProps) {
  const [activeTab, setActiveTab] = useState('pdfs');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasRestoredRef = useRef(false);

  // Restore state from OAuth redirect
  useEffect(() => {
    if (!initialState?.studiesState || hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    studies.restoreState(initialState.studiesState);
    setActiveTab('drive');
  }, [initialState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save form state before OAuth redirect
  const handleSaveFormState = useCallback(async () => {
    const studiesState = studies.getSerializableState();
    const externalState = getExternalState?.() || {};
    await onSaveState?.({ studiesState, ...externalState });
  }, [studies, getExternalState, onSaveState]);

  const handleSubmit = useCallback(async () => {
    const studiesToAdd = studies.getStudiesToSubmit();
    if (studiesToAdd.length === 0) {
      showToast.warning('Nothing to add yet', 'Choose at least one study above, then add it.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddStudies?.(studiesToAdd);
      studies.clearAll();
    } finally {
      setIsSubmitting(false);
    }
  }, [studies, onAddStudies]);

  const handleCancel = useCallback(() => {
    studies.clearAll();
  }, [studies]);

  // Shared tab content rendered in all three UI modes
  const tabContent = (
    <>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className='relative flex gap-1 overflow-x-auto pb-px'>
          {TABS.map(tab => {
            const count = getTabCount(tab.value, studies);
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className='group text-muted-foreground hover:bg-muted hover:text-secondary-foreground data-active:text-foreground relative gap-2 rounded-t-lg px-4 py-2.5 transition-all'
              >
                <span className='opacity-60 transition-opacity group-data-active:opacity-100'>
                  <tab.icon className='size-4' />
                </span>
                <span className='font-medium'>{tab.label}</span>
                {count > 0 && (
                  <span className='bg-secondary text-secondary-foreground group-data-active:bg-primary/10 group-data-active:text-primary min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs font-medium tabular-nums transition-colors'>
                    {count}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
          <TabsIndicator className='bg-primary h-0.5 rounded-full' />
        </TabsList>

        <div className='mt-4'>
          <TabsContent value='pdfs'>
            <PdfUploadSection studies={studies} />
          </TabsContent>
          <TabsContent value='references'>
            <ReferenceImportSection studies={studies} />
          </TabsContent>
          <TabsContent value='lookup'>
            <DoiLookupSection studies={studies} />
          </TabsContent>
          <TabsContent value='drive'>
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
        <div className='border-border mt-4 flex items-center justify-end gap-2 border-t pt-4'>
          {!alwaysExpanded && (
            <Button variant='ghost' onClick={handleCancel}>
              Cancel
            </Button>
          )}
          <Button onClick={handleSubmit} disabled={isSubmitting || studies.totalStudyCount === 0}>
            {isSubmitting ?
              <>
                <Spinner size='sm' variant='current' />
                Adding...
              </>
            : <>
                Add {studies.totalStudyCount} {studies.totalStudyCount === 1 ? 'study' : 'studies'}
              </>
            }
          </Button>
        </div>
      )}
    </>
  );

  return (
    <div className='relative'>
      {/* Mode 1: Always expanded standalone card, bare inside sheets / project creation */}
      {alwaysExpanded && (
        <div
          className={
            collectMode || bare ? '' : 'border-border bg-card rounded-lg border p-6 shadow-sm'
          }
        >
          {tabContent}
        </div>
      )}

      {/* Mode 2: Empty project - show form directly */}
      {!alwaysExpanded && (
        <div className='border-border bg-card overflow-hidden rounded-lg border shadow-sm'>
          <div className='p-6'>{tabContent}</div>
        </div>
      )}
    </div>
  );
}

const TABS = [
  { value: 'pdfs', label: 'Upload PDFs', icon: UploadIcon },
  { value: 'references', label: 'Import references', icon: FileTextIcon },
  { value: 'lookup', label: 'DOI or PubMed ID', icon: LinkIcon },
  { value: 'drive', label: 'Google Drive', icon: FolderIcon },
] as const;

function getTabCount(tabValue: string, studies: ReturnType<typeof useAddStudies>): number {
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
