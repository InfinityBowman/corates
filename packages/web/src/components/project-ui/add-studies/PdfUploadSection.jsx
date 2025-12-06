/**
 * PdfUploadSection - PDF upload section for AddStudiesForm
 * Handles PDF file selection, title extraction, and management
 */

import { For, Show } from 'solid-js';
import { BiRegularTrash } from 'solid-icons/bi';
import { CgFileDocument } from 'solid-icons/cg';
import { FileUpload } from '@components/zag/FileUpload.jsx';

/**
 * @param {Object} props
 * @param {Array} props.uploadedPdfs - Store of uploaded PDFs
 * @param {Function} props.onFilesChange - Handler for new files
 * @param {Function} props.onRemove - Handler to remove a PDF by id
 * @param {Function} props.onUpdateTitle - Handler to update a PDF title (id, newTitle)
 */
export default function PdfUploadSection(props) {
  return (
    <div class='space-y-3'>
      <p class='text-sm text-gray-500'>
        Upload research papers to automatically create studies. Titles will be extracted from each
        PDF.
      </p>

      <FileUpload
        accept='application/pdf'
        multiple
        helpText='PDF files only'
        showFileList={false}
        onFilesChange={props.onFilesChange}
        compact
      />

      <Show when={props.uploadedPdfs.length > 0}>
        <div class='space-y-2'>
          <For each={props.uploadedPdfs}>
            {pdf => (
              <div class='flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200'>
                <CgFileDocument class='w-5 h-5 text-red-500 shrink-0' />
                <div class='flex-1 min-w-0'>
                  <Show
                    when={!pdf.extracting}
                    fallback={
                      <div class='flex items-center gap-2'>
                        <div class='w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin' />
                        <span class='text-sm text-gray-500'>Extracting title...</span>
                      </div>
                    }
                  >
                    <input
                      type='text'
                      value={pdf.title || ''}
                      onInput={e => props.onUpdateTitle(pdf.id, e.target.value)}
                      class='w-full text-sm font-medium text-gray-900 bg-transparent border-none focus:outline-none focus:ring-0 p-0'
                      placeholder='Study title'
                    />
                    <p class='text-xs text-gray-500 truncate'>{pdf.file.name}</p>
                  </Show>
                </div>
                <button
                  type='button'
                  onClick={() => props.onRemove(pdf.id)}
                  class='p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors'
                >
                  <BiRegularTrash class='w-4 h-4' />
                </button>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
