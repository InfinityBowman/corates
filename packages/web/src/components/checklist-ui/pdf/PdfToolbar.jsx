/**
 * PdfToolbar - Toolbar component for PDF viewer
 * Contains file controls, page navigation, and zoom controls
 */

import { Show } from 'solid-js';

// Icon components for cleaner JSX
function UploadIcon() {
  return (
    <svg class='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
      <path
        stroke-linecap='round'
        stroke-linejoin='round'
        stroke-width='2'
        d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12'
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg class='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
      <path
        stroke-linecap='round'
        stroke-linejoin='round'
        stroke-width='2'
        d='M6 18L18 6M6 6l12 12'
      />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
      <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M15 19l-7-7 7-7' />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
      <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M9 5l7 7-7 7' />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
      <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M20 12H4' />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
      <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 4v16m8-8H4' />
    </svg>
  );
}

function FitWidthIcon() {
  return (
    <svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
      <path
        stroke-linecap='round'
        stroke-linejoin='round'
        stroke-width='2'
        d='M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4'
      />
    </svg>
  );
}

export default function PdfToolbar(props) {
  // props.readOnly - If true, hides upload/change/clear buttons
  // props.libReady - Whether PDF.js is ready
  // props.pdfDoc - The loaded PDF document
  // props.fileName - Current file name
  // props.currentPage - Current page number
  // props.totalPages - Total number of pages
  // props.scale - Current zoom scale
  // props.onOpenFile - Handler to open file picker
  // props.onClearPdf - Handler to clear PDF
  // props.onPrevPage - Handler for previous page
  // props.onNextPage - Handler for next page
  // props.onZoomIn - Handler for zoom in
  // props.onZoomOut - Handler for zoom out
  // props.onResetZoom - Handler for reset zoom
  // props.onFitToWidth - Handler for fit to width
  // props.fileInputRef - Ref setter for hidden file input
  // props.onFileUpload - Handler for file upload

  return (
    <div class='bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between gap-4 shrink-0'>
      {/* File upload and info */}
      <div class='flex items-center gap-2 min-w-0'>
        <Show when={!props.readOnly}>
          <input
            ref={props.fileInputRef}
            type='file'
            accept='application/pdf'
            onChange={props.onFileUpload}
            class='hidden'
          />
          <button
            onClick={props.onOpenFile}
            disabled={!props.libReady}
            class='inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shrink-0'
          >
            <UploadIcon />
            {props.pdfDoc ? 'Change' : 'Open PDF'}
          </button>
        </Show>

        {/* Show file name if PDF is loaded */}
        <Show when={props.fileName}>
          <span class='text-sm text-gray-600 truncate max-w-40' title={props.fileName}>
            {props.fileName}
          </span>
          <Show when={!props.readOnly}>
            <button
              onClick={props.onClearPdf}
              class='p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0'
              title='Clear PDF'
            >
              <CloseIcon />
            </button>
          </Show>
        </Show>
      </div>

      {/* Page navigation */}
      <Show when={props.pdfDoc}>
        <div class='flex items-center gap-2'>
          <button
            onClick={props.onPrevPage}
            disabled={props.currentPage <= 1}
            class='p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
            title='Previous page'
          >
            <ChevronLeftIcon />
          </button>
          <span class='text-sm text-gray-600 min-w-20 text-center'>
            {props.currentPage} / {props.totalPages}
          </span>
          <button
            onClick={props.onNextPage}
            disabled={props.currentPage >= props.totalPages}
            class='p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
            title='Next page'
          >
            <ChevronRightIcon />
          </button>
        </div>

        {/* Zoom controls */}
        <div class='flex items-center gap-1'>
          <button
            onClick={props.onZoomOut}
            disabled={props.scale <= 0.5}
            class='p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
            title='Zoom out'
          >
            <MinusIcon />
          </button>
          <button
            onClick={props.onResetZoom}
            class='px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors min-w-[50px]'
            title='Reset zoom'
          >
            {Math.round(props.scale * 100)}%
          </button>
          <button
            onClick={props.onZoomIn}
            disabled={props.scale >= 3.0}
            class='p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
            title='Zoom in'
          >
            <PlusIcon />
          </button>
          <button
            onClick={props.onFitToWidth}
            class='p-1.5 rounded hover:bg-gray-100 transition-colors'
            title='Fit to width'
          >
            <FitWidthIcon />
          </button>
        </div>
      </Show>
    </div>
  );
}
