/**
 * EmbedPdfViewerPdfJs - Wrapper for PDF.js viewer
 * Uses the existing PdfViewer component from the pdfjs directory
 */

import PdfViewer from '../pdfjs/PdfViewer';

export default function EmbedPdfViewerPdfJs(props) {
  // props.pdfData - ArrayBuffer of PDF data (required)
  // props.pdfFileName - Name of the PDF file (optional, for display)

  return <PdfViewer pdfData={props.pdfData} pdfFileName={props.pdfFileName} />;
}
