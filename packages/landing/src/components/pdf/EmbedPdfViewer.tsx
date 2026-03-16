/**
 * EmbedPdfViewer - React wrapper that manages a Preact island for the PDF viewer.
 * Mounts the Preact EmbedPDF component into a container div, re-rendering only
 * when pdfData or selectedPdfId changes (full document reload triggers).
 */

import { useEffect, useRef } from 'react';
import { render, h } from 'preact';
import EmbedPdfViewerPreact from './embedpdf/preact/src/main';

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
  const containerRef = useRef<HTMLDivElement>(null);

  // Mount/remount Preact component when pdfData or selectedPdfId changes.
  // Other props are read fresh at mount time but don't trigger remounts.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    render(
      h(EmbedPdfViewerPreact as any, {
        pdfData,
        selectedPdfId,
        pdfFileName,
        pdfs,
        onPdfSelect,
        readOnly,
        onAnnotationAdd,
        onAnnotationUpdate,
        onAnnotationDelete,
        initialAnnotations,
      }),
      container,
    );

    return () => {
      if (container) {
        render(null, container);
      }
    };
    // Only re-mount on pdfData/selectedPdfId changes (document reload triggers).
    // Other props are read at mount time; the Preact component handles its own updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfData, selectedPdfId]);

  return <div ref={containerRef} className='flex h-full w-full flex-col' />;
}
