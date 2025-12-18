/**
 * PdfToolbar - Toolbar component for PDF viewer
 * Contains file controls, page navigation, and zoom controls
 */

import { Show, createSignal } from 'solid-js';
import { AiOutlineUpload, AiOutlineClose, AiOutlineMinus, AiOutlinePlus } from 'solid-icons/ai';
import {
  BiRegularChevronLeft,
  BiRegularChevronRight,
  BiRegularExpandHorizontal,
} from 'solid-icons/bi';
import { useConfirmDialog } from '@corates/ui';
import PdfSelector from './PdfSelector.jsx';

export default function PdfToolbar(props) {
  // props.readOnly - If true, hides upload/change/clear buttons
  // props.allowDelete - If true, shows delete button (only applies when !readOnly)
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
  // props.onSetScale - Handler to set specific zoom scale
  // props.onGoToPage - Handler to go to specific page
  // props.onFitToWidth - Handler for fit to width
  // props.fileInputRef - Ref setter for hidden file input
  // props.onFileUpload - Handler for file upload
  // props.pdfs - Array of PDFs for multi-PDF selection
  // props.selectedPdfId - Currently selected PDF ID
  // props.onPdfSelect - Handler for PDF selection change

  // Local state for page input
  const [pageInput, setPageInput] = createSignal('');
  const [zoomInput, setZoomInput] = createSignal('');

  const confirmRemovePdf = useConfirmDialog();

  // Handle page input submission
  function handlePageSubmit(e) {
    e.preventDefault();
    const pageNum = parseInt(pageInput(), 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= props.totalPages) {
      props.onGoToPage?.(pageNum);
    }
    setPageInput('');
    e.target.querySelector('input')?.blur();
  }

  // Handle zoom input submission
  function handleZoomSubmit(e) {
    e.preventDefault();
    const zoomPercent = parseInt(zoomInput(), 10);
    if (!isNaN(zoomPercent) && zoomPercent >= 50 && zoomPercent <= 300) {
      props.onSetScale?.(zoomPercent / 100);
    }
    setZoomInput('');
    e.target.querySelector('input')?.blur();
  }

  return (
    <div class='bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between gap-4 shrink-0'>
      <confirmRemovePdf.ConfirmDialogComponent />
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

        {/* PDF Selector - for switching between multiple PDFs */}
        <Show when={props.pdfs?.length > 1}>
          <PdfSelector
            pdfs={props.pdfs}
            selectedPdfId={props.selectedPdfId}
            onSelect={props.onPdfSelect}
          />
        </Show>

        {/* Show file name if PDF is loaded (only when not using multi-PDF selector) */}
        <Show when={props.fileName && !(props.pdfs?.length > 1)}>
          <span class='text-sm text-gray-600 truncate max-w-40' title={props.fileName}>
            {props.fileName}
          </span>
        </Show>

        {/* Delete button - only for local checklists */}
        <Show when={props.fileName && !props.readOnly && props.allowDelete}>
          <button
            onClick={async () => {
              const didConfirm = await confirmRemovePdf.open({
                title: 'Remove PDF?',
                description:
                  'This will remove the currently loaded PDF from this checklist. You can upload it again later.',
                confirmText: 'Remove',
                cancelText: 'Cancel',
                variant: 'danger',
              });

              if (didConfirm) props.onClearPdf?.();
            }}
            class='p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0'
            title='Clear PDF'
          >
            <AiOutlineClose class='w-4 h-4' />
          </button>
        </Show>
      </div>

      {/* Page navigation */}
      <Show when={props.pdfDoc}>
        <div class='flex items-center gap-2'>
          <button
            onClick={() => props.onPrevPage?.()}
            disabled={props.currentPage <= 1}
            class='p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
            title='Scroll to previous page'
          >
            <BiRegularChevronLeft class='w-5 h-5' />
          </button>
          <form onSubmit={handlePageSubmit} class='flex items-center gap-1 whitespace-nowrap'>
            <input
              type='text'
              inputmode='numeric'
              value={pageInput()}
              onInput={e => setPageInput(e.target.value)}
              placeholder={String(props.currentPage)}
              class='w-10 text-center text-sm text-gray-600 border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:border-blue-400'
              title='Enter page number'
            />
            <span class='text-sm text-gray-600'>/ {props.totalPages}</span>
          </form>
          <button
            onClick={() => props.onNextPage?.()}
            disabled={props.currentPage >= props.totalPages}
            class='p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
            title='Scroll to next page'
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
          <form onSubmit={handleZoomSubmit} class='flex items-center'>
            <input
              type='text'
              inputmode='numeric'
              value={zoomInput()}
              onInput={e => setZoomInput(e.target.value)}
              placeholder={`${Math.round(props.scale * 100)}%`}
              class='w-14 text-center text-sm text-gray-600 border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:border-blue-400'
              title='Enter zoom percentage (50-300)'
            />
          </form>
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
