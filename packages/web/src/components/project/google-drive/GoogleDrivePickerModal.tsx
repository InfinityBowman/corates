/**
 * GoogleDrivePickerModal - Modal for selecting PDFs from Google Drive (single-study import)
 */

import { useState, useCallback, useRef } from 'react';
import { showToast } from '@/components/ui/toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { importFromGoogleDrive } from '@/api/google-drive';
import { GoogleDrivePickerLauncher } from './GoogleDrivePickerLauncher';

interface GoogleDrivePickerModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  studyId?: string | null;
  onImportSuccess?: (_file: any, _studyId: string) => void;
}

export function GoogleDrivePickerModal({
  open,
  onClose,
  projectId,
  studyId,
  onImportSuccess,
}: GoogleDrivePickerModalProps) {
  const [importing, setImporting] = useState(false);

  // Use refs for values that may change between modal open and picker callback
  const studyIdRef = useRef(studyId);
  studyIdRef.current = studyId;
  const onImportSuccessRef = useRef(onImportSuccess);
  onImportSuccessRef.current = onImportSuccess;

  const handlePicked = useCallback(
    async (picked: Array<{ id: string; name: string }>, pickerStudyId?: string) => {
      const file = picked?.[0];
      if (!file) return;

      const targetStudyId = pickerStudyId || studyIdRef.current;
      if (!targetStudyId) return;

      try {
        setImporting(true);
        const result = await importFromGoogleDrive(file.id, projectId, targetStudyId);
        showToast.success(
          'PDF Imported',
          `Successfully imported "${file.name}" from Google Drive.`,
        );
        onImportSuccessRef.current?.(result.file, targetStudyId);
      } catch (err: unknown) {
        const { handleError } = await import('@/lib/error-utils');
        await handleError(err, { toastTitle: 'Import Failed' });
      } finally {
        setImporting(false);
      }
    },
    [projectId],
  );

  return (
    <Dialog open={open} onOpenChange={openState => !openState && onClose()}>
      <DialogContent className='max-w-lg'>
        <DialogHeader>
          <DialogTitle>Import from Google Drive</DialogTitle>
          <DialogDescription>Select a PDF from your Google Drive to import</DialogDescription>
        </DialogHeader>

        <div className='flex flex-col gap-4'>
          <GoogleDrivePickerLauncher
            active={open}
            multiselect={false}
            disabled={!projectId || !studyId}
            busy={importing}
            onBeforeOpenPicker={onClose}
            onPick={handlePicked}
            studyId={studyId || undefined}
          />

          <div className='flex justify-end'>
            <button
              type='button'
              onClick={onClose}
              className='border-border bg-card text-secondary-foreground hover:bg-muted rounded-lg border px-4 py-2 text-sm font-medium transition-colors'
            >
              Cancel
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
