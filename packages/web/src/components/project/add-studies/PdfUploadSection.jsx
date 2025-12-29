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

export default function PdfUploadSection(props) {
  const studies = () => props.studies;

  return (
    <div class='space-y-3'>
      <p class='text-sm text-gray-500'>
        Upload research papers to automatically create studies. Titles will be extracted from each
        PDF.
      </p>

      <FileUpload
        accept='application/pdf,.pdf'
        multiple
        allowDirectories={false}
        helpText='PDF files only'
        showFileList={false}
        onFilesChange={studies().handlePdfSelect}
        compact
      />

      <Show when={studies().uploadedPdfs.length > 0}>
        <div class='space-y-2'>
          <For each={studies().uploadedPdfs}>
            {pdf => (
              <div
                class='flex items-center gap-3 rounded-lg border p-3'
                classList={{
                  'bg-red-50 border-red-200': pdf.error,
                  'bg-gray-50 border-gray-200': !pdf.error,
                }}
              >
                <CgFileDocument
                  class='h-5 w-5 shrink-0'
                  classList={{
                    'text-gray-500': !pdf.error,
                    'text-red-600': pdf.error,
                  }}
                />
                <div class='min-w-0 flex-1'>
                  {/* Error state */}
                  <Show when={pdf.error}>
                    <div class='flex items-center gap-2'>
                      <VsWarning class='h-4 w-4 shrink-0 text-red-600' />
                      <span class='text-sm font-medium text-red-600'>{pdf.error}</span>
                      <button
                        type='button'
                        onClick={() => studies().retryPdfExtraction?.(pdf.id)}
                        class='inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-200'
                      >
                        <FiRefreshCw class='h-3 w-3' />
                        Retry
                      </button>
                    </div>
                    <p class='mt-1 truncate text-xs text-red-600'>{pdf.file.name}</p>
                  </Show>

                  {/* Extracting state */}
                  <Show when={!pdf.error && pdf.extracting}>
                    <div class='flex items-center gap-2'>
                      <div class='h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent' />
                      <span class='text-sm text-gray-500'>Extracting metadata...</span>
                    </div>
                    <p class='mt-1 truncate text-xs text-gray-400'>{pdf.file.name}</p>
                  </Show>

                  {/* Success state */}
                  <Show when={!pdf.error && !pdf.extracting}>
                    <div class='flex items-center gap-2'>
                      <input
                        type='text'
                        value={pdf.title || ''}
                        onInput={e => studies().updatePdfTitle(pdf.id, e.target.value)}
                        class='flex-1 border-none bg-transparent p-0 text-sm font-medium text-gray-900 focus:ring-0 focus:outline-none'
                        placeholder='Study title'
                      />
                      <Show when={pdf.matchedToRef}>
                        <span
                          class='inline-flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700'
                          title={`Matched to: ${pdf.matchedToRef}`}
                        >
                          <FiLink class='h-3 w-3' />
                          Matched
                        </span>
                      </Show>
                    </div>
                    <div class='flex items-center gap-2'>
                      <p class='truncate text-xs text-gray-500'>{pdf.file.name}</p>
                      {/* Loading metadata indicator */}
                      <Show when={pdf.metadataLoading}>
                        <span class='text-xs text-gray-400'>|</span>
                        <span class='inline-flex items-center gap-1 text-xs text-blue-600'>
                          <div class='h-3 w-3 animate-spin rounded-full border border-blue-500 border-t-transparent' />
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
                        <span class='shrink-0 text-xs text-gray-600'>
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
                  onClick={() => studies().removePdf(pdf.id)}
                  class='rounded p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 focus:ring-2 focus:ring-blue-500 focus:outline-none'
                >
                  <BiRegularTrash class='h-4 w-4' />
                </button>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
