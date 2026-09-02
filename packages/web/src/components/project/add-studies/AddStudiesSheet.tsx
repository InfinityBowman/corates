/**
 * AddStudiesSheet - Hosts AddStudiesForm in a side sheet, opened from the project header.
 *
 * Stays mounted while closed, and owns the useAddStudies instance, so:
 * - staged studies survive closing and reopening the sheet
 * - PDFs dropped anywhere on the page are staged and open the sheet
 * - in-progress form state is restored after a Google Drive OAuth redirect
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { AddStudiesForm, type AddStudiesFormState } from './AddStudiesForm';
import { useAddStudies } from '@/hooks/useAddStudies';
import type { MergedStudy } from '@/hooks/useAddStudies/deduplication';
import { useSortedStudyIds } from '@/project/workspace-data';
import { project } from '@/project';
import { useProjectContext } from '../ProjectContext';
import {
  saveFormState,
  getFormState,
  clearFormState,
  getRestoreParamsFromUrl,
  clearRestoreParamsFromUrl,
} from '@/lib/formStatePersistence.js';

interface AddStudiesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded?: (count: number) => void;
}

export function AddStudiesSheet({ open, onOpenChange, onAdded }: AddStudiesSheetProps) {
  const { projectId } = useProjectContext();

  const [restoredState, setRestoredState] = useState<AddStudiesFormState | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const studies = useAddStudies({});
  const studyIds = useSortedStudyIds(projectId);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setRestoredState(null);
      }
      onOpenChange(next);
    },
    [onOpenChange],
  );

  // Restore state after OAuth redirect and reopen the sheet
  useEffect(() => {
    let cancelled = false;
    const restoreParams = getRestoreParamsFromUrl();
    if (restoreParams?.type === 'addStudies' && restoreParams.projectId === projectId) {
      (async () => {
        try {
          const savedState = await getFormState('addStudies', projectId);
          if (!cancelled && savedState) {
            setRestoredState(savedState as AddStudiesFormState);
            onOpenChange(true);
            await clearFormState('addStudies', projectId);
          }
        } catch (err) {
          const { handleError } = await import('@/lib/error-utils');
          await handleError(err, { toastTitle: 'Could not restore your unsaved imports' });
        }
        if (!cancelled) clearRestoreParamsFromUrl();
      })();
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Global drag-and-drop while the sheet is closed. The empty-project inline
  // form has its own dropzone, so this only arms once studies exist.
  // Uses refs so the handlers are registered once without stale closures.
  const isArmedRef = useRef(false);
  isArmedRef.current = !open && studyIds.length > 0;
  const isDraggingOverRef = useRef(isDraggingOver);
  isDraggingOverRef.current = isDraggingOver;
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  const handlePdfSelectRef = useRef(studies.handlePdfSelect);
  handlePdfSelectRef.current = studies.handlePdfSelect;

  useEffect(() => {
    const handleDragEnter = (e: Event) => {
      const de = e as globalThis.DragEvent;
      if (isArmedRef.current && de.dataTransfer?.types?.includes('Files')) {
        setIsDraggingOver(true);
      }
    };

    const handleDragLeave = (e: Event) => {
      if (!(e as globalThis.DragEvent).relatedTarget) {
        setIsDraggingOver(false);
      }
    };

    const handleDragOver = (e: Event) => {
      if (isArmedRef.current && isDraggingOverRef.current) {
        e.preventDefault();
      }
    };

    const handleDrop = (e: Event) => {
      if (isArmedRef.current && isDraggingOverRef.current) {
        e.preventDefault();
        setIsDraggingOver(false);
        const de = e as globalThis.DragEvent;
        const files = Array.from(de.dataTransfer?.files || []);
        if (files.length > 0) {
          handlePdfSelectRef.current(files);
          onOpenChangeRef.current(true);
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
  }, []);

  const handleSaveState = useCallback(
    async (state: AddStudiesFormState) => {
      await saveFormState('addStudies', state, projectId);
    },
    [projectId],
  );

  const handleAddStudies = useCallback(
    async (studiesToAdd: MergedStudy[]) => {
      await project.study.addBatch(studiesToAdd as unknown as Record<string, unknown>[]);
      handleOpenChange(false);
      onAdded?.(studiesToAdd.length);
    },
    [handleOpenChange, onAdded],
  );

  return (
    <>
      {isDraggingOver && (
        <div className='pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-blue-500/10'>
          <div className='bg-card rounded-xl border-2 border-dashed border-blue-500 p-8'>
            <p className='text-lg font-medium text-blue-600'>Drop PDFs to add studies</p>
          </div>
        </div>
      )}

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side='right' className='w-full gap-0 overflow-y-auto sm:max-w-2xl'>
          <SheetHeader>
            <SheetTitle>Add studies</SheetTitle>
            <SheetDescription>
              Every paper you appraise is a study. Add them by uploading PDFs, importing a reference
              file, looking up DOIs or PubMed IDs, or picking files from Google Drive.
            </SheetDescription>
          </SheetHeader>
          <div className='p-4'>
            <AddStudiesForm
              studies={studies}
              projectId={projectId}
              formType='addStudies'
              alwaysExpanded
              bare
              initialState={restoredState}
              onSaveState={handleSaveState}
              onAddStudies={handleAddStudies}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
