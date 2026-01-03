/**
 * EmbedPdfViewerSnippet - Component for viewing PDF files using EmbedPDF snippet viewer
 * Uses the vanilla EmbedPDF snippet with full UI (toolbar, sidebar, etc.)
 */

import { createMemo, createEffect, onCleanup } from 'solid-js';
import EmbedPDF from '@embedpdf/snippet';

export default function EmbedPdfViewerSnippet(props) {
  // props.pdfData - ArrayBuffer of PDF data (required for snippet viewer)
  // props.pdfFileName - Name of the PDF file (optional, for display)

  let containerRef;
  let viewerInstance = null;
  let currentBlobUrl = null;

  // Create blob URL from pdfData
  const blobUrl = createMemo(() => {
    const pdfData = props.pdfData;
    if (!pdfData) return null;

    const blob = new Blob([pdfData], { type: 'application/pdf' });
    return URL.createObjectURL(blob);
  });

  // Initialize or re-initialize the snippet viewer when blobUrl changes
  createEffect(() => {
    const url = blobUrl();
    const container = containerRef;

    if (!url || !container) {
      // Clean up existing viewer if URL is removed
      if (viewerInstance) {
        try {
          // Try to destroy the viewer if the API supports it
          if (typeof viewerInstance.destroy === 'function') {
            viewerInstance.destroy();
          } else if (typeof viewerInstance.unmount === 'function') {
            viewerInstance.unmount();
          } else if (typeof viewerInstance.dispose === 'function') {
            viewerInstance.dispose();
          }
        } catch (err) {
          console.warn('Error destroying EmbedPDF viewer:', err);
        }
        viewerInstance = null;
      }

      // Clear container
      if (container) {
        container.innerHTML = '';
      }

      return;
    }

    // Clean up previous viewer instance if URL changed
    if (viewerInstance && currentBlobUrl !== url) {
      try {
        if (typeof viewerInstance.destroy === 'function') {
          viewerInstance.destroy();
        } else if (typeof viewerInstance.unmount === 'function') {
          viewerInstance.unmount();
        } else if (typeof viewerInstance.dispose === 'function') {
          viewerInstance.dispose();
        }
      } catch (err) {
        console.warn('Error destroying previous EmbedPDF viewer:', err);
      }
      viewerInstance = null;
      if (container) {
        container.innerHTML = '';
      }
    }

    // Initialize new viewer if we don't have one yet
    if (!viewerInstance && container) {
      try {
        viewerInstance = EmbedPDF.init({
          type: 'container',
          target: container,
          src: url,
          theme: { preference: 'system' },
        });
        currentBlobUrl = url;
      } catch (err) {
        console.error('Failed to initialize EmbedPDF viewer:', err);
        viewerInstance = null;
      }
    }
  });

  // Clean up on unmount
  onCleanup(() => {
    // Destroy viewer instance
    if (viewerInstance) {
      try {
        if (typeof viewerInstance.destroy === 'function') {
          viewerInstance.destroy();
        } else if (typeof viewerInstance.unmount === 'function') {
          viewerInstance.unmount();
        } else if (typeof viewerInstance.dispose === 'function') {
          viewerInstance.dispose();
        }
      } catch (err) {
        console.warn('Error destroying EmbedPDF viewer on cleanup:', err);
      }
      viewerInstance = null;
    }

    // Revoke blob URL
    if (currentBlobUrl) {
      try {
        URL.revokeObjectURL(currentBlobUrl);
      } catch (err) {
        console.warn('Error revoking blob URL:', err);
      }
      currentBlobUrl = null;
    }

    // Also revoke the current blobUrl if different
    const url = blobUrl();
    if (url && url !== currentBlobUrl) {
      try {
        URL.revokeObjectURL(url);
      } catch (err) {
        console.warn('Error revoking blob URL:', err);
      }
    }
  });

  const hasPdfData = createMemo(() => !!props.pdfData);

  return (
    <div class='flex h-full flex-1 flex-col bg-gray-100'>
      {hasPdfData() ? (
        <div ref={containerRef} class='flex h-full w-full flex-1' />
      ) : (
        <div class='flex flex-1 items-center justify-center'>
          <div class='text-center text-gray-500'>
            <p>No PDF selected</p>
          </div>
        </div>
      )}
    </div>
  );
}
