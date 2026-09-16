/**
 * EmbedPdfViewer - React wrapper for the EmbedPDF viewer component.
 *
 * Renders the viewer directly as a React component. The PDFium engine and
 * Web Workers are preserved across re-renders by the viewer's internal state.
 */

import type { PdfEntry } from '@/stores/projectStore';
import { ViewerPage } from './embedpdf/react/src/viewer';

interface AnnotationData {
  id: string;
  type: string;
  pageIndex: number;
  embedPdfData: Record<string, unknown>;
  createdBy?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface EmbedPdfViewerProps {
  pdfData?: ArrayBuffer | null;
  pdfFileName?: string;
  readOnly?: boolean;
  initialZoom?: number;
  pdfs?: PdfEntry[];
  selectedPdfId?: string | null;
  onPdfSelect?: (_pdfId: string) => void;
  onAnnotationAdd?: (_annotation: AnnotationData) => void;
  onAnnotationUpdate?: (_annotation: AnnotationData) => void;
  onAnnotationDelete?: (_annotationId: string) => void;
  initialAnnotations?: AnnotationData[];
  onPdfChange?: (_data: ArrayBuffer, _fileName: string) => void;
  onPdfClear?: () => void;
  allowDelete?: boolean;
}

export default function EmbedPdfViewer({
  pdfData,
  pdfFileName,
  readOnly,
  initialZoom,
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
      initialZoom={initialZoom}
      onAnnotationAdd={onAnnotationAdd}
      onAnnotationUpdate={onAnnotationUpdate}
      onAnnotationDelete={onAnnotationDelete}
      initialAnnotations={initialAnnotations}
    />
  );
}
