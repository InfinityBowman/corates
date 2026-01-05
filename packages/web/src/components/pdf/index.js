/**
 * PDF Components - Barrel export
 * Provides both PDF.js and EmbedPDF implementations
 */

// PDF.js components
export {
  PdfViewer,
  PdfToolbar,
  PdfEmptyState,
  PdfList,
  PdfListItem,
  PdfTagBadge,
  PdfTagSelect,
  PdfSelector,
  usePdfJs,
} from './pdfjs/index.js';

// EmbedPDF components
export { default as EmbedPdfViewer } from './embedpdf/EmbedPdfViewer.jsx';
export { default as EmbedPdfViewerSnippet } from './embedpdf/EmbedPdfViewerSnippet.jsx';
export { default as EmbedPdfViewerPdfJs } from './embedpdf/EmbedPdfViewerPdfJs.jsx';
export { default as EmbedPdfViewerHeadless } from './embedpdf/EmbedPdfViewerHeadless.jsx';
