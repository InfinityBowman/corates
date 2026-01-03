/**
 * PDF Viewer configuration
 * Controls which PDF viewer implementation to use
 */

// Feature flag: 'pdfjs' or 'embedpdf'
// Default to 'pdfjs' for now until EmbedPDF is fully tested
export const PDF_VIEWER_IMPL = import.meta.env.VITE_PDF_VIEWER_IMPL || 'pdfjs';

// EmbedPDF pdfium.wasm URL override (optional)
// If not set, uses default from @corates/embedpdf-solid
export const EMBEDPDF_PDFIUM_WASM_URL =
  import.meta.env.VITE_EMBEDPDF_PDFIUM_WASM_URL || null;
