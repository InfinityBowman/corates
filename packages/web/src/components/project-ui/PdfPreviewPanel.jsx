/**
 * PdfPreviewPanel - Slide-in drawer for previewing PDFs
 *
 * Reads from pdfPreviewStore to show/hide and display PDF content.
 * Used across project views to preview PDFs without leaving context.
 */

import { Show } from 'solid-js';
import { Drawer } from '@corates/ui';
import PdfViewer from '@/components/checklist-ui/pdf/PdfViewer.jsx';
import pdfPreviewStore from '@/stores/pdfPreviewStore.js';

export default function PdfPreviewPanel() {
  const handleOpenChange = open => {
    if (!open) {
      pdfPreviewStore.closePreview();
    }
  };

  // Format title with filename
  const title = () => {
    const pdf = pdfPreviewStore.pdf();
    if (!pdf) return 'PDF Viewer';
    return pdf.fileName || 'PDF Viewer';
  };

  return (
    <Drawer
      open={pdfPreviewStore.isOpen()}
      onOpenChange={handleOpenChange}
      title={title()}
      side='right'
      size='lg'
      showBackdrop={false}
      closeOnOutsideClick={false}
    >
      <div class='h-full flex flex-col'>
        {/* Loading state */}
        <Show when={pdfPreviewStore.loading()}>
          <div class='flex-1 flex items-center justify-center bg-gray-100'>
            <div class='flex items-center gap-3 text-gray-500'>
              <div class='animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600' />
              Loading PDF...
            </div>
          </div>
        </Show>

        {/* Error state */}
        <Show when={pdfPreviewStore.error()}>
          <div class='flex-1 flex items-center justify-center bg-gray-100'>
            <div class='text-center'>
              <p class='text-red-600 mb-2'>Failed to load PDF</p>
              <p class='text-sm text-gray-500'>{pdfPreviewStore.error()}</p>
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
    </Drawer>
  );
}
