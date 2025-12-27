/**
 * GoogleDriveSection - Google Drive file picker for AddStudiesForm (Google Picker)
 * Allows selecting multiple PDFs from Google Drive to create studies
 */

import { For, Show } from 'solid-js'
import { BiRegularTrash } from 'solid-icons/bi'
import { FiFile } from 'solid-icons/fi'
import { formatFileSize } from '@/api/google-drive.js'
import GoogleDrivePickerLauncher from '../google-drive/GoogleDrivePickerLauncher.jsx'
import {
  useStudiesContext,
  useFormPersistenceContext,
} from './AddStudiesContext.jsx'

export default function GoogleDriveSection() {
  const studies = useStudiesContext()
  const { formType, projectId, onSaveFormState } = useFormPersistenceContext()

  const isFileSelected = (fileId) => {
    return studies.selectedDriveFiles().some((f) => f.id === fileId)
  }

  const selectedCount = () => studies.selectedDriveFiles().length

  return (
    <div class="space-y-3">
      <p class="text-sm text-gray-500">
        Import PDFs from your Google Drive. Each selected file will create a new
        study.
      </p>

      {/* Selected files display */}
      <Show when={selectedCount() > 0}>
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-gray-700">
              {selectedCount()} {selectedCount() === 1 ? 'file' : 'files'}{' '}
              selected
            </span>
            <button
              type="button"
              onClick={() => studies.clearDriveFiles()}
              class="text-xs text-gray-500 transition-colors hover:text-red-600"
            >
              Clear all
            </button>
          </div>
          <div class="max-h-40 space-y-2 overflow-y-auto">
            <For each={studies.selectedDriveFiles()}>
              {(file) => (
                <div class="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-2">
                  <FiFile class="h-4 w-4 shrink-0 text-red-600" />
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium text-gray-900">
                      {file.name}
                    </p>
                    <p class="text-xs text-gray-500">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => studies.removeDriveFile(file.id)}
                    class="rounded p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <BiRegularTrash class="h-4 w-4" />
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
        formType={formType}
        projectId={projectId}
        onSaveFormState={onSaveFormState}
        onPick={(picked) => {
          for (const file of picked) {
            if (!isFileSelected(file.id)) {
              studies.toggleDriveFile({ id: file.id, name: file.name })
            }
          }
        }}
      />
    </div>
  )
}
