/**
 * PDF Viewer configuration
 * Controls which PDF viewer implementation to use
 */

// PDF viewer implementation mode:
// - 'pdfjs': Uses PDF.js with custom UI (default)
// - 'snippet': Uses EmbedPDF snippet viewer with full UI (toolbar, sidebar, etc.)
export const PDF_VIEWER_MODE = import.meta.env.VITE_PDF_VIEWER_MODE || 'pdfjs';
