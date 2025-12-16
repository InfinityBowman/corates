/**
 * PdfEmptyState - Component for displaying PDF loading, error, and empty states
 */

import { Show } from 'solid-js';
import { HiOutlineDocument } from 'solid-icons/hi';
import { FileUpload } from '@corates/ui';

function LoadingSpinner() {
  return <div class='animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600' />;
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
        <div class='flex items-center justify-center h-full'>
          <div class='flex items-center gap-3 text-gray-500'>
            <LoadingSpinner />
            Initializing PDF viewer...
          </div>
        </div>
      </Show>

      {/* PDF loading */}
      <Show when={props.libReady && props.loading}>
        <div class='flex items-center justify-center h-full'>
          <div class='flex items-center gap-3 text-gray-500'>
            <LoadingSpinner />
            Loading PDF...
          </div>
        </div>
      </Show>

      {/* Error state */}
      <Show when={props.libReady && props.error}>
        <div class='flex items-center justify-center h-full'>
          <div class='text-center'>
            <div class='text-red-600 mb-2'>{props.error}</div>
            <Show when={!props.readOnly}>
              <FileUpload
                accept='application/pdf'
                helpText='PDF files only'
                showFileList={false}
                onFileAccept={handleFileAccept}
                compact
                class='mt-4 max-w-sm mx-auto'
              />
            </Show>
          </div>
        </div>
      </Show>

      {/* No PDF loaded */}
      <Show when={props.libReady && !props.loading && !props.error && !props.pdfDoc}>
        <div class='flex flex-col items-center justify-center h-full text-gray-500'>
          <HiOutlineDocument class='w-16 h-16 mb-4 text-gray-300' />
          <p class='mb-4'>No PDF loaded</p>
          <Show
            when={!props.readOnly}
            fallback={<p class='text-sm text-gray-400'>PDF will be displayed here</p>}
          >
            <FileUpload
              accept='application/pdf'
              helpText='PDF files only'
              showFileList={false}
              onFileAccept={handleFileAccept}
              class='max-w-sm w-full'
            />
          </Show>
        </div>
      </Show>
    </>
  );
}
