/**
 * PdfUploadSection - PDF upload section for AddStudiesForm
 * Handles PDF file selection - staged items shown in unified StagedStudiesSection
 */

import { Show, For } from 'solid-js';
import { FiUploadCloud, FiRefreshCw } from 'solid-icons/fi';
import { VsWarning } from 'solid-icons/vs';
import { CgFileDocument } from 'solid-icons/cg';
import { FileUpload, FileUploadDropzone, FileUploadHiddenInput } from '@/components/ui/file-upload';

export default function PdfUploadSection(props) {
  const studies = () => props.studies;

  // Show PDFs that are still extracting or have errors (need user attention)
  const pendingPdfs = () => studies().uploadedPdfs.filter(pdf => pdf.extracting || pdf.error);

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

      {/* Show PDFs that are extracting or have errors */}
      <Show when={pendingPdfs().length > 0}>
        <div class='space-y-2'>
          <For each={pendingPdfs()}>
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

                  <Show when={!pdf.error && pdf.extracting}>
                    <div class='flex items-center gap-2'>
                      <div class='h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent' />
                      <span class='text-muted-foreground text-sm'>Extracting metadata...</span>
                    </div>
                    <p class='text-muted-foreground/70 mt-1 truncate text-xs'>{pdf.file.name}</p>
                  </Show>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
