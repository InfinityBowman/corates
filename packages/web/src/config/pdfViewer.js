/**
 * PDF Viewer configuration
 * Controls which PDF viewer implementation to use
 */

// PDF viewer implementation mode:
// - 'headless': Uses EmbedPDF Solid adapters without UI (headless rendering)
// - 'pdfjs': Uses PDF.js with custom UI (default)
// - 'snippet': Uses EmbedPDF snippet viewer with full UI (toolbar, sidebar, etc.)
export const PDF_VIEWER_MODE = import.meta.env.VITE_PDF_VIEWER_MODE || 'pdfjs';

// EmbedPDF pdfium.wasm URL override (for headless mode)
// If not set, uses default from @corates/embedpdf-solid
export const EMBEDPDF_PDFIUM_WASM_URL = import.meta.env.VITE_EMBEDPDF_PDFIUM_WASM_URL || null;
