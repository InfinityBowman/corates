/**
 * PdfToolbar - Toolbar component for PDF viewer
 * Contains file controls, page navigation, and zoom controls
 */

import { Show } from 'solid-js';
import { AiOutlineUpload, AiOutlineClose, AiOutlineMinus, AiOutlinePlus } from 'solid-icons/ai';
import {
  BiRegularChevronLeft,
  BiRegularChevronRight,
  BiRegularExpandHorizontal,
} from 'solid-icons/bi';

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
        <Show when={!props.readOnly && !props.pdfDoc}>
          <input
            ref={props.fileInputRef}
            type='file'
            accept='application/pdf'
            onChange={e => props.onFileUpload?.(e)}
            class='hidden'
          />
          <button
            onClick={() => props.onOpenFile?.()}
            disabled={!props.libReady}
            class='inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shrink-0'
          >
            <AiOutlineUpload class='w-4 h-4' />
            Open PDF
          </button>
        </Show>

        {/* Show file name if PDF is loaded */}
        <Show when={props.fileName}>
          <span class='text-sm text-gray-600 truncate max-w-40' title={props.fileName}>
            {props.fileName}
          </span>
          <Show when={!props.readOnly}>
            <button
              onClick={() => props.onClearPdf?.()}
              class='p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0'
              title='Clear PDF'
            >
              <AiOutlineClose class='w-4 h-4' />
            </button>
          </Show>
        </Show>
      </div>

      {/* Page navigation */}
      <Show when={props.pdfDoc}>
        <div class='flex items-center gap-2'>
          <button
            onClick={() => props.onPrevPage?.()}
            disabled={props.currentPage <= 1}
            class='p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
            title='Previous page'
          >
            <BiRegularChevronLeft class='w-5 h-5' />
          </button>
          <span class='text-sm text-gray-600 min-w-20 text-center'>
            {props.currentPage} / {props.totalPages}
          </span>
          <button
            onClick={() => props.onNextPage?.()}
            disabled={props.currentPage >= props.totalPages}
            class='p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
            title='Next page'
          >
            <BiRegularChevronRight class='w-5 h-5' />
          </button>
        </div>

        {/* Zoom controls */}
        <div class='flex items-center gap-1'>
          <button
            onClick={() => props.onZoomOut?.()}
            disabled={props.scale <= 0.5}
            class='p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
            title='Zoom out'
          >
            <AiOutlineMinus class='w-5 h-5' />
          </button>
          <button
            onClick={() => props.onResetZoom?.()}
            class='px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors min-w-[50px]'
            title='Reset zoom'
          >
            {Math.round(props.scale * 100)}%
          </button>
          <button
            onClick={() => props.onZoomIn?.()}
            disabled={props.scale >= 3.0}
            class='p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
            title='Zoom in'
          >
            <AiOutlinePlus class='w-5 h-5' />
          </button>
          <button
            onClick={() => props.onFitToWidth?.()}
            class='p-1.5 rounded hover:bg-gray-100 transition-colors'
            title='Fit to width'
          >
            <BiRegularExpandHorizontal class='w-5 h-5' />
          </button>
        </div>
      </Show>
    </div>
  );
}
