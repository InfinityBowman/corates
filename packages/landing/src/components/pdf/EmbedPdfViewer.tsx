/**
 * EmbedPdfViewer - React wrapper that manages a Preact island for the PDF viewer.
 *
 * Mounts the Preact EmbedPDF component once and re-renders it in-place when props
 * change, avoiding the cost of destroying and recreating the PDFium engine + workers
 * on every PDF switch.
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
  const mountedRef = useRef(false);

  // Mount the Preact tree once, then re-render in-place on prop changes.
  // Preact's render() with the same container diffs the existing tree rather
  // than destroying it, so the PDFium engine and Web Workers are preserved.
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

    mountedRef.current = true;
  });

  // Unmount only when the component is removed from the DOM
  useEffect(() => {
    return () => {
      const container = containerRef.current;
      if (container && mountedRef.current) {
        render(null, container);
        mountedRef.current = false;
      }
    };
  }, []);

  return <div ref={containerRef} className='flex h-full w-full flex-col' />;
}
