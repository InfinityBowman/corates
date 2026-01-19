/**
 * PdfUploadSection - PDF upload section for AddStudiesForm
 * Handles PDF file selection, title extraction, and management
 */

import { For, Show } from 'solid-js';
import { BiRegularTrash } from 'solid-icons/bi';
import { CgFileDocument } from 'solid-icons/cg';
import { FiLink, FiRefreshCw, FiUploadCloud } from 'solid-icons/fi';
import { VsWarning } from 'solid-icons/vs';
import { FileUpload, FileUploadDropzone, FileUploadHiddenInput } from '@/components/ui/file-upload';

export default function PdfUploadSection(props) {
  const studies = () => props.studies;

  return (
    <div class='space-y-3'>
      <p class='text-muted-foreground text-sm'>
        Upload research papers to automatically create studies. Titles will be extracted from each
        PDF.
      </p>

      <FileUpload
        accept={['application/pdf', '.pdf']}
        maxFiles={Infinity}
        onFileAccept={details => studies().handlePdfSelect(details.files)}
      >
        <FileUploadDropzone class='min-h-24 p-4'>
          <FiUploadCloud class='text-muted-foreground/70 h-6 w-6' />
          <p class='text-secondary-foreground mt-2 text-center text-xs'>
            <span class='text-primary font-medium'>Click to upload</span> or drag and drop
          </p>
          <p class='text-muted-foreground/70 mt-1 text-xs'>PDF files only</p>
        </FileUploadDropzone>
        <FileUploadHiddenInput />
      </FileUpload>

      <Show when={studies().uploadedPdfs.length > 0}>
        <div class='space-y-2'>
          <For each={studies().uploadedPdfs}>
            {pdf => (
              <div
                class='flex items-center gap-3 rounded-lg border p-3'
                classList={{
                  'bg-red-50 border-red-200': pdf.error,
                  'bg-muted border-border': !pdf.error,
                }}
              >
                <CgFileDocument
                  class='h-5 w-5 shrink-0'
                  classList={{
                    'text-muted-foreground': !pdf.error,
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
                      <span class='text-muted-foreground text-sm'>Extracting metadata...</span>
                    </div>
                    <p class='text-muted-foreground/70 mt-1 truncate text-xs'>{pdf.file.name}</p>
                  </Show>

                  {/* Success state */}
                  <Show when={!pdf.error && !pdf.extracting}>
                    <div class='flex items-center gap-2'>
                      <input
                        type='text'
                        value={pdf.title || ''}
                        onInput={e => studies().updatePdfTitle(pdf.id, e.target.value)}
                        class='text-foreground flex-1 border-none bg-transparent p-0 text-sm font-medium focus:ring-0 focus:outline-none'
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
                      <p class='text-muted-foreground truncate text-xs'>{pdf.file.name}</p>
                      {/* Loading metadata indicator */}
                      <Show when={pdf.metadataLoading}>
                        <span class='text-muted-foreground/70 text-xs'>|</span>
                        <span class='text-primary inline-flex items-center gap-1 text-xs'>
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
                        <span class='text-muted-foreground/70 text-xs'>|</span>
                        <span class='text-secondary-foreground shrink-0 text-xs'>
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
                  class='text-muted-foreground/70 focus:ring-primary rounded p-1.5 transition-colors hover:bg-red-50 hover:text-red-600 focus:ring-2 focus:outline-none'
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
