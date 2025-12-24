/**
 * PdfEmptyState - Component for displaying PDF loading, error, and empty states
 */

import { Show } from 'solid-js';
import { HiOutlineDocument } from 'solid-icons/hi';
import { FileUpload } from '@corates/ui';

function LoadingSpinner() {
  return <div class='h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600' />;
}

export default function PdfEmptyState(props) {
  // props.libReady - Whether PDF.js is ready
  // props.loading - Whether PDF is loading
  // props.error - Error message if any
  // props.pdfDoc - The loaded PDF document
  // props.readOnly - If true, hides "Open a PDF file" button
  // props.onFileAccept - Handler when files are accepted: (details: { files: File[] }) => void

  const handleFileAccept = details => {
    if (details.files.length > 0) {
      props.onFileAccept?.(details.files[0]);
    }
  };

  return (
    <>
      {/* Library initializing */}
      <Show when={!props.libReady}>
        <div class='flex h-full items-center justify-center'>
          <div class='flex items-center gap-3 text-gray-500'>
            <LoadingSpinner />
            Initializing PDF viewer...
          </div>
        </div>
      </Show>

      {/* PDF loading */}
      <Show when={props.libReady && props.loading}>
        <div class='flex h-full items-center justify-center'>
          <div class='flex items-center gap-3 text-gray-500'>
            <LoadingSpinner />
            Loading PDF...
          </div>
        </div>
      </Show>

      {/* Error state */}
      <Show when={props.libReady && props.error}>
        <div class='flex h-full items-center justify-center'>
          <div class='text-center'>
            <div class='mb-2 text-red-600'>{props.error}</div>
            <Show when={!props.readOnly}>
              <FileUpload
                accept='application/pdf,.pdf'
                helpText='PDF files only'
                showFileList={false}
                onFileAccept={handleFileAccept}
                compact
                class='mx-auto mt-4 max-w-sm'
              />
            </Show>
          </div>
        </div>
      </Show>

      {/* No PDF loaded */}
      <Show when={props.libReady && !props.loading && !props.error && !props.pdfDoc}>
        <div class='flex h-full flex-col items-center justify-center text-gray-500'>
          <HiOutlineDocument class='mb-4 h-16 w-16 text-gray-300' />
          <p class='mb-4'>No PDF loaded</p>
          <Show
            when={!props.readOnly}
            fallback={<p class='text-sm text-gray-400'>PDF will be displayed here</p>}
          >
            <FileUpload
              accept='application/pdf,.pdf'
              helpText='PDF files only'
              showFileList={false}
              onFileAccept={handleFileAccept}
              class='w-full max-w-sm'
            />
          </Show>
        </div>
      </Show>
    </>
  );
}
