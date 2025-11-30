/**
 * PdfViewer - Component for viewing PDF files
 * Supports zoom, page navigation, file upload, and persistent PDF data
 *
 * This is the main component that composes:
 * - usePdfJs: Primitive for PDF.js state management
 * - PdfToolbar: File controls, navigation, and zoom
 * - PdfCanvas: PDF page rendering
 * - PdfEmptyState: Loading, error, and empty states
 */

import { Show } from 'solid-js';
import usePdfJs from './usePdfJs.js';
import PdfToolbar from './PdfToolbar.jsx';
import PdfCanvas from './PdfCanvas.jsx';
import PdfEmptyState from './PdfEmptyState.jsx';

export default function PdfViewer(props) {
  // props.pdfData - ArrayBuffer of saved PDF data (optional)
  // props.pdfFileName - Name of the saved PDF file (optional)
  // props.onPdfChange - Callback when PDF changes: (data: ArrayBuffer, fileName: string) => void
  // props.onPdfClear - Callback when PDF is cleared: () => void
  // props.readOnly - If true, hides upload/change/clear buttons (view only mode)

  let containerRef;
  let fileInputRef;
  let canvasRef;

  // Use the PDF.js primitive
  const pdf = usePdfJs({
    pdfData: () => props.pdfData,
    pdfFileName: () => props.pdfFileName,
    onPdfChange: props.onPdfChange,
    onPdfClear: props.onPdfClear,
  });

  // Setup refs after mount
  const setContainerRef = el => {
    containerRef = el;
    pdf.setupResizeObserver(el);
  };

  const setFileInputRef = el => {
    fileInputRef = el;
    pdf.setFileInputRef(el);
  };

  const setCanvasRef = el => {
    canvasRef = el;
    pdf.setCanvasRef(el);
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
        onFitToWidth={pdf.fitToWidth}
        fileInputRef={setFileInputRef}
        onFileUpload={pdf.handleFileUpload}
      />

      {/* PDF Content */}
      <div class='flex-1 overflow-auto p-4'>
        <PdfEmptyState
          libReady={pdf.libReady()}
          loading={pdf.loading()}
          error={pdf.error()}
          pdfDoc={pdf.pdfDoc()}
          readOnly={props.readOnly}
          onOpenFile={pdf.openFilePicker}
        />

        {/* PDF Canvas - only shown when PDF is loaded */}
        <Show when={pdf.libReady() && !pdf.loading() && !pdf.error() && pdf.pdfDoc()}>
          <PdfCanvas canvasRef={setCanvasRef} rendering={pdf.rendering()} />
        </Show>
      </div>
    </div>
  );
}
