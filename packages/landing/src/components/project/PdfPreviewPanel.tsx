/**
 * PdfPreviewPanel - Slide-in panel for previewing PDFs
 * Reads from pdfPreviewStore to show/hide and display PDF content.
 */

import { lazy, Suspense, useMemo } from 'react';
import { SlidingPanel } from './SlidingPanel';
import { usePdfPreviewStore } from '@/stores/pdfPreviewStore';

const EmbedPdfViewer = lazy(() => import('@/components/pdf/EmbedPdfViewer'));

export function PdfPreviewPanel() {
  const isOpen = usePdfPreviewStore(s => s.isOpen);
  const pdf = usePdfPreviewStore(s => s.pdf);
  const pdfData = usePdfPreviewStore(s => s.pdfData);
  const loading = usePdfPreviewStore(s => s.loading);
  const error = usePdfPreviewStore(s => s.error);
  const closePreview = usePdfPreviewStore(s => s.closePreview);

  const title = pdf?.fileName || 'PDF Viewer';

  const viewState = useMemo(() => {
    if (loading) return 'loading' as const;
    if (error) return 'error' as const;
    if (pdfData) return 'ready' as const;
    return 'empty' as const;
  }, [loading, error, pdfData]);

  return (
    <SlidingPanel open={isOpen} onClose={closePreview} title={title} size="2xl" closeOnOutsideClick>
      <div className="flex h-full min-h-0 flex-col">
        {viewState === 'loading' && (
          <div className="bg-secondary flex h-full flex-1 flex-col">
            <div className="flex flex-1 items-center justify-center">
              <div className="text-muted-foreground flex items-center gap-3">
                <div className="border-primary h-6 w-6 animate-spin rounded-full border-b-2" />
                Loading PDF...
              </div>
            </div>
          </div>
        )}

        {viewState === 'error' && (
          <div className="bg-secondary flex h-full flex-1 flex-col">
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <p className="mb-2 text-red-600">Failed to load PDF</p>
                <p className="text-muted-foreground text-sm">{error}</p>
              </div>
            </div>
          </div>
        )}

        {viewState === 'ready' && (
          <Suspense
            fallback={
              <div className="flex h-full flex-1 items-center justify-center">
                <div className="border-primary h-6 w-6 animate-spin rounded-full border-b-2" />
              </div>
            }
          >
            <EmbedPdfViewer pdfData={pdfData} pdfFileName={pdf?.fileName} readOnly />
          </Suspense>
        )}

        {viewState === 'empty' && (
          <div className="bg-secondary flex h-full flex-1 flex-col">
            <div className="flex flex-1 items-center justify-center">
              <div className="text-muted-foreground text-center">
                <p>No PDF to display</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </SlidingPanel>
  );
}
