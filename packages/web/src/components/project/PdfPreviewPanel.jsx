/**
 * PdfPreviewPanel - Slide-in panel for previewing PDFs
 *
 * Reads from pdfPreviewStore to show/hide and display PDF content.
 * Used across project views to preview PDFs without leaving context.
 */

import { Show } from 'solid-js';
import SlidingPanel from './SlidingPanel.jsx';
import PdfViewer from '@/components/checklist/pdf/PdfViewer.jsx';
import pdfPreviewStore from '@/stores/pdfPreviewStore.js';

export default function PdfPreviewPanel() {
  const handleClose = () => {
    pdfPreviewStore.closePreview();
  };

  // Format title with filename
  const title = () => {
    const pdf = pdfPreviewStore.pdf();
    if (!pdf) return 'PDF Viewer';
    return pdf.fileName || 'PDF Viewer';
  };

  return (
    <SlidingPanel
      open={pdfPreviewStore.isOpen()}
      onClose={handleClose}
      title={title()}
      size='2xl'
      closeOnOutsideClick={true}
    >
      <div class='flex h-full min-h-0 flex-col'>
        {/* Loading state */}
        <Show when={pdfPreviewStore.loading()}>
          <div class='flex h-full flex-1 flex-col bg-gray-100'>
            <div class='flex flex-1 items-center justify-center'>
              <div class='flex items-center gap-3 text-gray-500'>
                <div class='h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600' />
                Loading PDF...
              </div>
            </div>
          </div>
        </Show>

        {/* Error state */}
        <Show when={pdfPreviewStore.error()}>
          <div class='flex h-full flex-1 flex-col bg-gray-100'>
            <div class='flex flex-1 items-center justify-center'>
              <div class='text-center'>
                <p class='mb-2 text-red-600'>Failed to load PDF</p>
                <p class='text-sm text-gray-500'>{pdfPreviewStore.error()}</p>
              </div>
            </div>
          </div>
        </Show>

        {/* PDF Viewer */}
        <Show
          when={!pdfPreviewStore.loading() && !pdfPreviewStore.error() && pdfPreviewStore.pdfData()}
        >
          <PdfViewer
            pdfData={pdfPreviewStore.pdfData()}
            pdfFileName={pdfPreviewStore.pdf()?.fileName}
            readOnly={true}
          />
        </Show>
      </div>
    </SlidingPanel>
  );
}
