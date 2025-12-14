/**
 * GoogleDrivePickerModal - Modal for selecting PDFs from Google Drive (Google Picker)
 */

import { createSignal } from 'solid-js';
import { Dialog } from '@components/zag/Dialog.jsx';
import { showToast } from '@components/zag/Toast.jsx';

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

  const handlePicked = picked => {
    const file = picked?.[0];
    if (!file) return;

    const projectId = props.projectId;
    const studyId = props.studyId;
    const onImportSuccess = props.onImportSuccess;

    (async () => {
      try {
        setImporting(true);
        const result = await importFromGoogleDrive(file.id, projectId, studyId);
        showToast.success(
          'PDF Imported',
          `Successfully imported "${file.name}" from Google Drive.`,
        );
        onImportSuccess?.(result.file);
      } catch (err) {
        console.error('Picker import error:', err);
        showToast.error('Import Failed', err.message);
      } finally {
        setImporting(false);
      }
    })();
  };

  return (
    <Dialog
      open={props.open}
      onOpenChange={open => !open && props.onClose()}
      title='Import from Google Drive'
      description='Select a PDF from your Google Drive to import'
      size='lg'
    >
      <div class='space-y-4'>
        <GoogleDrivePickerLauncher
          active={props.open}
          multiselect={false}
          disabled={!props.projectId || !props.studyId}
          busy={importing()}
          onBeforeOpenPicker={() => props.onClose()}
          onPick={handlePicked}
        />

        {/* Action buttons */}
        <div class='flex justify-end'>
          <button
            type='button'
            onClick={() => props.onClose()}
            class='px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors'
          >
            Cancel
          </button>
        </div>
      </div>
    </Dialog>
  );
}
