import type { DocumentManagerPlugin } from '@embedpdf/plugin-document-manager/react';
import { captureException } from '@/config/sentry';

export type LoadRequest = {
  pdfData: ArrayBuffer;
  selectedPdfId?: string | null;
  pdfFileName?: string;
  pdfs?: Array<{ id: string; fileName: string }>;
};

export type DocumentLoader = {
  docManager: ReturnType<DocumentManagerPlugin['provides']> | null;
  activeDocumentId: string | null;
  loadedPdfId: string | null | undefined;
  pending: LoadRequest | null;
  loading: boolean;
};

/**
 * Loads run one at a time. A request that arrives mid-load waits for its
 * turn instead of being dropped, so the viewer always ends on the latest one.
 */
export async function drainLoads(loader: DocumentLoader) {
  if (loader.loading) return;
  loader.loading = true;
  try {
    while (loader.pending && loader.docManager) {
      const request = loader.pending;
      const docManager = loader.docManager;
      loader.pending = null;
      const previousPdfId = loader.loadedPdfId;
      loader.loadedPdfId = request.selectedPdfId;
      try {
        if (loader.activeDocumentId) {
          try {
            await docManager.closeDocument(loader.activeDocumentId).toPromise();
          } catch (err) {
            // The document may already be gone
            console.warn('Error closing previous document:', err);
          }
          loader.activeDocumentId = null;
        }
        const selectedPdf =
          request.pdfs?.find(pdf => pdf.id === request.selectedPdfId) || request.pdfs?.[0];
        const opened = await docManager
          .openDocumentBuffer({
            buffer: request.pdfData,
            name: request.pdfFileName || selectedPdf?.fileName || 'document.pdf',
            autoActivate: true,
          })
          .toPromise();
        loader.activeDocumentId = opened.documentId;
        // The outer task resolves when the open starts; the inner one when the pages are in
        await opened.task.toPromise();
      } catch (err) {
        console.error('Error loading document:', err);
        captureException(err, {
          component: 'EmbedPdfViewer',
          action: 'openDocumentBuffer',
          pdfFileName: request.pdfFileName,
          selectedPdfId: request.selectedPdfId,
        });
        // Let the same document be requested again
        loader.loadedPdfId = previousPdfId;
      }
    }
  } finally {
    loader.loading = false;
  }
}
