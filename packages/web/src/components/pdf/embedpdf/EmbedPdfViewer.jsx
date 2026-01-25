/**
 * EmbedPdfViewer - Preact island wrapper for EmbedPDF viewer
 * Manages Preact component lifecycle and converts SolidJS props to plain values
 */

import { createEffect, onCleanup, untrack } from 'solid-js';
import { render, h } from 'preact';
import EmbedPdfViewerPreact from './preact/src/main';

/**
 * EmbedPdfViewer - SolidJS wrapper that manages Preact island
 * @param {Object} props - Component props
 * @param {ArrayBuffer} props.pdfData - ArrayBuffer of PDF data (required)
 * @param {string} props.pdfFileName - Name of the PDF file (optional)
 * @param {boolean} props.readOnly - If true, view only mode
 * @param {Array} props.pdfs - Array of PDFs for multi-PDF selection
 * @param {string} props.selectedPdfId - Currently selected PDF ID
 * @param {Function} props.onPdfSelect - Handler for PDF selection change
 * @param {Function} props.onAnnotationAdd - Handler for annotation creation
 * @param {Function} props.onAnnotationUpdate - Handler for annotation update
 * @param {Function} props.onAnnotationDelete - Handler for annotation deletion
 * @param {Array} props.initialAnnotations - Initial annotations to load
 */
export default function EmbedPdfViewer(props) {
  let containerRef;

  createEffect(() => {
    const container = containerRef;
    if (!container) return;

    // Only track props that truly require a full document reload:
    // - pdfData: new PDF content to display
    // - selectedPdfId: switching between PDFs
    const pdfData = props.pdfData;
    const selectedPdfId = props.selectedPdfId;

    // Use untrack for everything else - they don't require document reload
    // The Preact component handles updates internally
    const otherProps = untrack(() => ({
      pdfFileName: props.pdfFileName,
      pdfs: props.pdfs,
      onPdfSelect: props.onPdfSelect,
      readOnly: props.readOnly,
      onAnnotationAdd: props.onAnnotationAdd,
      onAnnotationUpdate: props.onAnnotationUpdate,
      onAnnotationDelete: props.onAnnotationDelete,
      initialAnnotations: props.initialAnnotations,
    }));

    // Render Preact component into the container
    render(
      h(EmbedPdfViewerPreact, {
        pdfData,
        selectedPdfId,
        ...otherProps,
      }),
      container,
    );

    // Cleanup function
    return () => {
      if (container) {
        render(null, container);
      }
    };
  });

  // Cleanup on unmount
  onCleanup(() => {
    if (containerRef) {
      render(null, containerRef);
    }
  });

  return <div ref={containerRef} class='flex h-full w-full flex-col' />;
}
