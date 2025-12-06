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

import { Show, Index } from 'solid-js';
import usePdfJs from './usePdfJs.js';
import PdfToolbar from './PdfToolbar.jsx';
import PdfEmptyState from './PdfEmptyState.jsx';

export default function PdfViewer(props) {
  // props.pdfData - ArrayBuffer of saved PDF data (optional)
  // props.pdfFileName - Name of the saved PDF file (optional)
  // props.onPdfChange - Callback when PDF changes: (data: ArrayBuffer, fileName: string) => void
  // props.onPdfClear - Callback when PDF is cleared: () => void
  // props.readOnly - If true, hides upload/change/clear buttons (view only mode)

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
    <div class='flex flex-col h-full bg-gray-100' ref={setContainerRef}>
      <PdfToolbar
        readOnly={props.readOnly}
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
          <div class='flex flex-col items-center gap-8 min-w-fit pt-2'>
            <Index each={Array(pdf.totalPages())}>
              {(_, index) => {
                const pageNum = index + 1;
                return (
                  <div ref={el => pdf.setPageRef(pageNum, el)} class='relative'>
                    {/* Page number label */}
                    <div class='text-xs text-gray-500 mb-1'>
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
            </Index>
          </div>
        </Show>
      </div>
    </div>
  );
}
