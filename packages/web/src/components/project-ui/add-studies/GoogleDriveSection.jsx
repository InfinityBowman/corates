/**
 * GoogleDriveSection - Google Drive file picker for AddStudiesForm (Google Picker)
 * Allows selecting multiple PDFs from Google Drive to create studies
 */

import { For, Show } from 'solid-js';
import { BiRegularTrash } from 'solid-icons/bi';
import { FiFile } from 'solid-icons/fi';
import { formatFileSize } from '@/api/google-drive.js';
import GoogleDrivePickerLauncher from '../google-drive/GoogleDrivePickerLauncher.jsx';
import { useStudiesContext } from './AddStudiesContext.jsx';

export default function GoogleDriveSection() {
  const studies = useStudiesContext();

  const isFileSelected = fileId => {
    return studies.selectedDriveFiles().some(f => f.id === fileId);
  };

  const selectedCount = () => studies.selectedDriveFiles().length;

  return (
    <div class='space-y-3'>
      <p class='text-sm text-gray-500'>
        Import PDFs from your Google Drive. Each selected file will create a new study.
      </p>

      {/* Selected files display */}
      <Show when={selectedCount() > 0}>
        <div class='space-y-2'>
          <div class='flex items-center justify-between'>
            <span class='text-sm font-medium text-gray-700'>
              {selectedCount()} {selectedCount() === 1 ? 'file' : 'files'} selected
            </span>
            <button
              type='button'
              onClick={() => studies.clearDriveFiles()}
              class='text-xs text-gray-500 hover:text-red-600 transition-colors'
            >
              Clear all
            </button>
          </div>
          <div class='space-y-2 max-h-40 overflow-y-auto'>
            <For each={studies.selectedDriveFiles()}>
              {file => (
                <div class='flex items-center gap-3 p-2 bg-blue-50 rounded-lg border border-blue-200'>
                  <FiFile class='w-4 h-4 text-red-500 shrink-0' />
                  <div class='flex-1 min-w-0'>
                    <p class='text-sm font-medium text-gray-900 truncate'>{file.name}</p>
                    <p class='text-xs text-gray-500'>{formatFileSize(file.size)}</p>
                  </div>
                  <button
                    type='button'
                    onClick={() => studies.removeDriveFile(file.id)}
                    class='p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors'
                  >
                    <BiRegularTrash class='w-4 h-4' />
                  </button>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      <GoogleDrivePickerLauncher
        active={true}
        multiselect={true}
        onPick={picked => {
          for (const file of picked) {
            if (!isFileSelected(file.id)) {
              studies.toggleDriveFile({ id: file.id, name: file.name });
            }
          }
        }}
      />
    </div>
  );
}
