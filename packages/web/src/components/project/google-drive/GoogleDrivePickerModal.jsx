/**
 * GoogleDrivePickerModal - Modal for selecting PDFs from Google Drive (Google Picker)
 */

import { createSignal } from 'solid-js';
import { showToast } from '@/components/ui/toast';
import {
  Dialog,
  DialogBackdrop,
  DialogPositioner,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogCloseTrigger,
} from '@/components/ui/dialog';
import { FiX } from 'solid-icons/fi';

import { importFromGoogleDrive } from '@/api/google-drive.js';
import GoogleDrivePickerLauncher from './GoogleDrivePickerLauncher.jsx';

/**
 * @param {Object} props
 * @param {boolean} props.open - Whether the modal is open
 * @param {Function} props.onClose - Called when modal should close
 * @param {string} props.projectId - Project ID to import into
 * @param {string} props.studyId - Study ID to import into
 * @param {Function} [props.onImportSuccess] - Called after successful import with file info
 */
export default function GoogleDrivePickerModal(props) {
  const [importing, setImporting] = createSignal(false);
  const projectId = () => props.projectId;
  const onImportSuccess = () => props.onImportSuccess;

  const handlePicked = (picked, studyId) => {
    const file = picked?.[0];
    if (!file) return;

    (async () => {
      try {
        setImporting(true);
        const result = await importFromGoogleDrive(file.id, projectId(), studyId);
        showToast.success(
          'PDF Imported',
          `Successfully imported "${file.name}" from Google Drive.`,
        );
        // Pass both file and studyId to the callback
        onImportSuccess()?.(result.file, studyId);
      } catch (err) {
        console.error('Picker import error:', err);
        showToast.error('Import Failed', err.message);
      } finally {
        setImporting(false);
      }
    })();
  };

  return (
    <Dialog open={props.open} onOpenChange={open => !open && props.onClose()}>
      <DialogBackdrop />
      <DialogPositioner>
        <DialogContent class='max-w-lg'>
          <DialogHeader>
            <DialogTitle>Import from Google Drive</DialogTitle>
            <DialogCloseTrigger>
              <FiX class='h-5 w-5' />
            </DialogCloseTrigger>
          </DialogHeader>
          <DialogBody>
            <DialogDescription class='mb-4'>
              Select a PDF from your Google Drive to import
            </DialogDescription>
            <div class='space-y-4'>
              <GoogleDrivePickerLauncher
                active={props.open}
                multiselect={false}
                disabled={!props.projectId || !props.studyId}
                busy={importing()}
                onBeforeOpenPicker={() => props.onClose()}
                onPick={handlePicked}
                studyId={props.studyId}
              />

              {/* Action buttons */}
              <div class='flex justify-end'>
                <button
                  type='button'
                  onClick={() => props.onClose()}
                  class='rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50'
                >
                  Cancel
                </button>
              </div>
            </div>
          </DialogBody>
        </DialogContent>
      </DialogPositioner>
    </Dialog>
  );
}
