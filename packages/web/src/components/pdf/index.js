/**
 * PDF Components - Barrel export
 *
 * Note: EmbedPdfViewer is NOT exported here - it should be lazy-loaded directly
 * to enable code splitting. Use: lazy(() => import('@pdf/embedpdf/EmbedPdfViewer.jsx'))
 */

// PDF list components (for displaying PDF metadata in lists)
export { default as PdfListItem } from './PdfListItem.jsx';
export { default as PdfTagBadge } from './PdfTagBadge.jsx';
