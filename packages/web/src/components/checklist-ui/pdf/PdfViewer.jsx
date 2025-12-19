/**
 * PdfViewer - Component for viewing PDF files with continuous scrolling
 * Supports zoom, page navigation via scroll, file upload, and persistent PDF data
 *
 * This is the main component that composes:
 * - usePdfJs: Primitive for PDF.js state management
 * - PdfToolbar: File controls, navigation, and zoom
 * - PdfCanvas: PDF page rendering (now renders all pages)
 * - PdfEmptyState: Loading, error, and empty states
 */

import { Show, For } from 'solid-js';
import usePdfJs from './usePdfJs.js';
import PdfToolbar from './PdfToolbar.jsx';
import PdfEmptyState from './PdfEmptyState.jsx';

export default function PdfViewer(props) {
  // props.pdfData - ArrayBuffer of saved PDF data (optional)
  // props.pdfFileName - Name of the saved PDF file (optional)
  // props.onPdfChange - Callback when PDF changes: (data: ArrayBuffer, fileName: string) => void
  // props.onPdfClear - Callback when PDF is cleared: () => void
  // props.readOnly - If true, hides upload/change/clear buttons (view only mode)
  // props.allowDelete - If true, shows delete button (only applies when !readOnly)
  // props.pdfs - Array of PDFs for multi-PDF selection
  // props.selectedPdfId - Currently selected PDF ID
  // props.onPdfSelect - Handler for PDF selection change

  // Use the PDF.js primitive
  const pdf = usePdfJs({
    pdfData: () => props.pdfData,
    pdfFileName: () => props.pdfFileName,
    onPdfChange: (data, name) => props.onPdfChange?.(data, name),
    onPdfClear: () => props.onPdfClear?.(),
  });

  // Setup refs after mount
  const setContainerRef = el => {
    pdf.setupResizeObserver(el);
  };

  const setFileInputRef = el => {
    pdf.setFileInputRef(el);
  };

  return (
    <div class='flex h-full flex-col bg-gray-100' ref={setContainerRef}>
      <PdfToolbar
        readOnly={props.readOnly}
        allowDelete={props.allowDelete}
        libReady={pdf.libReady()}
        pdfDoc={pdf.pdfDoc()}
        fileName={pdf.fileName()}
        currentPage={pdf.currentPage()}
        totalPages={pdf.totalPages()}
        scale={pdf.scale()}
        onOpenFile={pdf.openFilePicker}
        onClearPdf={pdf.clearPdf}
        onPrevPage={pdf.goToPrevPage}
        onNextPage={pdf.goToNextPage}
        onZoomIn={pdf.zoomIn}
        onZoomOut={pdf.zoomOut}
        onResetZoom={pdf.resetZoom}
        onSetScale={pdf.setScale}
        onGoToPage={pdf.goToPage}
        onFitToWidth={pdf.fitToWidth}
        fileInputRef={setFileInputRef}
        onFileUpload={pdf.handleFileUpload}
        pdfs={props.pdfs}
        selectedPdfId={props.selectedPdfId}
        onPdfSelect={props.onPdfSelect}
      />

      {/* PDF Content - Scrollable container for all pages */}
      <div class='flex-1 overflow-auto p-4' ref={pdf.setScrollContainerRef}>
        <PdfEmptyState
          libReady={pdf.libReady()}
          loading={pdf.loading()}
          error={pdf.error()}
          pdfDoc={pdf.pdfDoc()}
          readOnly={props.readOnly}
          onFileAccept={pdf.handleFile}
        />

        {/* PDF Pages - Render all pages in a continuous scroll */}
        <Show when={pdf.libReady() && !pdf.loading() && !pdf.error() && pdf.pdfDoc()}>
          <div class='flex min-w-fit flex-col items-center gap-8 pt-2'>
            {/* Use For with docId-based keys to force DOM recreation when PDF changes */}
            <For
              each={Array.from({ length: pdf.totalPages() }, (_, i) => `${pdf.docId()}-${i + 1}`)}
            >
              {key => {
                const pageNum = parseInt(key.split('-')[1], 10);
                return (
                  <div ref={el => pdf.setPageRef(pageNum, el)} class='relative'>
                    {/* Page number label */}
                    <div class='mb-1 text-xs text-gray-500'>
                      Page {pageNum} of {pdf.totalPages()}
                    </div>
                    <div class='relative shadow-lg'>
                      <canvas ref={el => pdf.setPageCanvasRef(pageNum, el)} class='bg-white' />
                      {/* Text layer for text selection */}
                      <div
                        ref={el => pdf.setPageTextLayerRef(pageNum, el)}
                        class='pdf-text-layer absolute top-0 left-0 overflow-hidden'
                      />
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>
      </div>
    </div>
  );
}
