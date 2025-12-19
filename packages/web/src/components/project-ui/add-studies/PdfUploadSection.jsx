/**
 * PdfUploadSection - PDF upload section for AddStudiesForm
 * Handles PDF file selection, title extraction, and management
 */

import { For, Show } from 'solid-js';
import { BiRegularTrash } from 'solid-icons/bi';
import { CgFileDocument } from 'solid-icons/cg';
import { FiLink, FiRefreshCw } from 'solid-icons/fi';
import { VsWarning } from 'solid-icons/vs';
import { FileUpload } from '@corates/ui';
import { useStudiesContext } from './AddStudiesContext.jsx';

export default function PdfUploadSection() {
  const studies = useStudiesContext();

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
        onFilesChange={studies.handlePdfSelect}
        compact
      />

      <Show when={studies.uploadedPdfs.length > 0}>
        <div class='space-y-2'>
          <For each={studies.uploadedPdfs}>
            {pdf => (
              <div
                class='flex items-center gap-3 p-3 rounded-lg border'
                classList={{
                  'bg-red-50 border-red-200': pdf.error,
                  'bg-gray-50 border-gray-200': !pdf.error,
                }}
              >
                <CgFileDocument
                  class='w-5 h-5 shrink-0'
                  classList={{
                    'text-gray-500': !pdf.error,
                    'text-red-500': pdf.error,
                  }}
                />
                <div class='flex-1 min-w-0'>
                  {/* Error state */}
                  <Show when={pdf.error}>
                    <div class='flex items-center gap-2'>
                      <VsWarning class='w-4 h-4 text-red-500 shrink-0' />
                      <span class='text-sm text-red-600 font-medium'>{pdf.error}</span>
                      <button
                        type='button'
                        onClick={() => studies.retryPdfExtraction?.(pdf.id)}
                        class='inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded transition-colors'
                      >
                        <FiRefreshCw class='w-3 h-3' />
                        Retry
                      </button>
                    </div>
                    <p class='text-xs text-red-500 truncate mt-1'>{pdf.file.name}</p>
                  </Show>

                  {/* Extracting state */}
                  <Show when={!pdf.error && pdf.extracting}>
                    <div class='flex items-center gap-2'>
                      <div class='w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin' />
                      <span class='text-sm text-gray-500'>Extracting metadata...</span>
                    </div>
                    <p class='text-xs text-gray-400 truncate mt-1'>{pdf.file.name}</p>
                  </Show>

                  {/* Success state */}
                  <Show when={!pdf.error && !pdf.extracting}>
                    <div class='flex items-center gap-2'>
                      <input
                        type='text'
                        value={pdf.title || ''}
                        onInput={e => studies.updatePdfTitle(pdf.id, e.target.value)}
                        class='flex-1 text-sm font-medium text-gray-900 bg-transparent border-none focus:outline-none focus:ring-0 p-0'
                        placeholder='Study title'
                      />
                      <Show when={pdf.matchedToRef}>
                        <span
                          class='inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full shrink-0'
                          title={`Matched to: ${pdf.matchedToRef}`}
                        >
                          <FiLink class='w-3 h-3' />
                          Matched
                        </span>
                      </Show>
                    </div>
                    <div class='flex items-center gap-2'>
                      <p class='text-xs text-gray-500 truncate'>{pdf.file.name}</p>
                      {/* Loading metadata indicator */}
                      <Show when={pdf.metadataLoading}>
                        <span class='text-xs text-gray-400'>|</span>
                        <span class='inline-flex items-center gap-1 text-xs text-blue-600'>
                          <div class='w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin' />
                          Loading citation...
                        </span>
                      </Show>
                      {/* Metadata display */}
                      <Show
                        when={
                          !pdf.metadataLoading &&
                          (pdf.metadata?.firstAuthor || pdf.metadata?.publicationYear)
                        }
                      >
                        <span class='text-xs text-gray-400'>|</span>
                        <span class='text-xs text-gray-600 shrink-0'>
                          <Show when={pdf.metadata.firstAuthor}>
                            {pdf.metadata.firstAuthor}
                            <Show when={pdf.metadata.publicationYear}>, </Show>
                          </Show>
                          <Show when={pdf.metadata.publicationYear}>
                            {pdf.metadata.publicationYear}
                          </Show>
                        </span>
                      </Show>
                    </div>
                  </Show>
                </div>
                <button
                  type='button'
                  onClick={() => studies.removePdf(pdf.id)}
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
