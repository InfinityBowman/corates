/**
 * PdfEmptyState - Component for displaying PDF loading, error, and empty states
 */

import { Show } from 'solid-js';
import { HiOutlineDocument } from 'solid-icons/hi';

function LoadingSpinner() {
  return <div class='animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600' />;
}

export default function PdfEmptyState(props) {
  // props.libReady - Whether PDF.js is ready
  // props.loading - Whether PDF is loading
  // props.error - Error message if any
  // props.pdfDoc - The loaded PDF document
  // props.readOnly - If true, hides "Open a PDF file" button
  // props.onOpenFile - Handler to open file picker

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
              <button
                onClick={() => props.onOpenFile()}
                class='text-blue-600 hover:text-blue-700 font-medium'
              >
                Try another file
              </button>
            </Show>
          </div>
        </div>
      </Show>

      {/* No PDF loaded */}
      <Show when={props.libReady && !props.loading && !props.error && !props.pdfDoc}>
        <div class='flex flex-col items-center justify-center h-full text-gray-500'>
          <HiOutlineDocument class='w-16 h-16 mb-4 text-gray-300' />
          <p class='mb-2'>No PDF loaded</p>
          <Show when={!props.readOnly}>
            <button
              onClick={() => props.onOpenFile()}
              class='text-blue-600 hover:text-blue-700 font-medium'
            >
              Open a PDF file
            </button>
          </Show>
        </div>
      </Show>
    </>
  );
}
