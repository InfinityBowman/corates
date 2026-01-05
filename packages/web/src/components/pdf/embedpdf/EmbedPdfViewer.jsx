/**
 * EmbedPdfViewer - Preact island wrapper for EmbedPDF viewer
 * Manages Preact component lifecycle and converts SolidJS props to plain values
 */

import { createEffect, onCleanup } from 'solid-js';
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
 */
export default function EmbedPdfViewer(props) {
  let containerRef;

  createEffect(() => {
    const container = containerRef;
    if (!container) return;

    // Access props directly in effect to track reactivity
    const pdfData = props.pdfData;
    const pdfFileName = props.pdfFileName;
    const pdfs = props.pdfs;
    const selectedPdfId = props.selectedPdfId;
    const onPdfSelect = props.onPdfSelect;
    const readOnly = props.readOnly;

    // Render Preact component into the container
    render(
      h(EmbedPdfViewerPreact, {
        pdfData,
        pdfFileName,
        pdfs,
        selectedPdfId,
        onPdfSelect,
        readOnly,
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
