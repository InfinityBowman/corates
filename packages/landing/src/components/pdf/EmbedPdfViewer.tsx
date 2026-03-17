/**
 * EmbedPdfViewer - React wrapper for the EmbedPDF viewer component.
 *
 * Renders the viewer directly as a React component. The PDFium engine and
 * Web Workers are preserved across re-renders by the viewer's internal state.
 */

import { ViewerPage } from './embedpdf/preact/src/viewer';

export interface EmbedPdfViewerProps {
  pdfData?: ArrayBuffer | null;
  pdfFileName?: string;
  readOnly?: boolean;
  pdfs?: any[];
  selectedPdfId?: string | null;
  onPdfSelect?: (_pdfId: string) => void;
  onAnnotationAdd?: (..._args: any[]) => void;
  onAnnotationUpdate?: (..._args: any[]) => void;
  onAnnotationDelete?: (..._args: any[]) => void;
  initialAnnotations?: any[];
  onPdfChange?: (..._args: any[]) => void;
  onPdfClear?: () => void;
  allowDelete?: boolean;
}

export default function EmbedPdfViewer({
  pdfData,
  pdfFileName,
  readOnly,
  pdfs,
  selectedPdfId,
  onPdfSelect,
  onAnnotationAdd,
  onAnnotationUpdate,
  onAnnotationDelete,
  initialAnnotations,
}: EmbedPdfViewerProps) {
  return (
    <ViewerPage
      pdfData={pdfData ?? undefined}
      pdfFileName={pdfFileName}
      pdfs={pdfs}
      selectedPdfId={selectedPdfId}
      onPdfSelect={onPdfSelect}
      readOnly={readOnly}
      onAnnotationAdd={onAnnotationAdd}
      onAnnotationUpdate={onAnnotationUpdate}
      onAnnotationDelete={onAnnotationDelete}
      initialAnnotations={initialAnnotations}
    />
  );
}
