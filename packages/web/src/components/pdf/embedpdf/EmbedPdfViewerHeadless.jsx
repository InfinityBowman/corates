/**
 * EmbedPdfViewerHeadless - Preact island wrapper for EmbedPDF headless mode
 * Manages Preact component lifecycle and converts SolidJS props to plain values
 */

import { createEffect, onCleanup } from 'solid-js';
import { render, h } from 'preact';
import EmbedPdfViewerPreact2 from './preact/src/main.js';

/**
 * EmbedPdfViewerHeadless - SolidJS wrapper that manages Preact island
 * @param {Object} props - Component props
 * @param {ArrayBuffer} props.pdfData - ArrayBuffer of PDF data (required)
 * @param {string} props.pdfFileName - Name of the PDF file (optional)
 * @param {boolean} props.readOnly - If true, view only mode
 * @param {Array} props.pdfs - Array of PDFs for multi-PDF selection
 * @param {string} props.selectedPdfId - Currently selected PDF ID
 * @param {Function} props.onPdfSelect - Handler for PDF selection change
 */
export default function EmbedPdfViewerHeadless(props) {
  let containerRef;

  createEffect(() => {
    if (!containerRef) return;

    // Convert SolidJS signals to plain values for Preact
    const pdfData = props.pdfData;
    const pdfFileName = props.pdfFileName;
    const readOnly = props.readOnly;
    const pdfs = props.pdfs;
    const selectedPdfId = props.selectedPdfId;

    // Render Preact component into the container
    render(
      h(EmbedPdfViewerPreact2, {
        pdfData,
        pdfFileName,
        readOnly,
        pdfs,
        selectedPdfId,
        onPdfSelect: props.onPdfSelect,
      }),
      containerRef,
    );

    // Cleanup function
    return () => {
      if (containerRef) {
        render(null, containerRef);
      }
    };
  });

  // Cleanup on unmount
  onCleanup(() => {
    if (containerRef) {
      render(null, containerRef);
    }
  });

  return <div ref={containerRef} class='h-full w-full' />;
}
